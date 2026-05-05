import { db } from '@/lib/db';
import { getSales } from '@/services/sales.service';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { logAction } from '@/lib/log';
import type { Prisma } from '@prisma/client';

// ============================================================
// 日期工具
// ============================================================

/** 获取某周的周一和周日日期（ISO 周：周一为一周开始） */
function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay(); // 0=周日, 1=周一...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

/** 获取上周的日期范围 */
function getLastWeekRange(): { start: string; end: string } {
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  return getWeekRange(lastWeek);
}

/** 获取上上周的日期范围（用于环比） */
function getPreviousWeekRange(): { start: string; end: string } {
  const prevWeek = new Date();
  prevWeek.setDate(prevWeek.getDate() - 14);
  return getWeekRange(prevWeek);
}

/** 获取上月的日期范围 */
function getLastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(lastMonth), end: fmt(endOfLastMonth) };
}

/** 获取去年同月的日期范围（用于同比） */
function getSameMonthLastYearRange(): { start: string; end: string } {
  const now = new Date();
  const target = new Date(now.getFullYear() - 1, now.getMonth() - 1, 1);
  const endOfTarget = new Date(now.getFullYear() - 1, now.getMonth(), 0);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(target), end: fmt(endOfTarget) };
}

/** 判断今天是否是周一 */
function isMonday(): boolean {
  return new Date().getDay() === 1;
}

/** 判断今天是否是每月第一天 */
function isFirstDayOfMonth(): boolean {
  return new Date().getDate() === 1;
}

/** 格式化 YYYY-MM-DD */
function fmtDate(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

// ============================================================
// 类型定义
// ============================================================

export type NotificationType =
  | 'weekly_report'
  | 'monthly_report'
  | 'overdue'
  | 'batch_incomplete'
  | 'low_margin'
  | 'today_summary';

export interface GetNotificationsParams {
  page?: number;
  size?: number;
  type?: NotificationType;
}

/** 价格带分布项 */
interface PriceBandItem {
  band: string;
  count: number;
  amount: number;
}

/** 分类分布项 */
interface CategoryDistItem {
  name: string;
  amount: number;
  count: number;
  ratio: number;
}

/** 周报数据结构 */
export interface WeeklyReportData {
  period: { start: string; end: string; label: string };
  summary: {
    revenue: number;
    profit: number;
    soldCount: number;
    avgOrderValue: number;
  };
  momChanges: {
    revenue: number | null;
    profit: number | null;
    soldCount: number | null;
    avgOrderValue: number | null;
  } | null;
  materialTop3: CategoryDistItem[];
  typeTop3: CategoryDistItem[];
  priceBands: PriceBandItem[];
  inventory: {
    startStock: number;
    endStock: number;
    newItems: number;
    soldItems: number;
  };
}

/** 月报数据结构（扩展自周报） */
export interface MonthlyReportData {
  period: { start: string; end: string; label: string };
  summary: {
    revenue: number;
    profit: number;
    soldCount: number;
    avgOrderValue: number;
  };
  yoyChanges: {
    revenue: number | null;
    profit: number | null;
    soldCount: number | null;
    avgOrderValue: number | null;
  } | null;
  materialTop10: CategoryDistItem[];
  typeTop10: CategoryDistItem[];
  priceBands: PriceBandItem[];
  channelDist: { channel: string; amount: number; count: number }[];
  inventory: {
    startStock: number;
    endStock: number;
    newItems: number;
    soldItems: number;
  };
  customerStats: {
    newCustomers: number;
    activeCustomers: number;
    topCustomers: { name: string; amount: number; count: number }[];
  };
}

// ============================================================
// 销售数据聚合工具
// ============================================================

/** 从销售列表计算汇总指标 */
function calcSummary(sales: any[]) {
  const revenue = sales.reduce((s, r) => s + (r.actualPrice || 0), 0);
  const profit = sales.reduce((s, r) => s + (r.grossProfit || 0), 0);
  const soldCount = sales.length;
  const avgOrderValue = soldCount > 0 ? Math.round((revenue / soldCount) * 100) / 100 : 0;
  return { revenue, profit, soldCount, avgOrderValue };
}

/** 价格带分类 */
function classifyPriceBand(price: number): string {
  if (price <= 5000) return '0-5千';
  if (price <= 20000) return '5千-2万';
  if (price <= 50000) return '2万-5万';
  return '5万以上';
}

/** 按材质分类聚合（from sales items） */
function aggregateByMaterial(sales: any[]): Map<string, { amount: number; count: number }> {
  const map = new Map<string, { amount: number; count: number }>();
  for (const s of sales) {
    const name = s.materialName || '未知';
    const entry = map.get(name) || { amount: 0, count: 0 };
    entry.amount += s.actualPrice || 0;
    entry.count += 1;
    map.set(name, entry);
  }
  return map;
}

/** 按器型分类聚合 */
function aggregateByType(sales: any[]): Map<string, { amount: number; count: number }> {
  const map = new Map<string, { amount: number; count: number }>();
  for (const s of sales) {
    const name = s.typeName || '未知';
    const entry = map.get(name) || { amount: 0, count: 0 };
    entry.amount += s.actualPrice || 0;
    entry.count += 1;
    map.set(name, entry);
  }
  return map;
}

/** 将 Map 转为排序后的 TopN 列表 */
function toTopN(
  map: Map<string, { amount: number; count: number }>,
  totalAmount: number,
  n: number,
): CategoryDistItem[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, n)
    .map(([name, v]) => ({
      name,
      amount: Math.round(v.amount * 100) / 100,
      count: v.count,
      ratio: totalAmount > 0 ? Math.round((v.amount / totalAmount) * 10000) / 100 : 0,
    }));
}

