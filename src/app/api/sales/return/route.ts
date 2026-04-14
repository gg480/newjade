import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

export async function POST(req: Request) {
  const body = await req.json();
  const { saleId, refundAmount, returnReason, returnDate } = body;

  if (!saleId) {
    return NextResponse.json({ code: 400, data: null, message: '缺少 saleId' }, { status: 400 });
  }

  // Validate sale exists
  const sale = await db.saleRecord.findUnique({
    where: { id: saleId },
    include: { item: true },
  });
  if (!sale) {
    return NextResponse.json({ code: 404, data: null, message: '销售记录不存在' }, { status: 404 });
  }

  // Check item status — should be sold
  if (sale.item.status !== 'sold') {
    return NextResponse.json(
      { code: 400, data: null, message: `货品当前状态为「${sale.item.status}」，无法退货` },
      { status: 400 },
    );
  }

  const today = returnDate || new Date().toISOString().slice(0, 10);
  const refund = refundAmount ?? sale.actualPrice;

  // Create return record
  const returnRecord = await db.saleReturn.create({
    data: {
      saleId,
      itemId: sale.itemId,
      refundAmount: refund,
      returnReason: returnReason || '客户退货',
      returnDate: today,
    },
  });

  // Change item status back to in_stock
  await db.item.update({
    where: { id: sale.itemId },
    data: { status: 'returned' },
  });

  // Log action
  await logAction('return_sale', 'sale', saleId, {
    saleNo: sale.saleNo,
    itemSku: sale.item.skuCode,
    refundAmount: refund,
    returnReason: returnReason || '客户退货',
    returnDate: today,
  });

  return NextResponse.json({ code: 0, data: returnRecord, message: '退货成功' });
}
