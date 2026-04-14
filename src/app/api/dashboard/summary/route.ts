import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agingDays = parseInt(searchParams.get('aging_days') || '90');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  // Total items in stock
  const totalItems = await db.item.count({ where: { status: 'in_stock', isDeleted: false } });

  // Total stock value
  const inStockItems = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    select: { costPrice: true, allocatedCost: true },
  });
  const totalStockValue = inStockItems.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);

  // Month sales
  const monthSales = await db.saleRecord.findMany({
    where: { saleDate: { gte: monthStart } },
    include: { item: true },
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
    message: 'ok',
  });
}
