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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agingDays = parseInt(searchParams.get('aging_days') || '90');

    const now = new Date();
    const monthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayStr = toLocalDateString(now);

    // Total items in stock
    const totalItems = await db.item.count({ where: { status: 'in_stock', isDeleted: false } });

    // Total stock value
    const inStockItems = await db.item.findMany({
      where: { status: 'in_stock', isDeleted: false },
      select: { costPrice: true, allocatedCost: true },
    });
    const totalStockValue = inStockItems.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);

    // Month sales
    const allSales = await db.saleRecord.findMany({
      include: { item: true },
    });
    const monthSales = allSales.filter(s => {
      const d = normalizeSaleDate(s.saleDate);
      return d && d >= monthStart && d <= todayStr;
    });
    const monthRevenue = monthSales.reduce((sum, s) => sum + s.actualPrice, 0);
    const monthProfit = monthSales.reduce((sum, s) => {
      const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
      return sum + (s.actualPrice - cost);
    }, 0);
    const monthSoldCount = monthSales.length;

    return NextResponse.json({
      code: 0,
      data: {
        totalItems,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        monthRevenue: Math.round(monthRevenue * 100) / 100,
        monthProfit: Math.round(monthProfit * 100) / 100,
        monthSoldCount,
      },
      message: `ok (aging_days=${agingDays})`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      code: 500,
      data: null,
      message: `dashboard summary failed: ${message}`,
    }, { status: 500 });
  }
}
