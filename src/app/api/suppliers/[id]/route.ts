import { NextResponse } from 'next/server';
import { NotFoundError } from '@/lib/errors';
import * as supplierService from '@/services/supplier.service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const item = await supplierService.getSupplier(parseInt(id));
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json(
        { code: e.code, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    return NextResponse.json(
      { code: 500, data: null, message: '查询失败' },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  try {
    const item = await supplierService.updateSupplier(parseInt(id), body);
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: '更新失败' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await supplierService.deleteSupplier(parseInt(id));
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '删除失败';
    // 业务规则拒绝（有关联数据）→ 400；其他异常 → 500
    const isBusinessRule = msg.includes('无法删除');
    return NextResponse.json(
      { code: isBusinessRule ? 400 : 500, data: null, message: msg },
      { status: isBusinessRule ? 400 : 500 },
    );
  }
}
