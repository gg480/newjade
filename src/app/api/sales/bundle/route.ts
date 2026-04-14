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

  if (!itemIds || itemIds.length < 2) {
    return NextResponse.json({ code: 400, data: null, message: '套装至少2件货品' }, { status: 400 });
  }

  // Validate all items
  const items = await db.item.findMany({ where: { id: { in: itemIds } } });
  const notInStock = items.filter(i => i.status !== 'in_stock' || i.isDeleted);
  if (notInStock.length > 0) {
    return NextResponse.json({ code: 400, data: null, message: `以下货品不在库: ${notInStock.map(i => i.skuCode).join(', ')}` }, { status: 400 });
  }

  // Allocate total price
  const allocations: { itemId: number; price: number }[] = [];

  if (allocMethod === 'by_ratio') {
    const totalSelling = items.reduce((sum, i) => sum + i.sellingPrice, 0);
    let allocated = 0;
    items.forEach((item, i) => {
      if (i === items.length - 1) {
        allocations.push({ itemId: item.id, price: Math.round((totalPrice - allocated) * 100) / 100 });
      } else {
        const price = Math.round((item.sellingPrice / totalSelling) * totalPrice * 100) / 100;
        allocated += price;
        allocations.push({ itemId: item.id, price });
      }
    });
  } else if (allocMethod === 'chain_at_cost') {
    // Chain items at selling_price, remainder to main item
    const isChain = chainItems || itemIds.map(() => false);
    let chainTotal = 0;
    items.forEach((item, i) => {
      if (isChain[i]) {
        chainTotal += item.sellingPrice;
        allocations.push({ itemId: item.id, price: item.sellingPrice });
      }
    });
    const mainItemIndices = items.map((_, i) => i).filter(i => !isChain[i]);
    const mainTotal = totalPrice - chainTotal;
    if (mainItemIndices.length > 0) {
      const mainSelling = mainItemIndices.reduce((sum, i) => sum + items[i].sellingPrice, 0);
      let allocated = 0;
      mainItemIndices.forEach((idx, j) => {
        if (j === mainItemIndices.length - 1) {
          allocations[idx] = { itemId: items[idx].id, price: Math.round((mainTotal - allocated) * 100) / 100 };
        } else {
          const price = Math.round((items[idx].sellingPrice / mainSelling) * mainTotal * 100) / 100;
          allocated += price;
          allocations[idx] = { itemId: items[idx].id, price };
        }
      });
    }
  }

  // Create bundle sale + sale records + update items
  const bundleNo = await generateBundleNo();
  const saleNo = await generateSaleNo();

  const bundle = await db.bundleSale.create({
    data: {
      bundleNo,
      totalPrice,
      allocMethod,
      saleDate,
      channel,
      customerId,
      note,
    },
  });

  for (const alloc of allocations) {
    const seq = allocations.indexOf(alloc) + 1;
    await db.saleRecord.create({
      data: {
        saleNo: `${saleNo.slice(0, -3)}${String(seq).padStart(3, '0')}`,
        itemId: alloc.itemId,
        actualPrice: alloc.price,
        channel,
        saleDate,
        customerId,
        bundleId: bundle.id,
      },
    });
    await db.item.update({ where: { id: alloc.itemId }, data: { status: 'sold' } });
  }

  return NextResponse.json({ code: 0, data: { bundle, allocations }, message: '套装销售完成' });
}
