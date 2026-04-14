import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await db.batch.findUnique({
    where: { id: parseInt(id) },
    include: { material: true, type: true, supplier: true },
  });
  if (!batch) return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });

  const stats = await getBatchStats(batch.id, batch);
  const items = await db.item.findMany({
    where: { batchId: batch.id, isDeleted: false },
    include: { material: true, type: true, spec: true, tags: true, images: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    code: 0,
    data: {
      ...batch,
      materialName: batch.material?.name,
      typeName: batch.type?.name,
      supplierName: batch.supplier?.name,
      ...stats,
      items,
    },
    message: 'ok',
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const batch = await db.batch.update({ where: { id: parseInt(id) }, data: body });
    return NextResponse.json({ code: 0, data: batch, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Check if batch has sold items
    const soldCount = await db.item.count({ where: { batchId: parseInt(id), status: 'sold', isDeleted: false } });
    if (soldCount > 0) {
      return NextResponse.json({ code: 400, data: null, message: `该批次已有 ${soldCount} 件已售出货品，无法删除` }, { status: 400 });
    }
    // Unlink associated items (set batchId to null)
    await db.item.updateMany({ where: { batchId: parseInt(id) }, data: { batchId: null, batchCode: null } });
    await db.batch.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ code: 0, data: null, message: '删除成功' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
