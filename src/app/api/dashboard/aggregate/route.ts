import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || new Date().toISOString().slice(0, 10);
  const agingDays = parseInt(searchParams.get('aging_days') || '90');
  const months = parseInt(searchParams.get('months') || '12');
  const limit = parseInt(searchParams.get('limit') || '5');

  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    // ========== 1. Summary ==========
    const [totalItems, inStockItems, monthSales, soldCount, returnedCount] = await Promise.all([
      db.item.count({ where: { status: 'in_stock', isDeleted: false } }),
      db.item.findMany({
        where: { status: 'in_stock', isDeleted: false },
        select: { costPrice: true, allocatedCost: true },
      }),
      db.saleRecord.findMany({
        where: { saleDate: { gte: monthStart } },
        include: { item: true },
      }),
      db.item.count({ where: { status: 'sold', isDeleted: false } }),
      db.item.count({ where: { status: 'returned', isDeleted: false } }),
    ]);

    const totalStockValue = inStockItems.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);
    const monthRevenue = monthSales.reduce((sum, s) => sum + s.actualPrice, 0);
    const monthProfit = monthSales.reduce((sum, s) => {
      const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
      return sum + (s.actualPrice - cost);
    }, 0);

    const summary = {
      totalItems,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      monthRevenue: Math.round(monthRevenue * 100) / 100,
      monthProfit: Math.round(monthProfit * 100) / 100,
      monthSoldCount: monthSales.length,
      statusCounts: { inStock: totalItems, sold: soldCount, returned: returnedCount },
    };

    // ========== 2. Batch Profit ==========
    const batches = await db.batch.findMany({
      include: { material: true, items: { where: { isDeleted: false }, include: { saleRecords: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const batchProfit = batches.map(b => {
      const soldItems = b.items.filter(i => i.status === 'sold');
      const soldCount = soldItems.length;
      const revenue = soldItems.reduce((sum, item) => {
        return sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0);
      }, 0);
      const profit = revenue - b.totalCost;
      const paybackRate = b.totalCost > 0 ? revenue / b.totalCost : 0;

      let batchStatus = 'new';
      if (soldCount === 0) batchStatus = 'new';
      else if (soldCount === b.quantity) batchStatus = 'cleared';
      else if (paybackRate >= 1) batchStatus = 'paid_back';
      else batchStatus = 'selling';

      return {
        batchCode: b.batchCode,
        materialName: b.material?.name,
        totalCost: b.totalCost,
        quantity: b.quantity,
        soldCount,
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        paybackRate: Math.round(paybackRate * 1000) / 1000,
        status: batchStatus,
      };
    });

    // ========== 3. Stock Aging ==========
    const allInStockItems = await db.item.findMany({
      where: { status: 'in_stock', isDeleted: false, purchaseDate: { not: null } },
      include: { material: true, type: true },
    });

    const agingItems = allInStockItems
      .map(item => {
        const ageDays = item.purchaseDate
          ? Math.floor((now.getTime() - new Date(item.purchaseDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return { ...item, ageDays };
      })
      .filter(item => item.ageDays >= agingDays)
      .sort((a, b) => b.ageDays - a.ageDays);

    const agingTotalValue = agingItems.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);

    const stockAging = {
      items: agingItems.map(item => ({
        itemId: item.id,
        skuCode: item.skuCode,
        name: item.name,
        batchCode: item.batchCode,
        materialName: item.material?.name,
        typeName: item.type?.name,
        costPrice: item.costPrice,
        allocatedCost: item.allocatedCost,
        sellingPrice: item.sellingPrice,
        purchaseDate: item.purchaseDate,
        ageDays: item.ageDays,
        counter: item.counter,
      })),
      totalItems: agingItems.length,
      totalValue: Math.round(agingTotalValue * 100) / 100,
    };

    // ========== 4. Top Sellers ==========
    const soldSaleRecords = await db.saleRecord.findMany({
      include: { item: { include: { material: true, type: true } } },
      orderBy: { actualPrice: 'desc' },
    });

    const itemMap = new Map<number, any>();
    for (const sale of soldSaleRecords) {
      const item = sale.item;
      if (!item) continue;
      const cost = item.allocatedCost || item.costPrice || 0;
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, {
          itemId: item.id,
          name: item.name || item.skuCode,
          skuCode: item.skuCode,
          materialName: item.material?.name || '-',
          typeName: item.type?.name || '-',
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          salesCount: 0,
        });
      }
      const entry = itemMap.get(item.id)!;
      entry.totalRevenue += sale.actualPrice;
      entry.totalCost += cost;
      entry.totalProfit += sale.actualPrice - cost;
      entry.salesCount += 1;
    }

    const topSellers = Array.from(itemMap.values())
      .map(item => ({
        ...item,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        totalCost: Math.round(item.totalCost * 100) / 100,
        totalProfit: Math.round(item.totalProfit * 100) / 100,
        margin: item.totalRevenue > 0 ? Math.round((item.totalProfit / item.totalRevenue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, limit);

    // ========== 5. Month-over-Month Comparison ==========
    const thisMonthStart = monthStart;
    const thisMonthEnd = todayStr;
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    const [thisMonthSales, lastMonthSales, thisNewItems, lastNewItems] = await Promise.all([
      db.saleRecord.findMany({
        where: { saleDate: { gte: thisMonthStart, lte: thisMonthEnd } },
        include: { item: true },
      }),
      db.saleRecord.findMany({
        where: { saleDate: { gte: lastMonthStart, lte: lastMonthEnd } },
        include: { item: true },
      }),
      db.item.count({
        where: { createdAt: { gte: new Date(thisMonthStart), lte: new Date(thisMonthEnd + 'T23:59:59') }, isDeleted: false },
      }),
      db.item.count({
        where: { createdAt: { gte: new Date(lastMonthStart), lte: new Date(lastMonthEnd + 'T23:59:59') }, isDeleted: false },
      }),
    ]);

    const thisRevenue = thisMonthSales.reduce((sum, s) => sum + s.actualPrice, 0);
    const thisProfit = thisMonthSales.reduce((sum, s) => {
      const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
      return sum + (s.actualPrice - cost);
    }, 0);
    const lastRevenue = lastMonthSales.reduce((sum, s) => sum + s.actualPrice, 0);
    const lastProfit = lastMonthSales.reduce((sum, s) => {
      const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
      return sum + (s.actualPrice - cost);
    }, 0);

    const pctChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 10000) / 100;
    };

    const momData = {
      thisMonth: {
        revenue: Math.round(thisRevenue * 100) / 100,
        soldCount: thisMonthSales.length,
        profit: Math.round(thisProfit * 100) / 100,
        newItems: thisNewItems,
      },
      lastMonth: {
        revenue: Math.round(lastRevenue * 100) / 100,
        soldCount: lastMonthSales.length,
        profit: Math.round(lastProfit * 100) / 100,
        newItems: lastNewItems,
      },
      changes: {
        revenue: pctChange(thisRevenue, lastRevenue),
        soldCount: pctChange(thisMonthSales.length, lastMonthSales.length),
        profit: pctChange(thisProfit, lastProfit),
        newItems: pctChange(thisNewItems, lastNewItems),
      },
    };

    return NextResponse.json({
      code: 0,
      data: { summary, batchProfit, stockAging, topSellers, momData },
      message: 'ok',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: e.message }, { status: 500 });
  }
}