/** 计算价格带分布 */
function calcPriceBands(sales: any[]): PriceBandItem[] {
  const bands: PriceBandItem[] = [
    { band: '0-5千', count: 0, amount: 0 },
    { band: '5千-2万', count: 0, amount: 0 },
    { band: '2万-5万', count: 0, amount: 0 },
    { band: '5万以上', count: 0, amount: 0 },
  ];
  for (const s of sales) {
    const p = s.actualPrice || 0;
    if (p <= 5000) { bands[0].count++; bands[0].amount += p; }
    else if (p <= 20000) { bands[1].count++; bands[1].amount += p; }
    else if (p <= 50000) { bands[2].count++; bands[2].amount += p; }
    else { bands[3].count++; bands[3].amount += p; }
  }
  return bands.map(b => ({ ...b, amount: Math.round(b.amount * 100) / 100 }));
}

// ============================================================
// 库存快照估算
// ============================================================

/**
 * 估算某日期的库存快照
 * 由于没有历史库存快照表，通过 Item 的创建时间和状态变化推算
 */
async function estimateInventorySnapshot(asOfDate: string): Promise<number> {
  // 当前 in_stock 的货品 + 在 asOfDate 之后售出的货品 - 在 asOfDate 之后创建的货品
  // 这样近似得到 asOfDate 时的在库数量

  const [currentStock, soldAfter, createdAfter] = await Promise.all([
    db.item.count({ where: { status: 'in_stock', isDeleted: false } }),
    db.saleRecord.count({
      where: {
        saleDate: { gt: asOfDate },
        saleReturns: { none: {} },
      },
    }),
    db.item.count({
      where: {
        createdAt: { gt: new Date(asOfDate + 'T23:59:59.999Z') },
        isDeleted: false,
      },
    }),
  ]);

  return currentStock + soldAfter - createdAfter;
}

/** 获取期间内新增货品数 */
async function countNewItemsInPeriod(start: string, end: string): Promise<number> {
  return db.item.count({
    where: {
      createdAt: {
        gte: new Date(start + 'T00:00:00.000Z'),
        lte: new Date(end + 'T23:59:59.999Z'),
      },
      isDeleted: false,
    },
  });
}

