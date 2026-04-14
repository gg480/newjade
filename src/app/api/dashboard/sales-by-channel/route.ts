import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  const where: any = {};
  if (startDate || endDate) {
    where.saleDate = {};
    if (startDate) where.saleDate.gte = startDate;
    if (endDate) where.saleDate.lte = endDate;
  }

  const sales = await db.saleRecord.findMany({
    where,
    include: { item: true },
  });

  const channelLabelMap: Record<string, string> = { store: '门店', wechat: '微信' };
  const channelMap = new Map<string, { count: number; totalRevenue: number; totalProfit: number }>();

  for (const sale of sales) {
    const ch = sale.channel || null;
    const key = ch || '其他';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    if (!channelMap.has(key)) {
      channelMap.set(key, { count: 0, totalRevenue: 0, totalProfit: 0 });
    }
    const entry = channelMap.get(key)!;
    entry.count += 1;
    entry.totalRevenue += sale.actualPrice;
    entry.totalProfit += sale.actualPrice - cost;
  }

  const result = Array.from(channelMap.entries()).map(([channel, e]) => ({
    channel,
    label: channelLabelMap[channel] || (channel === '其他' ? '其他' : channel),
    count: e.count,
    totalRevenue: Math.round(e.totalRevenue * 100) / 100,
    totalProfit: Math.round(e.totalProfit * 100) / 100,
  }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
