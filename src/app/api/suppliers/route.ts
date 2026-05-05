import { NextResponse } from 'next/server';
import * as supplierService from '@/services/supplier.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword') || undefined;
  const items = await supplierService.listSuppliers(keyword);

  return NextResponse.json({
    code: 0,
    data: {
      items,
      pagination: { total: items.length, page: 1, size: 100, pages: 1 },
    },
    message: 'ok',
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const item = await supplierService.createSupplier(body);
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建失败';
    return NextResponse.json(
      { code: 500, data: null, message: msg },
      { status: 500 },
    );
  }
}