// ============================================================
// 周报生成
// ============================================================

export async function generateWeeklyReport(): Promise<WeeklyReportData> {
  const lastWeek = getLastWeekRange();
  const prevWeek = getPreviousWeekRange();

  // 并行查询：当前周 + 上周销售
  const [currentSalesResult, prevSalesResult] = await Promise.all([
    getSales({ startDate: lastWeek.start, endDate: lastWeek.end, size: 99999 }),
    getSales({ startDate: prevWeek.start, endDate: prevWeek.end, size: 99999 }),
  ]);

  const currentSales = currentSalesResult.items;
  const prevSales = prevSalesResult.items;

  const summary = calcSummary(currentSales);
  const prevSummary = calcSummary(prevSales);

  // 环比变化率
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 10000) / 100;
  };

  const momChanges = {
    revenue: prevSales.length > 0 ? calcChange(summary.revenue, prevSummary.revenue) : null,
    profit: prevSales.length > 0 ? calcChange(summary.profit, prevSummary.profit) : null,
    soldCount: prevSales.length > 0 ? calcChange(summary.soldCount, prevSummary.soldCount) : null,
    avgOrderValue: prevSales.length > 0 ? calcChange(summary.avgOrderValue, prevSummary.avgOrderValue) : null,
  };

  // 分类分布
  const materialMap = aggregateByMaterial(currentSales);
  const typeMap = aggregateByType(currentSales);

  // 价格带
  const priceBands = calcPriceBands(currentSales);

  // 库存快照
  const [startStock, endStock, newItems] = await Promise.all([
    estimateInventorySnapshot(lastWeek.start),
    estimateInventorySnapshot(lastWeek.end),
    countNewItemsInPeriod(lastWeek.start, lastWeek.end),
  ]);

  return {
    period: { start: lastWeek.start, end: lastWeek.end, label: `第${getWeekLabel(lastWeek.start)}周` },
    summary: {
      revenue: Math.round(summary.revenue * 100) / 100,
      profit: Math.round(summary.profit * 100) / 100,
      soldCount: summary.soldCount,
      avgOrderValue: summary.avgOrderValue,
    },
    momChanges,
    materialTop3: toTopN(materialMap, summary.revenue, 3),
    typeTop3: toTopN(typeMap, summary.revenue, 3),
    priceBands,
    inventory: {
      startStock: Math.max(0, startStock),
      endStock: Math.max(0, endStock),
      newItems,
      soldItems: summary.soldCount,
    },
  };
}

