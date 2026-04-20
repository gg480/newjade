import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.dictMaterial.findUnique({ where: { id: parseInt(id) } });
  if (!item) return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });
  return NextResponse.json({ code: 0, data: item, message: 'ok' });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const data = {
      ...body,
      name: typeof body?.name === 'string' ? body.name.trim() : body?.name,
      subType: typeof body?.subType === 'string' ? (body.subType.trim() || null) : body?.subType,
    };
    const item = await db.dictMaterial.update({
      where: { id: parseInt(id) },
      data,
    });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      return NextResponse.json({ code: 400, data: null, message: '材质名称+子类已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Check if used by items or batches
    const itemCount = await db.item.count({ where: { materialId: parseInt(id), isDeleted: false } });
    const batchCount = await db.batch.count({ where: { materialId: parseInt(id) } });
    if (itemCount > 0 || batchCount > 0) {
      await db.dictMaterial.update({ where: { id: parseInt(id) }, data: { isActive: false } });
      return NextResponse.json({ code: 0, data: null, message: '已停用（有关联数据，无法删除）' });
    }
    await db.dictMaterial.update({ where: { id: parseInt(id) }, data: { isActive: false } });
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
