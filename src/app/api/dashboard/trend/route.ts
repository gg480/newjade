import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') || '12');

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startDateStr = startDate.toISOString().slice(0, 10);

  const sales = await db.saleRecord.findMany({
    where: { saleDate: { gte: startDateStr } },
    include: { item: true },
  });

  // Group by month
  const monthMap = new Map<string, { revenue: number; profit: number; salesCount: number }>();
  for (const sale of sales) {
    const month = sale.saleDate.slice(0, 7); // YYYY-MM
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
