import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

function normalizeSaleDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const raw = String(dateStr).trim();
  const m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return '';
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[3], 10)).padStart(2, '0')}`;
}

function normalizeDateInput(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[年./]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '');
  const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[3], 10)).padStart(2, '0')}`;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

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
  const keyword = searchParams.get('keyword');
  const includeReturned = searchParams.get('include_returned') === 'true';
  const sortBy = searchParams.get('sort_by') || 'sale_date';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  const where: any = {};
  if (channel) where.channel = channel;
  if (customerId) where.customerId = parseInt(customerId);
  if (keyword) {
    where.OR = [
      { saleNo: { contains: keyword } },
      { item: { is: { skuCode: { contains: keyword } } } },
      { item: { is: { name: { contains: keyword } } } },
      { customer: { is: { name: { contains: keyword } } } },
      { customer: { is: { phone: { contains: keyword } } } },
    ];
  }
  // By default, sales list excludes records that already have a return record.
  // Pass include_returned=true for full history scenarios.
  if (!includeReturned) {
    where.saleReturns = { none: {} };
  }

  const direction = sortOrder === 'asc' ? 'asc' : 'desc';
  const orderByMap: Record<string, any> = {
    created_at: { createdAt: direction },
    sale_no: { saleNo: direction },
    sale_date: { saleDate: direction },
    channel: { channel: direction },
    actual_price: { actualPrice: direction },
    item_sku: { item: { skuCode: direction } },
    item_name: { item: { name: direction } },
    customer_name: { customer: { name: direction } },
  };
  const orderBy = orderByMap[sortBy] || orderByMap.created_at;

  const include = { item: { include: { material: true, type: true } }, customer: true, bundle: true } as const;
  let total = 0;
  let records: any[] = [];

  // Date fields in historical data contain both YYYY-MM-DD and YYYY/M/D.
  // For date filtering, normalize and filter in memory to ensure correctness.
  if (startDate || endDate) {
    const all = await db.saleRecord.findMany({
      where,
      include,
    });

    const startNorm = normalizeSaleDate(startDate);
    const endNorm = normalizeSaleDate(endDate);
    const filtered = all.filter((r: any) => {
      const d = normalizeSaleDate(r.saleDate);
      if (!d) return false;
      if (startNorm && d < startNorm) return false;
      if (endNorm && d > endNorm) return false;
      return true;
    });

    const sorted = filtered.sort((a: any, b: any) => {
      const dir = direction === 'asc' ? 1 : -1;
      const cmpStr = (x: string, y: string) => x.localeCompare(y) * dir;
      const cmpNum = (x: number, y: number) => (x - y) * dir;
      switch (sortBy) {
        case 'sale_no': return cmpStr(a.saleNo || '', b.saleNo || '');
        case 'sale_date': return cmpStr(normalizeSaleDate(a.saleDate), normalizeSaleDate(b.saleDate));
        case 'channel': return cmpStr(a.channel || '', b.channel || '');
        case 'actual_price': return cmpNum(a.actualPrice || 0, b.actualPrice || 0);
        case 'item_sku': return cmpStr(a.item?.skuCode || '', b.item?.skuCode || '');
        case 'item_name': return cmpStr(a.item?.name || '', b.item?.name || '');
        case 'customer_name': return cmpStr(a.customer?.name || '', b.customer?.name || '');
        case 'created_at':
        default:
          return cmpStr(String(a.createdAt || ''), String(b.createdAt || ''));
      }
    });

    total = sorted.length;
    records = sorted.slice((page - 1) * size, (page - 1) * size + size);
  } else {
    total = await db.saleRecord.count({ where });
    records = await db.saleRecord.findMany({
      where,
      include,
      orderBy,
      skip: (page - 1) * size,
      take: size,
    });
  }

  const items = records.map(r => ({
    ...r,
    itemSku: r.item?.skuCode,
    itemName: r.item?.name,
    customerName: r.customer?.name,
    customerPhone: r.customer?.phone,
    materialName: r.item?.material?.name,
    typeName: r.item?.type?.name,
    counter: r.item?.counter,
    costPrice: r.item?.allocatedCost ?? r.item?.costPrice ?? 0,
    // Keep backward-compatible field for existing callers.
    cost: r.item?.allocatedCost ?? r.item?.costPrice ?? 0,
    grossProfit: r.actualPrice - (r.item?.allocatedCost ?? r.item?.costPrice ?? 0),
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
    const parsedItemId = parseInt(itemId);
    const parsedActualPrice = parseFloat(actualPrice);
    const parsedCustomerId = customerId ? parseInt(customerId) : null;

    // Validate required fields
    if (!itemId || isNaN(parsedItemId)) {
      return NextResponse.json({ code: 400, data: null, message: '缺少货品ID' }, { status: 400 });
    }
    if (actualPrice === '' || actualPrice === undefined || actualPrice === null || isNaN(parsedActualPrice)) {
      return NextResponse.json({ code: 400, data: null, message: '请输入有效的成交价' }, { status: 400 });
    }
    if (!channel) {
      return NextResponse.json({ code: 400, data: null, message: '请选择销售渠道' }, { status: 400 });
    }
    const normalizedSaleDate = normalizeDateInput(saleDate);
    if (!normalizedSaleDate) {
      return NextResponse.json({ code: 400, data: null, message: '请选择销售日期' }, { status: 400 });
    }

    // Validate item
    const item = await db.item.findUnique({ where: { id: parsedItemId } });
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
        data: { saleNo, itemId: parsedItemId, actualPrice: parsedActualPrice, channel, saleDate: normalizedSaleDate, customerId: parsedCustomerId, note },
      });

      await tx.item.update({ where: { id: parsedItemId }, data: { status: 'sold' } });

      return sale;
    });

    // Log sell_item (outside transaction - not critical)
    await logAction('sell_item', 'sale', record.id, {
      saleNo,
      itemSku: item.skuCode,
      actualPrice: parsedActualPrice,
      channel,
      saleDate: normalizedSaleDate,
    });

    return NextResponse.json({ code: 0, data: record, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `销售失败: ${e.message}` }, { status: 500 });
  }
}