/** 根据周一日期生成周标签，如 "2026-W17" */
function getWeekLabel(mondayStr: string): string {
  const d = new Date(mondayStr + 'T00:00:00');
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ============================================================
// 月报生成
// ============================================================

export async function generateMonthlyReport(): Promise<MonthlyReportData> {
  const lastMonth = getLastMonthRange();
  const sameMonthLastYear = getSameMonthLastYearRange();

  // 并行查询
  const [currentSalesResult, lastYearSalesResult] = await Promise.all([
    getSales({ startDate: lastMonth.start, endDate: lastMonth.end, size: 99999 }),
    getSales({ startDate: sameMonthLastYear.start, endDate: sameMonthLastYear.end, size: 99999 }),
  ]);

  const currentSales = currentSalesResult.items;
  const lastYearSales = lastYearSalesResult.items;

  const summary = calcSummary(currentSales);
  const lastYearSummary = calcSummary(lastYearSales);

  // 同比变化率
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 10000) / 100;
  };

  const yoyChanges = {
    revenue: lastYearSales.length > 0 ? calcChange(summary.revenue, lastYearSummary.revenue) : null,
    profit: lastYearSales.length > 0 ? calcChange(summary.profit, lastYearSummary.profit) : null,
    soldCount: lastYearSales.length > 0 ? calcChange(summary.soldCount, lastYearSummary.soldCount) : null,
    avgOrderValue: lastYearSales.length > 0 ? calcChange(summary.avgOrderValue, lastYearSummary.avgOrderValue) : null,
  };

  // 分类分布
  const materialMap = aggregateByMaterial(currentSales);
  const typeMap = aggregateByType(currentSales);
  const priceBands = calcPriceBands(currentSales);

  // 渠道分布
  const channelMap = new Map<string, { amount: number; count: number }>();
  for (const s of currentSales) {
    const ch = s.channel || '未知';
    const entry = channelMap.get(ch) || { amount: 0, count: 0 };
    entry.amount += s.actualPrice || 0;
    entry.count += 1;
    channelMap.set(ch, entry);
  }

  // 库存快照
  const [startStock, endStock, newItems] = await Promise.all([
    estimateInventorySnapshot(lastMonth.start),
    estimateInventorySnapshot(lastMonth.end),
    countNewItemsInPeriod(lastMonth.start, lastMonth.end),
  ]);

  // 客户统计
  const customerSalesMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const s of currentSales) {
    if (!s.customerName) continue;
    const entry = customerSalesMap.get(s.customerName) || { name: s.customerName, amount: 0, count: 0 };
    entry.amount += s.actualPrice || 0;
    entry.count += 1;
    customerSalesMap.set(s.customerName, entry);
  }
  const topCustomers = Array.from(customerSalesMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(c => ({ ...c, amount: Math.round(c.amount * 100) / 100 }));

  // 活跃客户数 & 新增客户数
  const activeCustomerIds = new Set<number>();
  for (const s of currentSales) {
    if (s.customerId) activeCustomerIds.add(s.customerId);
  }
  const newCustomerCount = await db.customer.count({
    where: {
      createdAt: {
        gte: new Date(lastMonth.start + 'T00:00:00.000Z'),
        lte: new Date(lastMonth.end + 'T23:59:59.999Z'),
      },
      isActive: true,
    },
  });

  const monthLabel = `${new Date(lastMonth.start).getFullYear()}年${new Date(lastMonth.start).getMonth() + 1}月`;

  return {
    period: { start: lastMonth.start, end: lastMonth.end, label: monthLabel },
    summary: {
      revenue: Math.round(summary.revenue * 100) / 100,
      profit: Math.round(summary.profit * 100) / 100,
      soldCount: summary.soldCount,
      avgOrderValue: summary.avgOrderValue,
    },
    yoyChanges,
    materialTop10: toTopN(materialMap, summary.revenue, 10),
    typeTop10: toTopN(typeMap, summary.revenue, 10),
    priceBands,
    channelDist: Array.from(channelMap.entries()).map(([channel, v]) => ({
      channel,
      amount: Math.round(v.amount * 100) / 100,
      count: v.count,
    })),
    inventory: {
      startStock: Math.max(0, startStock),
      endStock: Math.max(0, endStock),
      newItems,
      soldItems: summary.soldCount,
    },
    customerStats: {
      newCustomers: newCustomerCount,
      activeCustomers: activeCustomerIds.size,
      topCustomers,
    },
  };
}

// ============================================================
// 动态通知生成（4种已有类型）
// ============================================================

/** 生成压货预警通知 */
async function generateOverdueNotification(): Promise<{ title: string; content: string } | null> {
  const agingDays = 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - agingDays);

  const overdueItems = await db.item.findMany({
    where: {
      status: 'in_stock',
      isDeleted: false,
      createdAt: { lte: cutoff },
    },
    select: { id: true, skuCode: true, sellingPrice: true },
  });

  if (overdueItems.length === 0) return null;

  const totalValue = overdueItems.reduce((s, i) => s + (i.sellingPrice || 0), 0);
  return {
    title: '压货预警',
    content: JSON.stringify({
      count: overdueItems.length,
      totalValue: Math.round(totalValue * 100) / 100,
      agingDays,
      skus: overdueItems.slice(0, 5).map(i => i.skuCode),
      description: `${overdueItems.length} 件货品库存超过${agingDays}天，建议尽快处理`,
    }),
  };
}

