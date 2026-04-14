import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const item = await db.dictType.update({ where: { id: parseInt(id) }, data: body });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const itemCount = await db.item.count({ where: { typeId: parseInt(id), isDeleted: false } });
    if (itemCount > 0) {
      await db.dictType.update({ where: { id: parseInt(id) }, data: { isActive: false } });
      return NextResponse.json({ code: 0, data: null, message: '已停用（有关联货品）' });
    }
    await db.dictType.update({ where: { id: parseInt(id) }, data: { isActive: false } });
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
