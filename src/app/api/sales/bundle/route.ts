import { NextResponse } from 'next/server';
import * as salesService from '@/services/sales.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function bundleSalePOST(req: Request) {
  const body = await req.json();
  const { itemIds, totalPrice, allocMethod, channel, saleDate, customerId, note, chainItems } = body;
  const parsedTotalPrice = parseFloat(totalPrice);
  const parsedCustomerId = customerId && customerId !== 'none' ? parseInt(customerId) : null;
  const parsedItemIds = Array.isArray(itemIds) ? itemIds.map((id: string) => parseInt(id)) : [];

  // 参数校验（route 层职责）
  if (!itemIds || itemIds.length < 2) {
    return NextResponse.json({ code: 400, data: null, message: '套装至少2件货品' }, { status: 400 });
  }
  if (isNaN(parsedTotalPrice) || parsedTotalPrice <= 0) {
    return NextResponse.json({ code: 400, data: null, message: '请输入有效的套装总价' }, { status: 400 });
  }
  if (parsedItemIds.some((id: number) => isNaN(id))) {
    return NextResponse.json({ code: 400, data: null, message: '货品ID无效' }, { status: 400 });
  }
  if (!channel) {
    return NextResponse.json({ code: 400, data: null, message: '请选择销售渠道' }, { status: 400 });
  }
  if (!saleDate) {
    return NextResponse.json({ code: 400, data: null, message: '请选择销售日期' }, { status: 400 });
  }

  const result = await salesService.createBundleSale({
    itemIds: parsedItemIds,
    totalPrice: parsedTotalPrice,
    allocMethod,
    channel,
    saleDate,
    customerId: parsedCustomerId,
    note,
    chainItems,
  });

  return NextResponse.json({ code: 0, data: result, message: '套装销售完成' });
}

export const POST = withApiLogging('sales/bundle:POST', bundleSalePOST);
