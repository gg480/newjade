import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import * as batchesService from '@/services/batches.service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await batchesService.getBatchById(parseInt(id));
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '获取失败' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const batch = await batchesService.updateBatch(parseInt(id), body);
    return NextResponse.json({ code: 0, data: batch, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await batchesService.deleteBatch(parseInt(id));
    return NextResponse.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
