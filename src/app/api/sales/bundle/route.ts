import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

async function generateBundleNo(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `b${today}`;
  const last = await db.bundleSale.findFirst({
    where: { bundleNo: { startsWith: prefix } },
    orderBy: { bundleNo: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.bundleNo.slice(-3));
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { itemIds, totalPrice, allocMethod, channel, saleDate, customerId, note, chainItems } = body;
  const allowedAllocMethods = new Set(['by_ratio', 'chain_at_cost']);
  const parsedTotalPrice = parseFloat(totalPrice);
  const parsedCustomerId = customerId && customerId !== 'none' ? parseInt(customerId) : null;
  const parsedItemIds = Array.isArray(itemIds) ? itemIds.map((id: any) => parseInt(id)) : [];

  if (!itemIds || itemIds.length < 2) {
    return NextResponse.json({ code: 400, data: null, message: '套装至少2件货品' }, { status: 400 });
  }
  if (isNaN(parsedTotalPrice) || parsedTotalPrice <= 0) {
    return NextResponse.json({ code: 400, data: null, message: '请输入有效的套装总价' }, { status: 400 });
  }
  if (parsedItemIds.some((id: number) => isNaN(id))) {
    return NextResponse.json({ code: 400, data: null, message: '货品ID无效' }, { status: 400 });
  }
  if (!allowedAllocMethods.has(allocMethod)) {
    return NextResponse.json({ code: 400, data: null, message: '不支持的套装分摊方式' }, { status: 400 });
  }
  if (!channel) {
    return NextResponse.json({ code: 400, data: null, message: '请选择销售渠道' }, { status: 400 });
  }
  if (!saleDate) {
    return NextResponse.json({ code: 400, data: null, message: '请选择销售日期' }, { status: 400 });
  }

  // Validate all items
  const uniqueItemIds = Array.from(new Set(parsedItemIds));
  const items = await db.item.findMany({ where: { id: { in: uniqueItemIds } } });
  if (items.length !== uniqueItemIds.length) {
    return NextResponse.json({ code: 400, data: null, message: '存在无效货品ID，请刷新后重试' }, { status: 400 });
  }
  const notInStock = items.filter(i => i.status !== 'in_stock' || i.isDeleted);
  if (notInStock.length > 0) {
    return NextResponse.json({ code: 400, data: null, message: `以下货品不在库: ${notInStock.map(i => i.skuCode).join(', ')}` }, { status: 400 });
  }

  // Allocate total price
  const allocations: { itemId: number; price: number }[] = [];

  if (allocMethod === 'by_ratio') {
    const totalSelling = items.reduce((sum, i) => sum + i.sellingPrice, 0);
    if (totalSelling <= 0) {
      return NextResponse.json({ code: 400, data: null, message: '按比例分摊失败：货品售价合计必须大于0' }, { status: 400 });
    }
    let allocated = 0;
    items.forEach((item, i) => {
      if (i === items.length - 1) {
        allocations.push({ itemId: item.id, price: Math.round((parsedTotalPrice - allocated) * 100) / 100 });
      } else {
        const price = Math.round((item.sellingPrice / totalSelling) * parsedTotalPrice * 100) / 100;
        allocated += price;
        allocations.push({ itemId: item.id, price });
      }
    });
  } else if (allocMethod === 'chain_at_cost') {
    // Chain items at selling_price, remainder to main item
    const isChain = Array.isArray(chainItems) ? chainItems : uniqueItemIds.map(() => false);
    if (isChain.length !== items.length) {
      return NextResponse.json({ code: 400, data: null, message: '链件标记数量与货品数量不一致' }, { status: 400 });
    }
    let chainTotal = 0;
    items.forEach((item, i) => {
      if (isChain[i]) {
        chainTotal += item.sellingPrice;
        allocations.push({ itemId: item.id, price: item.sellingPrice });
      }
    });
    const mainItemIndices = items.map((_, i) => i).filter(i => !isChain[i]);
    const mainTotal = parsedTotalPrice - chainTotal;
    if (mainItemIndices.length > 0) {
      const mainSelling = mainItemIndices.reduce((sum, i) => sum + items[i].sellingPrice, 0);
      let allocated = 0;
      mainItemIndices.forEach((idx, j) => {
        if (j === mainItemIndices.length - 1) {
          allocations.push({ itemId: items[idx].id, price: Math.round((mainTotal - allocated) * 100) / 100 });
        } else {
          const price = Math.round((items[idx].sellingPrice / mainSelling) * mainTotal * 100) / 100;
          allocated += price;
          allocations.push({ itemId: items[idx].id, price });
        }
      });
    }
  }

  if (allocations.length !== items.length) {
    return NextResponse.json({ code: 400, data: null, message: '套装分摊失败：部分货品未分配价格' }, { status: 400 });
  }

  // Create bundle sale + sale records + update items
  const bundleNo = await generateBundleNo();
  const saleNo = await generateSaleNo();
  const result = await db.$transaction(async tx => {
    const bundle = await tx.bundleSale.create({
      data: {
        bundleNo,
        totalPrice: parsedTotalPrice,
        allocMethod,
        saleDate,
        channel,
        customerId: parsedCustomerId,
        note,
      },
    });

    for (const [index, alloc] of allocations.entries()) {
      const seq = index + 1;
      await tx.saleRecord.create({
        data: {
          saleNo: `${saleNo.slice(0, -3)}${String(seq).padStart(3, '0')}`,
          itemId: alloc.itemId,
          actualPrice: alloc.price,
          channel,
          saleDate,
          customerId: parsedCustomerId,
          bundleId: bundle.id,
        },
      });
      await tx.item.update({ where: { id: alloc.itemId }, data: { status: 'sold' } });
    }

    return bundle;
  });

  return NextResponse.json({ code: 0, data: { bundle: result, allocations }, message: '套装销售完成' });
}
