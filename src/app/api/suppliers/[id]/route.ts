import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const item = await db.supplier.update({ where: { id: parseInt(id) }, data: body });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplierId = parseInt(id);
  try {
    // Check if any items reference this supplier
    const itemCount = await db.item.count({ where: { supplierId } });
    if (itemCount > 0) {
      return NextResponse.json({
        code: 400,
        data: null,
        message: `该供应商下有 ${itemCount} 件关联商品，无法删除。请先转移或删除相关商品。`,
      }, { status: 400 });
    }
    // Also check batches
    const batchCount = await db.batch.count({ where: { supplierId } });
    if (batchCount > 0) {
      return NextResponse.json({
        code: 400,
        data: null,
        message: `该供应商下有 ${batchCount} 个关联批次，无法删除。请先转移或删除相关批次。`,
      }, { status: 400 });
    }
    await db.supplier.update({ where: { id: supplierId }, data: { isActive: false } });
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
