import { NextResponse } from 'next/server';
import * as salesService from '@/services/sales.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function salesGET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = await salesService.getSales({
    page: parseInt(searchParams.get('page') || '1'),
    size: parseInt(searchParams.get('size') || '20'),
    channel: searchParams.get('channel'),
    startDate: searchParams.get('start_date'),
    endDate: searchParams.get('end_date'),
    customerId: searchParams.get('customer_id'),
    unlinkedOnly: searchParams.get('unlinked_only') === 'true',
    keyword: searchParams.get('keyword'),
    itemKeyword: searchParams.get('item_keyword'),
    minAmount: searchParams.get('min_amount'),
    maxAmount: searchParams.get('max_amount'),
    includeReturned: searchParams.get('include_returned') === 'true',
    sortBy: searchParams.get('sort_by') || 'sale_date',
    sortOrder: searchParams.get('sort_order') || 'desc',
  });

  return NextResponse.json({
    code: 0,
    data: result,
    message: 'ok',
  });
}

async function salesPOST(req: Request) {
  const body = await req.json();
  const { itemId, actualPrice, channel, saleDate, customerId, note } = body;
  const parsedItemId = parseInt(itemId);
  const parsedActualPrice = parseFloat(actualPrice);
  const parsedCustomerId = customerId ? parseInt(customerId) : null;

  // 参数校验（route 层职责）
  if (!itemId || isNaN(parsedItemId)) {
    return NextResponse.json({ code: 400, data: null, message: '缺少货品ID' }, { status: 400 });
  }
  if (actualPrice === '' || actualPrice === undefined || actualPrice === null || isNaN(parsedActualPrice)) {
    return NextResponse.json({ code: 400, data: null, message: '请输入有效的成交价' }, { status: 400 });
  }
  if (!channel) {
    return NextResponse.json({ code: 400, data: null, message: '请选择销售渠道' }, { status: 400 });
  }
  const normalizedSaleDate = salesService.normalizeDateInput(saleDate);
  if (!normalizedSaleDate) {
    return NextResponse.json({ code: 400, data: null, message: '请选择销售日期' }, { status: 400 });
  }

  const record = await salesService.createSale({
    itemId: parsedItemId,
    actualPrice: parsedActualPrice,
    channel,
    saleDate: normalizedSaleDate,
    customerId: parsedCustomerId,
    note,
  });

  return NextResponse.json({ code: 0, data: record, message: 'ok' });
}

export const GET = withApiLogging('sales:GET', salesGET);
export const POST = withApiLogging('sales:POST', salesPOST);
