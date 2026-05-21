import { NextResponse } from 'next/server';
import * as salesService from '@/services/sales.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function returnSalePOST(req: Request) {
  const body = await req.json();
  const { saleId, refundAmount, returnReason, returnDate } = body;
  const parsedSaleId = parseInt(saleId);
  const parsedRefundAmount = refundAmount != null ? parseFloat(refundAmount) : undefined;

  // 参数校验（route 层职责）
  if (!saleId || isNaN(parsedSaleId)) {
    return NextResponse.json({ code: 400, data: null, message: '缺少 saleId' }, { status: 400 });
  }
  if (parsedRefundAmount !== undefined && isNaN(parsedRefundAmount)) {
    return NextResponse.json({ code: 400, data: null, message: '退款金额无效' }, { status: 400 });
  }

  const returnRecord = await salesService.processReturn({
    saleId: parsedSaleId,
    refundAmount: parsedRefundAmount,
    returnReason,
    returnDate,
  });

  return NextResponse.json({ code: 0, data: returnRecord, message: '退货成功' });
}

export const POST = withApiLogging('sales/return:POST', returnSalePOST);
