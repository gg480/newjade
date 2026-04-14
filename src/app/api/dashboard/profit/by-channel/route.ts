import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  const where: any = {};
  if (startDate) where.saleDate = { ...where.saleDate, gte: startDate };
  if (endDate) where.saleDate = { ...where.saleDate, lte: endDate };

  const sales = await db.saleRecord.findMany({
    where,
    include: { item: true },
  });

  const channelMap = new Map<string, { revenue: number; cost: number; salesCount: number }>();
  const channelLabelMap: Record<string, string> = { store: '门店', wechat: '微信' };

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

  const result = Array.from(channelMap.entries()).map(([channel, e]) => ({
    channel,
    channelLabel: channelLabelMap[channel] || channel,
    revenue: Math.round(e.revenue * 100) / 100,
    cost: Math.round(e.cost * 100) / 100,
    profit: Math.round((e.revenue - e.cost) * 100) / 100,
    profitMargin: e.revenue > 0 ? Math.round(((e.revenue - e.cost) / e.revenue) * 1000) / 1000 : 0,
    salesCount: e.salesCount,
  }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
