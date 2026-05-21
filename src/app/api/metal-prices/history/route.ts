import { NextResponse } from 'next/server';
import { getPriceHistory } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function priceHistoryGET(req: Request) {
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('material_id');
  const limit = parseInt(searchParams.get('limit') || '20');

  const data = await getPriceHistory({ materialId, limit });
  return NextResponse.json({ code: 0, data, message: 'ok' });
}

export const GET = withApiLogging('metal-prices/history:GET', priceHistoryGET);
