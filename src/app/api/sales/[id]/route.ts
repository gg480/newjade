import { NextResponse } from 'next/server';
import * as salesService from '@/services/sales.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { guardPermission } from '@/lib/api/permission-guard';

async function saleByIdPUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, 'action:sale_edit');
  if (denied) return denied;
  const { id } = await params;
  const saleId = parseInt(id);
  if (isNaN(saleId)) {
    return NextResponse.json({ code: 400, data: null, message: '销售记录ID无效' }, { status: 400 });
  }

  const body = await req.json();
  const { actualPrice, channel, saleDate, customerId, note } = body;
  const parsedActualPrice = parseFloat(actualPrice);
  const parsedCustomerId = customerId ? parseInt(customerId) : null;

  // 参数校验（route 层职责）
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
  if (customerId && isNaN(parsedCustomerId as number)) {
    return NextResponse.json({ code: 400, data: null, message: '客户ID无效' }, { status: 400 });
  }

  const updated = await salesService.updateSale(saleId, {
    actualPrice: parsedActualPrice,
    channel,
    saleDate: normalizedSaleDate,
    customerId: parsedCustomerId,
    note: note ?? null,
  });

  return NextResponse.json({ code: 0, data: updated, message: '销售记录已更新' });
}

export const PUT = withApiLogging('sales/[id]:PUT', saleByIdPUT);
