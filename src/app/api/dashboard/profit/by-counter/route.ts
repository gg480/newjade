import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  const saleWhere: any = {};
  if (startDate) saleWhere.saleDate = { ...saleWhere.saleDate, gte: startDate };
  if (endDate) saleWhere.saleDate = { ...saleWhere.saleDate, lte: endDate };

  const sales = await db.saleRecord.findMany({
    where: saleWhere,
    include: { item: true },
  });

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

  const result = Array.from(byCounter.entries())
    .map(([counter, data]) => ({
      counter,
      totalProfit: Math.round(data.totalProfit * 100) / 100,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      salesCount: data.salesCount,
    }))
    .sort((a, b) => a.counter - b.counter);

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
