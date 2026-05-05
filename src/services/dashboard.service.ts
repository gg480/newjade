import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// ─── 工具函数 ───────────────────────────────────────────────

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeSaleDate(input: string | null | undefined): string {
  if (!input) return '';
  const raw = String(input).trim();
  const m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return '';
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[3], 10)).padStart(2, '0')}`;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

// ─── 类型定义 ───────────────────────────────────────────────

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface AggregateParams {
  startDate?: string;
  endDate?: string;
  agingDays?: number;
  limit?: number;
  months?: number;
}

export interface DashboardSummary {
  totalItems: number;
  totalStockValue: number;
  monthRevenue: number;
  monthProfit: number;
  monthSoldCount: number;
  statusCounts?: { inStock: number; sold: number; returned: number };
}

export interface BatchProfitItem {
  batchCode: string;
  materialName?: string;
  totalCost: number;
  quantity: number;
  soldCount: number;
  revenue: number;
  profit: number;
  paybackRate: number;
  status: string;
}

export interface StockAgingResult {
  items: StockAgingItem[];
  totalItems: number;
  totalValue: number;
}

export interface StockAgingItem {
  itemId: number;
  skuCode: string;
  name?: string;
  batchCode?: string;
  materialName?: string;
  typeName?: string;
  costPrice?: number;
  allocatedCost?: number;
  sellingPrice?: number;
  purchaseDate?: string;
  ageDays: number;
  counter?: number;
}

export interface TopSellerItem {
  itemId: number;
  name: string;
  skuCode: string;
  materialName: string;
  typeName: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  salesCount: number;
  margin: number;
}

export interface MomComparison {
  thisMonth: { revenue: number; soldCount: number; profit: number; newItems: number };
  lastMonth: { revenue: number; soldCount: number; profit: number; newItems: number };
  changes: { revenue: number; soldCount: number; profit: number; newItems: number };
}

// ============================================================
// 核心方法
// ============================================================

/**
 * 综合仪表盘 — 聚合所有核心指标
 */
export async function getAggregate(params: AggregateParams = {}) {
  const {
    agingDays = 90,
    months = 12,
    limit = 5,
  } = params;

  const now = new Date();
  const todayStr = toLocalDateString(now);
  const monthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));

  // 1. Summary
  const [totalItems, inStockItems, allSales, soldCount, returnedCount] = await Promise.all([
    db.item.count({ where: { status: 'in_stock', isDeleted: false } }),
    db.item.findMany({
      where: { status: 'in_stock', isDeleted: false },
      select: { costPrice: true, allocatedCost: true },
    }),
    db.saleRecord.findMany({ include: { item: true } }),
    db.item.count({ where: { status: 'sold', isDeleted: false } }),
    db.item.count({ where: { status: 'returned', isDeleted: false } }),
  ]);

  const monthSales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= monthStart && d <= todayStr;
  });

  const totalStockValue = inStockItems.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.actualPrice, 0);
  const monthProfit = monthSales.reduce((sum, s) => {
    const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
    return sum + (s.actualPrice - cost);
  }, 0);

  const summary: DashboardSummary = {
    totalItems,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    monthRevenue: Math.round(monthRevenue * 100) / 100,
    monthProfit: Math.round(monthProfit * 100) / 100,
    monthSoldCount: monthSales.length,
    statusCounts: { inStock: totalItems, sold: soldCount, returned: returnedCount },
  };

  // 2. Batch Profit
  const batches = await db.batch.findMany({
    include: { material: true, items: { where: { isDeleted: false }, include: { saleRecords: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const batchProfit: BatchProfitItem[] = batches.map(b => {
    const soldItems = b.items.filter(i => i.status === 'sold');
    const sc = soldItems.length;
    const revenue = soldItems.reduce((sum, item) => {
      return sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0);
    }, 0);
    const profit = revenue - b.totalCost;
    const paybackRate = b.totalCost > 0 ? revenue / b.totalCost : 0;

    let batchStatus = 'new';
    if (sc === 0) batchStatus = 'new';
    else if (sc === b.quantity) batchStatus = 'cleared';
    else if (paybackRate >= 1) batchStatus = 'paid_back';
    else batchStatus = 'selling';

    return {
      batchCode: b.batchCode,
      materialName: b.material?.name,
      totalCost: b.totalCost,
      quantity: b.quantity,
      soldCount: sc,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      paybackRate: Math.round(paybackRate * 1000) / 1000,
      status: batchStatus,
    };
  });

  // 3. Stock Aging
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

  const stockAging: StockAgingResult = {
    items: agingItems.map(item => ({
      itemId: item.id,
      skuCode: item.skuCode,
      name: item.name ?? undefined,
      batchCode: item.batchCode ?? undefined,
      materialName: item.material?.name ?? undefined,
      typeName: item.type?.name ?? undefined,
      costPrice: item.costPrice ?? undefined,
      allocatedCost: item.allocatedCost ?? undefined,
      sellingPrice: item.sellingPrice ?? undefined,
      purchaseDate: item.purchaseDate ?? undefined,
      ageDays: item.ageDays,
      counter: item.counter ?? undefined,
    })),
    totalItems: agingItems.length,
    totalValue: Math.round(agingTotalValue * 100) / 100,
  };

  // 4. Top Sellers
  const soldSaleRecords = await db.saleRecord.findMany({
    include: { item: { include: { material: true, type: true } } },
    orderBy: { actualPrice: 'desc' },
  });

  const itemMap = new Map<number, TopSellerItem>();
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
        margin: 0,
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

  // 5. MoM Comparison
  const thisMonthStart = monthStart;
  const thisMonthEnd = todayStr;
  const lastMonthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0));

  const [thisNewItems, lastNewItems] = await Promise.all([
    db.item.count({
      where: { createdAt: { gte: new Date(thisMonthStart), lte: new Date(thisMonthEnd + 'T23:59:59') }, isDeleted: false },
    }),
    db.item.count({
      where: { createdAt: { gte: new Date(lastMonthStart), lte: new Date(lastMonthEnd + 'T23:59:59') }, isDeleted: false },
    }),
  ]);

  const thisMs = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= thisMonthStart && d <= thisMonthEnd;
  });
  const lastMs = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= lastMonthStart && d <= lastMonthEnd;
  });

  const thisRev = thisMs.reduce((sum, s) => sum + s.actualPrice, 0);
  const thisProf = thisMs.reduce((sum, s) => {
    const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
    return sum + (s.actualPrice - cost);
  }, 0);
  const lastRev = lastMs.reduce((sum, s) => sum + s.actualPrice, 0);
  const lastProf = lastMs.reduce((sum, s) => {
    const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
    return sum + (s.actualPrice - cost);
  }, 0);

  const momData: MomComparison = {
    thisMonth: {
      revenue: Math.round(thisRev * 100) / 100,
      soldCount: thisMs.length,
      profit: Math.round(thisProf * 100) / 100,
      newItems: thisNewItems,
    },
    lastMonth: {
      revenue: Math.round(lastRev * 100) / 100,
      soldCount: lastMs.length,
      profit: Math.round(lastProf * 100) / 100,
      newItems: lastNewItems,
    },
    changes: {
      revenue: pctChange(thisRev, lastRev),
      soldCount: pctChange(thisMs.length, lastMs.length),
      profit: pctChange(thisProf, lastProf),
      newItems: pctChange(thisNewItems, lastNewItems),
    },
  };

  return { summary, batchProfit, stockAging, topSellers, momData };
}

/**
 * 核心摘要 — 总库存值、月营收、月利润、月销量
 */
export async function getDashboardSummary(params: { agingDays?: number } = {}) {
  const now = new Date();
  const monthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayStr = toLocalDateString(now);

  const totalItems = await db.item.count({ where: { status: 'in_stock', isDeleted: false } });

  const inStockItems = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    select: { costPrice: true, allocatedCost: true },
  });
  const totalStockValue = inStockItems.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);

  const allSales = await db.saleRecord.findMany({ include: { item: true } });
  const monthSales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= monthStart && d <= todayStr;
  });
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.actualPrice, 0);
  const monthProfit = monthSales.reduce((sum, s) => {
    const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
    return sum + (s.actualPrice - cost);
  }, 0);

  const summary: DashboardSummary = {
    totalItems,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    monthRevenue: Math.round(monthRevenue * 100) / 100,
    monthProfit: Math.round(monthProfit * 100) / 100,
    monthSoldCount: monthSales.length,
  };

  return summary;
}

/**
 * 月度销售/利润趋势
 */
export async function getSalesTrend(params: { months?: number } = {}) {
  const months = params.months ?? 12;
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startDateStr = toLocalDateString(startDate);

  const allSales = await db.saleRecord.findMany({ include: { item: true } });
  const sales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= startDateStr;
  });

  const monthMap = new Map<string, { revenue: number; profit: number; salesCount: number }>();
  for (const sale of sales) {
    const month = normalizeSaleDate(sale.saleDate).slice(0, 7);
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    if (!monthMap.has(month)) {
      monthMap.set(month, { revenue: 0, profit: 0, salesCount: 0 });
    }
    const entry = monthMap.get(month)!;
    entry.revenue += sale.actualPrice;
    entry.profit += (sale.actualPrice - cost);
    entry.salesCount += 1;
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, e]) => ({
      yearMonth,
      revenue: Math.round(e.revenue * 100) / 100,
      profit: Math.round(e.profit * 100) / 100,
      salesCount: e.salesCount,
    }));
}

/**
 * 库存周转率
 */
export async function getInventoryTurnover(params: { months?: number } = {}) {
  const months = params.months ?? 6;
  const now = new Date();
  const allSales = await db.saleRecord.findMany({ include: { item: true } });

  const result: { yearMonth: string; cogs: number; avgInventoryValue: number; turnoverRate: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthStartStr = toLocalDateString(monthStart);
    const monthEndStr = toLocalDateString(monthEnd);
    const yearMonth = monthStartStr.slice(0, 7);

    const sales = allSales.filter(s => {
      const d = normalizeSaleDate(s.saleDate);
      return d && d >= monthStartStr && d <= monthEndStr;
    });
    const cogs = sales.reduce((sum, s) => {
      const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
      return sum + cost;
    }, 0);

    const inStockItems = await db.item.findMany({
      where: {
        status: 'in_stock',
        isDeleted: false,
        createdAt: { lte: new Date(monthEndStr + 'T23:59:59') },
      },
      select: { costPrice: true, allocatedCost: true },
    });
    const avgInventoryValue = inStockItems.reduce((sum, item) => sum + (item.allocatedCost || item.costPrice || 0), 0);

    const turnoverRate = avgInventoryValue > 0 ? Math.round((cogs / avgInventoryValue) * 100) / 100 : 0;

    result.push({
      yearMonth,
      cogs: Math.round(cogs * 100) / 100,
      avgInventoryValue: Math.round(avgInventoryValue * 100) / 100,
      turnoverRate,
    });
  }

  return result;
}

/**
 * 各批次盈亏详情
 */
export async function getBatchProfitReport(params: { materialId?: string; status?: string } = {}) {
  const where: Prisma.BatchWhereInput = {};
  if (params.materialId) where.materialId = parseInt(params.materialId);

  const batches = await db.batch.findMany({
    where,
    include: { material: true, items: { where: { isDeleted: false }, include: { saleRecords: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const result: BatchProfitItem[] = batches.map(b => {
    const soldItems = b.items.filter(i => i.status === 'sold');
    const sc = soldItems.length;
    const revenue = soldItems.reduce((sum, item) => {
      return sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0);
    }, 0);
    const profit = revenue - b.totalCost;
    const paybackRate = b.totalCost > 0 ? revenue / b.totalCost : 0;

    let batchStatus = 'new';
    if (sc === 0) batchStatus = 'new';
    else if (sc === b.quantity) batchStatus = 'cleared';
    else if (paybackRate >= 1) batchStatus = 'paid_back';
    else batchStatus = 'selling';

    if (params.status && batchStatus !== params.status) return null as unknown as BatchProfitItem;

    return {
      batchCode: b.batchCode,
      materialName: b.material?.name,
      totalCost: b.totalCost,
      quantity: b.quantity,
      soldCount: sc,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      paybackRate: Math.round(paybackRate * 1000) / 1000,
      status: batchStatus,
    };
  }).filter(Boolean);

  return result;
}

/**
 * 库存老化清单
 */
export async function getStockAging(params: { minDays?: number } = {}) {
  const minDays = params.minDays ?? 90;
  const today = new Date();

  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false, purchaseDate: { not: null } },
    include: { material: true, type: true },
  });

  const agingItems = items
    .map(item => {
      const ageDays = item.purchaseDate
        ? Math.floor((today.getTime() - new Date(item.purchaseDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return { ...item, ageDays };
    })
    .filter(item => item.ageDays >= minDays)
    .sort((a, b) => b.ageDays - a.ageDays);

  const result: StockAgingItem[] = agingItems.map(item => ({
    itemId: item.id,
    skuCode: item.skuCode,
    name: item.name ?? undefined,
    batchCode: item.batchCode ?? undefined,
    materialName: item.material?.name ?? undefined,
    typeName: item.type?.name ?? undefined,
    costPrice: item.costPrice ?? undefined,
    allocatedCost: item.allocatedCost ?? undefined,
    sellingPrice: item.sellingPrice ?? undefined,
    purchaseDate: item.purchaseDate ?? undefined,
    ageDays: item.ageDays,
    counter: item.counter ?? undefined,
  }));

  const totalValue = result.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);

  return {
    items: result,
    totalItems: result.length,
    totalValue: Math.round(totalValue * 100) / 100,
  };
}

/**
 * 热销货品排行
 */
export async function getTopSellers(params: { limit?: number } = {}) {
  const limit = params.limit ?? 5;

  const soldItems = await db.saleRecord.findMany({
    include: { item: { include: { material: true, type: true } } },
    orderBy: { actualPrice: 'desc' },
  });

  const itemMap = new Map<number, TopSellerItem>();
  for (const sale of soldItems) {
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
        margin: 0,
      });
    }
    const entry = itemMap.get(item.id)!;
    entry.totalRevenue += sale.actualPrice;
    entry.totalCost += cost;
    entry.totalProfit += sale.actualPrice - cost;
    entry.salesCount += 1;
  }

  const items = Array.from(itemMap.values()).map(item => ({
    ...item,
    totalRevenue: Math.round(item.totalRevenue * 100) / 100,
    totalCost: Math.round(item.totalCost * 100) / 100,
    totalProfit: Math.round(item.totalProfit * 100) / 100,
    margin: item.totalRevenue > 0 ? Math.round((item.totalProfit / item.totalRevenue) * 10000) / 100 : 0,
  }));

  items.sort((a, b) => b.totalProfit - a.totalProfit);
  return items.slice(0, limit);
}

/**
 * 客户消费排行
 */
export async function getTopCustomers() {
  const topCustomers = await db.customer.findMany({
    where: { isActive: true },
    include: { saleRecords: { select: { id: true, actualPrice: true, saleDate: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const customerSpend = topCustomers
    .map(c => {
      const totalSpending = c.saleRecords.reduce((sum, s) => sum + (s.actualPrice || 0), 0);
      const orderCount = c.saleRecords.length;
      const lastPurchaseDate = c.saleRecords.length > 0
        ? c.saleRecords.reduce((latest, s) => (s.saleDate > latest ? s.saleDate : latest), c.saleRecords[0].saleDate)
        : null;

      let vipLevel = '';
      if (totalSpending >= 50000) vipLevel = '钻石';
      else if (totalSpending >= 20000) vipLevel = '金卡';
      else if (totalSpending >= 5000) vipLevel = '银卡';

      return {
        id: c.id,
        name: c.name,
        customerCode: c.customerCode,
        totalSpending,
        orderCount,
        lastPurchaseDate,
        vipLevel,
      };
    })
    .filter(c => c.orderCount > 0)
    .sort((a, b) => b.totalSpending - a.totalSpending)
    .slice(0, 10);

  return customerSpend;
}

/**
 * 渠道销售统计
 */
export async function getSalesByChannel(params: DateRangeFilter = {}) {
  const where: Prisma.SaleRecordWhereInput = {};
  if (params.startDate || params.endDate) {
    where.saleDate = {};
    if (params.startDate) where.saleDate.gte = params.startDate;
    if (params.endDate) where.saleDate.lte = params.endDate;
  }

  const sales = await db.saleRecord.findMany({ where, include: { item: true } });

  const channelLabelMap: Record<string, string> = { store: '门店', wechat: '微信' };
  const channelMap = new Map<string, { count: number; totalRevenue: number; totalProfit: number }>();

  for (const sale of sales) {
    const ch = sale.channel || '其他';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    if (!channelMap.has(ch)) {
      channelMap.set(ch, { count: 0, totalRevenue: 0, totalProfit: 0 });
    }
    const entry = channelMap.get(ch)!;
    entry.count += 1;
    entry.totalRevenue += sale.actualPrice;
    entry.totalProfit += sale.actualPrice - cost;
  }

  return Array.from(channelMap.entries()).map(([channel, e]) => ({
    channel,
    label: channelLabelMap[channel] || channel,
    count: e.count,
    totalRevenue: Math.round(e.totalRevenue * 100) / 100,
    totalProfit: Math.round(e.totalProfit * 100) / 100,
  }));
}

/**
 * 最近销售记录
 */
export async function getRecentSales() {
  const sales = await db.saleRecord.findMany({
    take: 5,
    orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
    include: {
      item: { select: { name: true, skuCode: true, material: { select: { name: true } } } },
      customer: { select: { name: true } },
    },
  });

  return sales.map(sale => ({
    id: sale.id,
    item: sale.item
      ? { name: sale.item.name || sale.item.skuCode, skuCode: sale.item.skuCode, materialName: sale.item.material?.name ?? null }
      : null,
    customerName: sale.customer?.name || '散客',
    actualPrice: sale.actualPrice,
    channel: sale.channel,
    saleDate: sale.saleDate,
  }));
}

/**
 * 环比数据
 */
export async function getMomComparison() {
  const now = new Date();
  const thisMonthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const thisMonthEnd = toLocalDateString(now);
  const lastMonthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0));

  const allSales = await db.saleRecord.findMany({ include: { item: true } });
  const thisMonthSales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= thisMonthStart && d <= thisMonthEnd;
  });
  const lastMonthSales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= lastMonthStart && d <= lastMonthEnd;
  });

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

  const [thisNewItems, lastNewItems] = await Promise.all([
    db.item.count({
      where: { createdAt: { gte: new Date(thisMonthStart), lte: new Date(thisMonthEnd + 'T23:59:59') }, isDeleted: false },
    }),
    db.item.count({
      where: { createdAt: { gte: new Date(lastMonthStart), lte: new Date(lastMonthEnd + 'T23:59:59') }, isDeleted: false },
    }),
  ]);

  const momData: MomComparison = {
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

  return momData;
}

/**
 * 按品类利润分析
 */
export async function getProfitByCategory(params: DateRangeFilter = {}) {
  const where: Prisma.SaleRecordWhereInput = {};
  if (params.startDate) where.saleDate = { ...(where.saleDate as Prisma.StringFilter | undefined), gte: params.startDate };
  if (params.endDate) where.saleDate = { ...(where.saleDate as Prisma.StringFilter | undefined), lte: params.endDate };

  const sales = await db.saleRecord.findMany({
    where,
    include: { item: { include: { material: true } } },
  });

  const byMaterial = new Map<number, { materialName: string; revenue: number; cost: number; salesCount: number }>();
  for (const sale of sales) {
    const matId = sale.item?.materialId;
    const matName = sale.item?.material?.name || '未知';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    if (!byMaterial.has(matId)) {
      byMaterial.set(matId, { materialName: matName, revenue: 0, cost: 0, salesCount: 0 });
    }
    const entry = byMaterial.get(matId)!;
    entry.revenue += sale.actualPrice;
    entry.cost += cost;
    entry.salesCount += 1;
  }

  return Array.from(byMaterial.values()).map(e => ({
    materialName: e.materialName,
    revenue: Math.round(e.revenue * 100) / 100,
    cost: Math.round(e.cost * 100) / 100,
    profit: Math.round((e.revenue - e.cost) * 100) / 100,
    salesCount: e.salesCount,
    profitMargin: e.revenue > 0 ? Math.round(((e.revenue - e.cost) / e.revenue) * 1000) / 1000 : 0,
  }));
}

/**
 * 按渠道利润分析
 */
export async function getProfitByChannel(params: DateRangeFilter = {}) {
  const where: Prisma.SaleRecordWhereInput = {};
  if (params.startDate) where.saleDate = { ...(where.saleDate as Prisma.StringFilter | undefined), gte: params.startDate };
  if (params.endDate) where.saleDate = { ...(where.saleDate as Prisma.StringFilter | undefined), lte: params.endDate };

  const sales = await db.saleRecord.findMany({ where, include: { item: true } });
  const channelLabelMap: Record<string, string> = { store: '门店', wechat: '微信' };

  const channelMap = new Map<string, { revenue: number; cost: number; salesCount: number }>();
  for (const sale of sales) {
    const ch = sale.channel;
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    if (!channelMap.has(ch)) {
      channelMap.set(ch, { revenue: 0, cost: 0, salesCount: 0 });
    }
    const entry = channelMap.get(ch)!;
    entry.revenue += sale.actualPrice;
    entry.cost += cost;
    entry.salesCount += 1;
  }

  return Array.from(channelMap.entries()).map(([channel, e]) => ({
    channel,
    channelLabel: channelLabelMap[channel] || channel,
    revenue: Math.round(e.revenue * 100) / 100,
    cost: Math.round(e.cost * 100) / 100,
    profit: Math.round((e.revenue - e.cost) * 100) / 100,
    profitMargin: e.revenue > 0 ? Math.round(((e.revenue - e.cost) / e.revenue) * 1000) / 1000 : 0,
    salesCount: e.salesCount,
  }));
}

/**
 * 按柜台利润分析
 */
export async function getProfitByCounter(params: DateRangeFilter = {}) {
  const saleWhere: Prisma.SaleRecordWhereInput = {};
  if (params.startDate) saleWhere.saleDate = { ...(saleWhere.saleDate as Prisma.StringFilter | undefined), gte: params.startDate };
  if (params.endDate) saleWhere.saleDate = { ...(saleWhere.saleDate as Prisma.StringFilter | undefined), lte: params.endDate };

  const sales = await db.saleRecord.findMany({ where: saleWhere, include: { item: true } });
  const byCounter = new Map<number, { totalProfit: number; totalRevenue: number; salesCount: number }>();

  for (const sale of sales) {
    const counter = sale.item?.counter ?? 0;
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    const profit = sale.actualPrice - cost;

    if (!byCounter.has(counter)) {
      byCounter.set(counter, { totalProfit: 0, totalRevenue: 0, salesCount: 0 });
    }
    const entry = byCounter.get(counter)!;
    entry.totalProfit += profit;
    entry.totalRevenue += sale.actualPrice;
    entry.salesCount += 1;
  }

  return Array.from(byCounter.entries())
    .map(([counter, data]) => ({
      counter,
      totalProfit: Math.round(data.totalProfit * 100) / 100,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      salesCount: data.salesCount,
    }))
    .sort((a, b) => a.counter - b.counter);
}

/**
 * 按材质分布
 */
export async function getDistributionByMaterial(params: DateRangeFilter = {}) {
  const inStockItems = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    include: { material: true },
  });

  const priceByMaterial = new Map<string, number>();
  for (const item of inStockItems) {
    const materialName = item.material?.name || '未知';
    priceByMaterial.set(materialName, (priceByMaterial.get(materialName) || 0) + (item.sellingPrice || 0));
  }
  const priceDistribution = Array.from(priceByMaterial.entries()).map(([materialName, totalSellingPrice]) => ({
    materialName,
    totalSellingPrice: Math.round(totalSellingPrice * 100) / 100,
  }));

  const saleWhere: Prisma.SaleRecordWhereInput = {};
  if (params.startDate) saleWhere.saleDate = { ...(saleWhere.saleDate as Prisma.StringFilter | undefined), gte: params.startDate };
  if (params.endDate) saleWhere.saleDate = { ...(saleWhere.saleDate as Prisma.StringFilter | undefined), lte: params.endDate };

  const sales = await db.saleRecord.findMany({
    where: saleWhere,
    include: { item: { include: { material: true } } },
  });

  const profitByMaterial = new Map<string, number>();
  const countByMaterial = new Map<string, number>();
  const marginByMaterial = new Map<string, { sum: number; count: number }>();

  for (const sale of sales) {
    const materialName = sale.item?.material?.name || '未知';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    const profit = sale.actualPrice - cost;
    const margin = sale.actualPrice > 0 ? profit / sale.actualPrice : 0;

    profitByMaterial.set(materialName, (profitByMaterial.get(materialName) || 0) + profit);
    countByMaterial.set(materialName, (countByMaterial.get(materialName) || 0) + 1);

    if (!marginByMaterial.has(materialName)) marginByMaterial.set(materialName, { sum: 0, count: 0 });
    const m = marginByMaterial.get(materialName)!;
    m.sum += margin;
    m.count += 1;
  }

  return {
    priceDistribution,
    profitDistribution: Array.from(profitByMaterial.entries()).map(([materialName, totalProfit]) => ({
      materialName,
      totalProfit: Math.round(totalProfit * 100) / 100,
    })),
    countDistribution: Array.from(countByMaterial.entries()).map(([materialName, salesCount]) => ({
      materialName,
      salesCount,
    })),
    marginDistribution: Array.from(marginByMaterial.entries()).map(([materialName, { sum, count }]) => ({
      materialName,
      avgMargin: count > 0 ? Math.round((sum / count) * 1000) / 1000 : 0,
    })),
  };
}

/**
 * 按器型分布
 */
export async function getDistributionByType(params: DateRangeFilter = {}) {
  const inStockItems = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    include: { type: true },
  });

  const priceByType = new Map<string, number>();
  for (const item of inStockItems) {
    const typeName = item.type?.name || '未分类';
    priceByType.set(typeName, (priceByType.get(typeName) || 0) + (item.sellingPrice || 0));
  }
  const priceDistribution = Array.from(priceByType.entries()).map(([typeName, totalSellingPrice]) => ({
    typeName,
    totalSellingPrice: Math.round(totalSellingPrice * 100) / 100,
  }));

  const saleWhere: Prisma.SaleRecordWhereInput = {};
  if (params.startDate) saleWhere.saleDate = { ...(saleWhere.saleDate as Prisma.StringFilter | undefined), gte: params.startDate };
  if (params.endDate) saleWhere.saleDate = { ...(saleWhere.saleDate as Prisma.StringFilter | undefined), lte: params.endDate };

  const sales = await db.saleRecord.findMany({
    where: saleWhere,
    include: { item: { include: { type: true } } },
  });

  const profitByType = new Map<string, number>();
  const countByType = new Map<string, number>();
  const marginByType = new Map<string, { sum: number; count: number }>();

  for (const sale of sales) {
    const typeName = sale.item?.type?.name || '未分类';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    const profit = sale.actualPrice - cost;
    const margin = sale.actualPrice > 0 ? profit / sale.actualPrice : 0;

    profitByType.set(typeName, (profitByType.get(typeName) || 0) + profit);
    countByType.set(typeName, (countByType.get(typeName) || 0) + 1);

    if (!marginByType.has(typeName)) marginByType.set(typeName, { sum: 0, count: 0 });
    const m = marginByType.get(typeName)!;
    m.sum += margin;
    m.count += 1;
  }

  return {
    priceDistribution,
    profitDistribution: Array.from(profitByType.entries()).map(([typeName, totalProfit]) => ({
      typeName,
      totalProfit: Math.round(totalProfit * 100) / 100,
    })),
    countDistribution: Array.from(countByType.entries()).map(([typeName, salesCount]) => ({
      typeName,
      salesCount,
    })),
    marginDistribution: Array.from(marginByType.entries()).map(([typeName, { sum, count }]) => ({
      typeName,
      avgMargin: count > 0 ? Math.round((sum / count) * 1000) / 1000 : 0,
    })),
  };
}

/**
 * 按品类库存价值
 */
export async function getInventoryValueByCategory() {
  const inStockItems = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    include: { material: true },
  });

  const categoryMap = new Map<string, { value: number; count: number }>();
  for (const item of inStockItems) {
    const category = item.material?.category || '未分类';
    const existing = categoryMap.get(category) || { value: 0, count: 0 };
    existing.value += item.sellingPrice || 0;
    existing.count += 1;
    categoryMap.set(category, existing);
  }

  return Array.from(categoryMap.entries())
    .map(([category, info]) => ({
      category,
      totalValue: Math.round(info.value * 100) / 100,
      count: info.count,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * 售价区间分布
 */
export async function getSellingPriceDistribution() {
  const sellingRanges = [
    { range: '0-600', label: '0-600', min: 0, max: 600 },
    { range: '600-2000', label: '600-2000', min: 600, max: 2000 },
    { range: '2000-5000', label: '2000-5000', min: 2000, max: 5000 },
    { range: '5000-15000', label: '5000-1.5万', min: 5000, max: 15000 },
    { range: '15000-30000', label: '1.5万-3万', min: 15000, max: 30000 },
    { range: '30000-80000', label: '3万-8万', min: 30000, max: 80000 },
    { range: '80000+', label: '8万+', min: 80000, max: Infinity },
  ];

  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    select: { sellingPrice: true },
  });

  const counts = new Map<string, number>();
  for (const r of sellingRanges) counts.set(r.range, 0);
  for (const item of items) {
    const price = item.sellingPrice || 0;
    for (const r of sellingRanges) {
      if (price >= r.min && price < r.max) {
        counts.set(r.range, (counts.get(r.range) || 0) + 1);
        break;
      }
    }
  }

  return sellingRanges.map(r => ({
    range: r.range,
    label: r.label,
    count: counts.get(r.range) || 0,
  }));
}

/**
 * 成本区间分布
 */
export async function getCostPriceDistribution() {
  const costRanges = [
    { range: '0-600', label: '0-600', min: 0, max: 600 },
    { range: '600-2000', label: '600-2000', min: 600, max: 2000 },
    { range: '2000-5000', label: '2000-5000', min: 2000, max: 5000 },
    { range: '5000-15000', label: '5000-1.5万', min: 5000, max: 15000 },
    { range: '15000-30000', label: '1.5万-3万', min: 15000, max: 30000 },
    { range: '30000-80000', label: '3万-8万', min: 30000, max: 80000 },
    { range: '80000+', label: '8万+', min: 80000, max: Infinity },
  ];

  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    select: { allocatedCost: true, costPrice: true },
  });

  const counts = new Map<string, number>();
  for (const r of costRanges) counts.set(r.range, 0);
  for (const item of items) {
    const cost = item.allocatedCost || item.costPrice || 0;
    for (const r of costRanges) {
      if (cost >= r.min && cost < r.max) {
        counts.set(r.range, (counts.get(r.range) || 0) + 1);
        break;
      }
    }
  }

  return costRanges.map(r => ({
    range: r.range,
    label: r.label,
    count: counts.get(r.range) || 0,
  }));
}

/**
 * 库存年龄分布
 */
export async function getAgeDistribution() {
  const ageRanges = [
    { range: '0-30', label: '0-30天', min: 0, max: 30 },
    { range: '30-60', label: '30-60天', min: 30, max: 60 },
    { range: '60-90', label: '60-90天', min: 60, max: 90 },
    { range: '90-180', label: '90-180天', min: 90, max: 180 },
    { range: '180+', label: '180天+', min: 180, max: Infinity },
  ];

  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false, purchaseDate: { not: null } },
    select: { allocatedCost: true, costPrice: true, purchaseDate: true },
  });

  const today = new Date();
  const buckets = ageRanges.map(r => ({ range: r.range, label: r.label, count: 0, totalValue: 0 }));

  for (const item of items) {
    if (!item.purchaseDate) continue;
    const ageDays = Math.floor((today.getTime() - new Date(item.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    const cost = item.allocatedCost || item.costPrice || 0;

    for (let i = 0; i < ageRanges.length; i++) {
      if (ageDays >= ageRanges[i].min && ageDays < ageRanges[i].max) {
        buckets[i].count += 1;
        buckets[i].totalValue += cost;
        break;
      }
    }
  }

  return buckets.map(b => ({
    ...b,
    totalValue: Math.round(b.totalValue * 100) / 100,
  }));
}

/**
 * 客户复购频率分布
 */
export async function getCustomerFrequency() {
  const customers = await db.customer.findMany({
    include: { saleRecords: { select: { id: true } } },
    where: { isActive: true },
  });

  const freqMap: Record<string, number> = { '1次': 0, '2次': 0, '3次': 0, '4次+': 0 };

  for (const customer of customers) {
    const count = customer.saleRecords.length;
    if (count === 0) continue;
    if (count === 1) freqMap['1次'] += 1;
    else if (count === 2) freqMap['2次'] += 1;
    else if (count === 3) freqMap['3次'] += 1;
    else freqMap['4次+'] += 1;
  }

  const distribution = Object.entries(freqMap).map(([label, count]) => ({ label, count }));
  const totalCustomers = distribution.reduce((sum, d) => sum + d.count, 0);
  const repeatCustomers = distribution.filter(d => d.label !== '1次').reduce((sum, d) => sum + d.count, 0);
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 10000) / 100 : 0;

  return { distribution, totalCustomers, repeatCustomers, repeatRate };
}

/**
 * 销售热力图
 */
export async function getSalesHeatmap(params: { months?: number } = {}) {
  const months = params.months ?? 3;
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startDateStr = toLocalDateString(startDate);

  const allSales = await db.saleRecord.findMany({ select: { saleDate: true, actualPrice: true } });
  const sales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= startDateStr;
  });

  const dateMap = new Map<string, { count: number; revenue: number }>();
  for (const sale of sales) {
    const date = normalizeSaleDate(sale.saleDate).slice(0, 10);
    if (!dateMap.has(date)) {
      dateMap.set(date, { count: 0, revenue: 0 });
    }
    const entry = dateMap.get(date)!;
    entry.count += 1;
    entry.revenue += sale.actualPrice;
  }

  const maxRevenue = Math.max(...Array.from(dateMap.values()).map(v => v.revenue), 1);

  const days = Array.from(dateMap.entries()).map(([date, data]) => {
    const d = new Date(date + 'T00:00:00');
    return {
      date,
      dayOfWeek: d.getDay(),
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
      intensity: Math.round((data.revenue / maxRevenue) * 100) / 100,
    };
  });

  days.sort((a, b) => a.date.localeCompare(b.date));

  return { days, maxRevenue: Math.round(maxRevenue * 100) / 100, totalDays: days.length };
}

/**
 * 克重分布
 */
export async function getWeightDistribution() {
  const weightRanges = [
    { range: '0-5g', label: '0-5g', min: 0, max: 5 },
    { range: '5-20g', label: '5-20g', min: 5, max: 20 },
    { range: '20-50g', label: '20-50g', min: 20, max: 50 },
    { range: '50-100g', label: '50-100g', min: 50, max: 100 },
    { range: '100g+', label: '100g+', min: 100, max: Infinity },
  ];

  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    include: { material: true, spec: true },
  });

  const scatter: { weight: number; sellingPrice: number; materialName: string }[] = [];
  const stackedMap = new Map<string, Map<string, number>>();
  for (const r of weightRanges) {
    stackedMap.set(r.range, new Map());
  }

  for (const item of items) {
    const weight = item.spec?.weight;
    if (weight == null) continue;
    const materialName = item.material?.name || '未知';

    scatter.push({ weight, sellingPrice: item.sellingPrice || 0, materialName });

    for (const r of weightRanges) {
      if (weight >= r.min && weight < r.max) {
        const matMap = stackedMap.get(r.range)!;
        matMap.set(materialName, (matMap.get(materialName) || 0) + 1);
        break;
      }
    }
  }

  const allMaterials = new Set<string>();
  for (const item of items) {
    if (item.spec?.weight != null) {
      allMaterials.add(item.material?.name || '未知');
    }
  }

  const stacked = weightRanges.map(r => {
    const matMap = stackedMap.get(r.range)!;
    const entry: { range: string; label: string; materials: Record<string, number> } = {
      range: r.range,
      label: r.label,
      materials: {},
    };
    for (const mat of allMaterials) {
      entry.materials[mat] = matMap.get(mat) || 0;
    }
    return entry;
  });

  return { scatter, stacked, materials: Array.from(allMaterials) };
}
