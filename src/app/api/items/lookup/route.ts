import { NextResponse } from 'next/server';
import { lookupItemBySku } from '@/services/items-extra.service';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';

// Lookup item by SKU code (for scan-to-sell)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sku = searchParams.get('sku');

  if (!sku) {
    return NextResponse.json({ code: 400, data: null, message: '请提供SKU码' }, { status: 400 });
  }

  try {
    const data = await lookupItemBySku(sku);
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e: unknown) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: e.message }, { status: 404 });
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ code: 409, data: { skuCode: sku, status: '' }, message: e.message }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : '查询失败';
    return NextResponse.json({ code: 500, data: null, message }, { status: 500 });
  }
}
