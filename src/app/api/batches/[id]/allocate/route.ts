import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

// POST /api/batches/[id]/allocate — Trigger cost allocation
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batchId = parseInt(id);

  const batch = await db.batch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ code: 404, data: null, message: '批次不存在' }, { status: 404 });

  const items = await db.item.findMany({
    where: { batchId, isDeleted: false },
    include: { spec: true },
  });

  if (items.length < batch.quantity) {
    return NextResponse.json({
      code: 400,
      data: null,
      message: `货品未录完，当前 ${items.length}/${batch.quantity} 件`,
    }, { status: 400 });
  }

  // Get pricing config
  const configs = await db.sysConfig.findMany();
  const configMap = Object.fromEntries(configs.map(c => [c.key, parseFloat(c.value)]));
  const operatingCostRate = configMap['operating_cost_rate'] || 0.05;
  const markupRate = configMap['markup_rate'] || 0.30;

  let allocatedCosts: number[] = [];

  if (batch.costAllocMethod === 'equal') {
    const perItem = Math.floor((batch.totalCost / batch.quantity) * 100) / 100;
    const remainder = Math.round((batch.totalCost - perItem * batch.quantity) * 100) / 100;
    allocatedCosts = items.map((_, i) => i === items.length - 1 ? perItem + remainder : perItem);
  } else if (batch.costAllocMethod === 'by_weight') {
    const weights = items.map(item => item.spec?.weight || 0);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) {
      return NextResponse.json({ code: 400, data: null, message: '按克重分摊：所有货品必须有克重' }, { status: 400 });
    }
    let sumAllocated = 0;
    allocatedCosts = items.map((item, i) => {
      const w = item.spec?.weight || 0;
      const cost = i === items.length - 1
        ? Math.round((batch.totalCost - sumAllocated) * 100) / 100
        : Math.round((w / totalWeight) * batch.totalCost * 100) / 100;
      sumAllocated += cost;
      return cost;
    });
  } else if (batch.costAllocMethod === 'by_price') {
    const prices = items.map(item => item.sellingPrice);
    const totalSelling = prices.reduce((a, b) => a + b, 0);
    if (totalSelling === 0) {
      return NextResponse.json({ code: 400, data: null, message: '按售价比例分摊：所有货品必须有售价' }, { status: 400 });
    }
    let sumAllocated = 0;
    allocatedCosts = items.map((item, i) => {
      const cost = i === items.length - 1
        ? Math.round((batch.totalCost - sumAllocated) * 100) / 100
        : Math.round((item.sellingPrice / totalSelling) * batch.totalCost * 100) / 100;
      sumAllocated += cost;
      return cost;
    });
  }

  // Apply allocation + pricing engine
  const results: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const allocatedCost = allocatedCosts[i];
    const floorPrice = Math.round(allocatedCost * (1 + operatingCostRate) * 100) / 100;
    const suggestedSellingPrice = Math.round(floorPrice * (1 + markupRate) * 100) / 100;

    await db.item.update({
      where: { id: items[i].id },
      data: {
        allocatedCost,
        floorPrice,
        // Only auto-set selling_price if it equals the current floor (not manually adjusted)
        ...(items[i].sellingPrice === items[i].floorPrice || !items[i].floorPrice
          ? { sellingPrice: suggestedSellingPrice }
          : {}),
      },
    });
    results.push({ skuCode: items[i].skuCode, allocatedCost, floorPrice, suggestedSellingPrice });
  }

  // Log allocate_batch
  await logAction('allocate_batch', 'batch', batchId, {
    batchCode: batch.batchCode,
    method: batch.costAllocMethod,
    itemCount: items.length,
    totalCost: batch.totalCost,
  });

  return NextResponse.json({ code: 0, data: { items: results }, message: '分摊完成' });
}
