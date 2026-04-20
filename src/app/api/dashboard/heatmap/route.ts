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
  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') || '3');

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startDateStr = toLocalDateString(startDate);

  // Get all sales in the period
  const allSales = await db.saleRecord.findMany({
    select: { saleDate: true, actualPrice: true },
  });
  const sales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= startDateStr;
  });

  // Group by date
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

  // Build calendar-style data
  // Find max revenue for color scaling
  const maxRevenue = Math.max(...Array.from(dateMap.values()).map(v => v.revenue), 1);

  const days: { date: string; dayOfWeek: number; count: number; revenue: number; intensity: number }[] = [];
  for (const [date, data] of dateMap.entries()) {
    const d = new Date(date + 'T00:00:00');
    days.push({
      date,
      dayOfWeek: d.getDay(),
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
      intensity: Math.round((data.revenue / maxRevenue) * 100) / 100,
    });
  }

  // Sort by date
  days.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    code: 0,
    data: { days, maxRevenue: Math.round(maxRevenue * 100) / 100, totalDays: days.length },
    message: 'ok',
  });
}
