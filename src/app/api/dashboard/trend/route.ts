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
  const months = parseInt(searchParams.get('months') || '12');

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startDateStr = toLocalDateString(startDate);

  const allSales = await db.saleRecord.findMany({ include: { item: true } });
  const sales = allSales.filter(s => {
    const d = normalizeSaleDate(s.saleDate);
    return d && d >= startDateStr;
  });

  // Group by month
  const monthMap = new Map<string, { revenue: number; profit: number; salesCount: number }>();
  for (const sale of sales) {
    const month = normalizeSaleDate(sale.saleDate).slice(0, 7); // YYYY-MM
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    if (!monthMap.has(month)) {
      monthMap.set(month, { revenue: 0, profit: 0, salesCount: 0 });
    }
    const entry = monthMap.get(month)!;
    entry.revenue += sale.actualPrice;
    entry.profit += (sale.actualPrice - cost);
    entry.salesCount += 1;
  }

  const result = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, e]) => ({
      yearMonth,
      revenue: Math.round(e.revenue * 100) / 100,
      profit: Math.round(e.profit * 100) / 100,
      salesCount: e.salesCount,
    }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
