import { NextResponse } from 'next/server';
import { getPriceHistory } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function priceHistoryGET(req: Request) {
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('material_id');
  const materialIdsParam = searchParams.get('material_ids');
  const materialIds = materialIdsParam
    ? materialIdsParam.split(',').map(Number).filter(n => !isNaN(n))
    : undefined;
  const startDate = searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('end_date') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const data = await getPriceHistory({ materialId, materialIds, startDate, endDate, page, pageSize });
  return NextResponse.json({ code: 0, data, message: 'ok' });
}

export const GET = withApiLogging('metal-prices/history:GET', priceHistoryGET);