/** 生成批次待录入通知 */
async function generateBatchIncompleteNotification(): Promise<{ title: string; content: string } | null> {
  const incompleteBatches = await db.batch.findMany({
    include: { _count: { select: { items: true } } },
  });
  const incomplete = incompleteBatches
    .filter(b => b._count.items < b.quantity)
    .map(b => ({
      batchCode: b.batchCode,
      expected: b.quantity,
      actual: b._count.items,
      missing: b.quantity - b._count.items,
    }));

  if (incomplete.length === 0) return null;

  const totalMissing = incomplete.reduce((s, b) => s + b.missing, 0);
  return {
    title: '批次待录入',
    content: JSON.stringify({
      batchCount: incomplete.length,
      totalMissing,
      details: incomplete,
      description: `${incomplete.length} 个批次尚未录满，共 ${totalMissing} 件待录入`,
    }),
  };
}

/** 生成低毛利预警通知 */
async function generateLowMarginNotification(): Promise<{ title: string; content: string } | null> {
  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    select: {
      id: true,
      skuCode: true,
      sellingPrice: true,
      costPrice: true,
      allocatedCost: true,
    },
  });

  const lowMargin = items.filter(i => {
    const cost = i.allocatedCost ?? i.costPrice ?? 0;
    const price = i.sellingPrice || 0;
    return cost > 0 && price > 0 && (price - cost) / price < 0.3;
  });

  if (lowMargin.length === 0) return null;

  return {
    title: '低毛利预警',
    content: JSON.stringify({
      count: lowMargin.length,
      threshold: '30%',
      skus: lowMargin.slice(0, 5).map(i => i.skuCode),
      description: `${lowMargin.length} 件在库货品毛利率低于30%，建议调整定价`,
    }),
  };
}

/** 生成今日销售摘要通知 */
async function generateTodaySummaryNotification(): Promise<{ title: string; content: string } | null> {
  const today = fmtDate(new Date());
  const result = await getSales({ startDate: today, endDate: today, size: 99999 });
  const sales = result.items;

  if (sales.length === 0) return null;

  const totalRevenue = sales.reduce((s, r) => s + (r.actualPrice || 0), 0);
  const totalProfit = sales.reduce((s, r) => s + (r.grossProfit || 0), 0);

  return {
    title: '今日销售',
    content: JSON.stringify({
      date: today,
      totalSales: sales.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      description: `已售 ${sales.length} 件，营收 ¥${totalRevenue.toFixed(0)}`,
    }),
  };
}

// ============================================================
// 惰性生成检查
// ============================================================

/**
 * 动态通知去重：检查今天是否已生成过同类型通知
 */
async function hasTodayNotification(type: string): Promise<boolean> {
  const today = fmtDate(new Date());
  const existing = await db.notification.findFirst({
    where: {
      type,
      createdAt: { gte: new Date(today + 'T00:00:00.000Z') },
    },
  });
  return existing !== null;
}

/**
 * 报表通知去重：检查是否已有同周期报表
 */
async function hasPeriodReport(type: string, periodStart: string): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: {
      type,
      content: { contains: periodStart },
    },
  });
  return existing !== null;
}

/**
 * 惰性生成所有通知（用户首次访问通知列表时调用）
 * - 动态通知：每天只生成一次（检查 createdAt >= today）
 * - 周报：周一生成上周周报（检查是否已有同周期记录）
 * - 月报：每月1号生成上月月报
 */
