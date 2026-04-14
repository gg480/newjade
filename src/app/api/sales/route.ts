import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

// Auto-generate sale number
async function generateSaleNo(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `s${today}`;
  const lastSale = await db.saleRecord.findFirst({
    where: { saleNo: { startsWith: prefix } },
    orderBy: { saleNo: 'desc' },
  });
  let seq = 1;
  if (lastSale) {
    const lastSeq = parseInt(lastSale.saleNo.slice(-3));
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const channel = searchParams.get('channel');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const customerId = searchParams.get('customer_id');

  const where: any = {};
  if (channel) where.channel = channel;
  if (startDate) where.saleDate = { ...where.saleDate, gte: startDate };
  if (endDate) where.saleDate = { ...where.saleDate, lte: endDate };
  if (customerId) where.customerId = parseInt(customerId);

  const total = await db.saleRecord.count({ where });
  const records = await db.saleRecord.findMany({
    where,
    include: { item: { include: { material: true } }, customer: true, bundle: true },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * size,
    take: size,
  });

  const items = records.map(r => ({
    ...r,
    itemSku: r.item?.skuCode,
    itemName: r.item?.name,
    customerName: r.customer?.name,
    cost: r.item?.allocatedCost || r.item?.costPrice || 0,
    grossProfit: r.actualPrice - (r.item?.allocatedCost || r.item?.costPrice || 0),
  }));

  return NextResponse.json({
    code: 0,
    data: { items, pagination: { total, page, size, pages: Math.ceil(total / size) } },
    message: 'ok',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { itemId, actualPrice, channel, saleDate, customerId, note } = body;

    // Validate item
    const item = await db.item.findUnique({ where: { id: itemId } });
    if (!item || item.isDeleted) {
      return NextResponse.json({ code: 400, data: null, message: '货品不存在' }, { status: 400 });
    }
    if (item.status !== 'in_stock') {
      return NextResponse.json({ code: 400, data: null, message: '货品不在库，无法出售' }, { status: 400 });
    }

    const saleNo = await generateSaleNo();

    // Use transaction for atomicity: create sale + update item status
    const record = await db.$transaction(async (tx) => {
      const sale = await tx.saleRecord.create({
        data: { saleNo, itemId, actualPrice, channel, saleDate, customerId, note },
      });

      await tx.item.update({ where: { id: itemId }, data: { status: 'sold' } });

      return sale;
    });

    // Log sell_item (outside transaction - not critical)
    await logAction('sell_item', 'sale', record.id, {
      saleNo,
      itemSku: item.skuCode,
      actualPrice,
      channel,
      saleDate,
    });

    return NextResponse.json({ code: 0, data: record, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `销售失败: ${e.message}` }, { status: 500 });
  }
}
