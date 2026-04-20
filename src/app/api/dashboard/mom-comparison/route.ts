import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

export async function GET() {
  const now = new Date();

  // Current month range
  const thisMonthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const thisMonthEnd = toLocalDateString(now);

  // Last month range
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

  // Calculate metrics for this month
  const thisRevenue = thisMonthSales.reduce((sum, s) => sum + s.actualPrice, 0);
  const thisSoldCount = thisMonthSales.length;
  const thisProfit = thisMonthSales.reduce((sum, s) => {
    const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
    return sum + (s.actualPrice - cost);
  }, 0);

  // Calculate metrics for last month
  const lastRevenue = lastMonthSales.reduce((sum, s) => sum + s.actualPrice, 0);
  const lastSoldCount = lastMonthSales.length;
  const lastProfit = lastMonthSales.reduce((sum, s) => {
    const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
    return sum + (s.actualPrice - cost);
  }, 0);

  // New items entered this month vs last month
  const [thisNewItems, lastNewItems] = await Promise.all([
    db.item.count({
      where: { createdAt: { gte: new Date(thisMonthStart), lte: new Date(thisMonthEnd + 'T23:59:59') }, isDeleted: false },
    }),
    db.item.count({
      where: { createdAt: { gte: new Date(lastMonthStart), lte: new Date(lastMonthEnd + 'T23:59:59') }, isDeleted: false },
    }),
  ]);

  // Helper to calculate percent change
  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  };

  return NextResponse.json({
    code: 0,
    data: {
      thisMonth: {
        revenue: Math.round(thisRevenue * 100) / 100,
        soldCount: thisSoldCount,
        profit: Math.round(thisProfit * 100) / 100,
        newItems: thisNewItems,
      },
      lastMonth: {
        revenue: Math.round(lastRevenue * 100) / 100,
        soldCount: lastSoldCount,
        profit: Math.round(lastProfit * 100) / 100,
        newItems: lastNewItems,
      },
      changes: {
        revenue: pctChange(thisRevenue, lastRevenue),
        soldCount: pctChange(thisSoldCount, lastSoldCount),
        profit: pctChange(thisProfit, lastProfit),
        newItems: pctChange(thisNewItems, lastNewItems),
      },
    },
    message: 'ok',
  });
}