export async function checkAndGenerateReports(): Promise<{ generated: string[] }> {
  const generated: string[] = [];
  const today = fmtDate(new Date());

  // 1. 动态通知（每天仅生成一次）
  const dynamicGenerators: Array<{
    type: NotificationType;
    fn: () => Promise<{ title: string; content: string } | null>;
  }> = [
    { type: 'overdue', fn: generateOverdueNotification },
    { type: 'batch_incomplete', fn: generateBatchIncompleteNotification },
    { type: 'low_margin', fn: generateLowMarginNotification },
    { type: 'today_summary', fn: generateTodaySummaryNotification },
  ];

  for (const { type, fn } of dynamicGenerators) {
    if (await hasTodayNotification(type)) continue;
    try {
      const result = await fn();
      if (result) {
        await db.notification.create({
          data: { type, title: result.title, content: result.content },
        });
        generated.push(type);
      }
    } catch (e) {
      // 非关键流程，静默失败
      console.error(`[Notification] 生成 ${type} 失败:`, e);
    }
  }

  // 2. 周报：周一生成上周周报
  if (isMonday()) {
    const lastWeek = getLastWeekRange();
    if (!(await hasPeriodReport('weekly_report', lastWeek.start))) {
      try {
        const reportData = await generateWeeklyReport();
        await db.notification.create({
          data: {
            type: 'weekly_report',
            title: `销售周报（${reportData.period.label}）`,
            content: JSON.stringify(reportData),
          },
        });
        generated.push('weekly_report');
      } catch (e) {
        console.error('[Notification] 生成周报失败:', e);
      }
    }
  }

  // 3. 月报：每月1号生成上月月报
  if (isFirstDayOfMonth()) {
    const lastMonth = getLastMonthRange();
    if (!(await hasPeriodReport('monthly_report', lastMonth.start))) {
      try {
        const reportData = await generateMonthlyReport();
        await db.notification.create({
          data: {
            type: 'monthly_report',
            title: `销售月报（${reportData.period.label}）`,
            content: JSON.stringify(reportData),
          },
        });
        generated.push('monthly_report');
      } catch (e) {
        console.error('[Notification] 生成月报失败:', e);
      }
    }
  }

  return { generated };
}

/**
 * 手动触发生成报表
 */
export async function manualGenerateReport(
  type: 'weekly_report' | 'monthly_report',
): Promise<unknown> {
  if (type === 'weekly_report') {
    const lastWeek = getLastWeekRange();
    // 手动生成不检查去重，直接创建
    const reportData = await generateWeeklyReport();
    const notif = await db.notification.create({
      data: {
        type: 'weekly_report',
        title: `销售周报（${reportData.period.label}）`,
        content: JSON.stringify(reportData),
      },
    });
    await logAction('generate_report', 'notification', notif.id, { type, period: reportData.period });
    return reportData;
  }

  if (type === 'monthly_report') {
    const lastMonth = getLastMonthRange();
    const reportData = await generateMonthlyReport();
    const notif = await db.notification.create({
      data: {
        type: 'monthly_report',
        title: `销售月报（${reportData.period.label}）`,
        content: JSON.stringify(reportData),
      },
    });
    await logAction('generate_report', 'notification', notif.id, { type, period: reportData.period });
    return reportData;
  }

  throw new ValidationError(`不支持的报表类型: ${type}`);
}

// ============================================================
// 通知查询与管理
// ============================================================

/**
 * 获取通知列表（分页）
 * 调用前会自动触发惰性生成检查
 */
export async function getNotifications(params: GetNotificationsParams) {
  const page = params.page || 1;
  const size = params.size || 20;

  // 惰性生成：先检查是否需要生成新通知
  await checkAndGenerateReports();

  const where: Prisma.NotificationWhereInput = {};
  if (params.type) where.type = params.type;

  const [total, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  return {
    items,
    pagination: { total, page, size, pages: Math.ceil(total / size) },
  };
}

/**
 * 标记单条通知为已读
 * @throws {NotFoundError} 通知不存在时抛出
 */
export async function markAsRead(id: number) {
  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif) throw new NotFoundError('通知不存在');

  return db.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

/**
 * 标记所有通知为已读
 */
export async function markAllAsRead() {
  const result = await db.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });
  return { updatedCount: result.count };
}
