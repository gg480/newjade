import { NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const item = await dictsService.updateType(parseInt(id), body);
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e) {
    console.error('器型更新失败:', e);
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await dictsService.deleteType(parseInt(id));
    if (result.softDeleted && result.message) {
      return NextResponse.json({ code: 0, data: null, message: result.message });
    }
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    console.error('器型删除失败:', e);
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
