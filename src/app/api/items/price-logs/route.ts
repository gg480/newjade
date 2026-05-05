import { NextResponse } from 'next/server';
import { getPriceChangeLogs } from '@/services/items-extra.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('item_id') ? parseInt(searchParams.get('item_id')!) : undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const startDate = searchParams.get('start_date') ?? undefined;
  const endDate = searchParams.get('end_date') ?? undefined;

  try {
    const data = await getPriceChangeLogs({ itemId, page, size, startDate, endDate });

    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message: `获取调价记录失败: ${message}` }, { status: 500 });
  }
}
