import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('material_id');
  const status = searchParams.get('status');

  const where: any = {};
  if (materialId) where.materialId = parseInt(materialId);

  const batches = await db.batch.findMany({
    where,
    include: { material: true, items: { where: { isDeleted: false }, include: { saleRecords: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const result = batches.map(b => {
    const soldItems = b.items.filter(i => i.status === 'sold');
    const soldCount = soldItems.length;
    const revenue = soldItems.reduce((sum, item) => {
      return sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0);
    }, 0);
    const profit = revenue - b.totalCost;
    const paybackRate = b.totalCost > 0 ? revenue / b.totalCost : 0;

    let batchStatus = 'new';
    if (soldCount === 0) batchStatus = 'new';
    else if (soldCount === b.quantity) batchStatus = 'cleared';
    else if (paybackRate >= 1) batchStatus = 'paid_back';
    else batchStatus = 'selling';

    if (status && batchStatus !== status) return null;

    return {
      batchCode: b.batchCode,
      materialName: b.material?.name,
      totalCost: b.totalCost,
      quantity: b.quantity,
      soldCount,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      paybackRate: Math.round(paybackRate * 1000) / 1000,
      status: batchStatus,
    };
  }).filter(Boolean);

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
