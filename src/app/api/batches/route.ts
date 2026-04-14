import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Helper: compute batch stats
async function getBatchStats(batchId: number, batch: any) {
  const items = await db.item.findMany({
    where: { batchId, isDeleted: false },
    include: { saleRecords: true },
  });
  const itemsCount = items.length;
  const soldItems = items.filter(i => i.status === 'sold');
  const soldCount = soldItems.length;
  const revenue = soldItems.reduce((sum, item) => {
    return sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0);
  }, 0);
  const profit = revenue - batch.totalCost;
  const paybackRate = batch.totalCost > 0 ? revenue / batch.totalCost : 0;

  let status = 'new';
  if (soldCount === 0) status = 'new';
  else if (soldCount === batch.quantity) status = 'cleared';
  else if (paybackRate >= 1) status = 'paid_back';
  else status = 'selling';

  return { itemsCount, soldCount, revenue, profit, paybackRate, status };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const materialId = searchParams.get('material_id');

  const where: any = {};
  if (materialId) where.materialId = parseInt(materialId);

  const total = await db.batch.count({ where });
  const batches = await db.batch.findMany({
    where,
    include: { material: true, type: true, supplier: true },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * size,
    take: size,
  });

  const itemsWithStats = await Promise.all(
    batches.map(async (b) => {
      const stats = await getBatchStats(b.id, b);
      return {
        ...b,
        materialName: b.material?.name,
        typeName: b.type?.name,
        supplierName: b.supplier?.name,
        ...stats,
      };
    })
  );

  return NextResponse.json({
    code: 0,
    data: {
      items: itemsWithStats,
      pagination: { total, page, size, pages: Math.ceil(total / size) },
    },
    message: 'ok',
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { batchCode, materialId, typeId, quantity, totalCost, costAllocMethod, supplierId, purchaseDate, notes } = body;
  try {
    const batch = await db.batch.create({
      data: { batchCode, materialId, typeId, quantity, totalCost, costAllocMethod, supplierId, purchaseDate, notes },
    });
    return NextResponse.json({ code: 0, data: batch, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      return NextResponse.json({ code: 400, data: null, message: '批次编号已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
