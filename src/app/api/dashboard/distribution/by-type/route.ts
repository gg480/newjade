import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  // 1. Price distribution (by type for in-stock items)
  const inStockItems = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    include: { type: true },
  });
  const priceByType = new Map<string, number>();
  for (const item of inStockItems) {
    const typeName = item.type?.name || '未分类';
    priceByType.set(typeName, (priceByType.get(typeName) || 0) + item.sellingPrice);
  }
  const priceDistribution = Array.from(priceByType.entries()).map(([typeName, totalSellingPrice]) => ({
    typeName,
    totalSellingPrice: Math.round(totalSellingPrice * 100) / 100,
  }));

  // 2-4. Sales-based distributions
  const saleWhere: any = {};
  if (startDate) saleWhere.saleDate = { ...saleWhere.saleDate, gte: startDate };
  if (endDate) saleWhere.saleDate = { ...saleWhere.saleDate, lte: endDate };

  const sales = await db.saleRecord.findMany({
    where: saleWhere,
    include: { item: { include: { type: true } } },
  });

  const profitByType = new Map<string, number>();
  const countByType = new Map<string, number>();
  const marginByType = new Map<string, { sum: number; count: number }>();

  for (const sale of sales) {
    const typeName = sale.item?.type?.name || '未分类';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    const profit = sale.actualPrice - cost;
    const margin = sale.actualPrice > 0 ? profit / sale.actualPrice : 0;

    profitByType.set(typeName, (profitByType.get(typeName) || 0) + profit);
    countByType.set(typeName, (countByType.get(typeName) || 0) + 1);

    if (!marginByType.has(typeName)) marginByType.set(typeName, { sum: 0, count: 0 });
    const m = marginByType.get(typeName)!;
    m.sum += margin;
    m.count += 1;
  }

  const profitDistribution = Array.from(profitByType.entries()).map(([typeName, totalProfit]) => ({
    typeName,
    totalProfit: Math.round(totalProfit * 100) / 100,
  }));

  const countDistribution = Array.from(countByType.entries()).map(([typeName, salesCount]) => ({
    typeName,
    salesCount,
  }));

  const marginDistribution = Array.from(marginByType.entries()).map(([typeName, { sum, count }]) => ({
    typeName,
    avgMargin: Math.round((sum / count) * 1000) / 1000,
  }));

  return NextResponse.json({
    code: 0,
    data: { priceDistribution, profitDistribution, countDistribution, marginDistribution },
    message: 'ok',
  });
}
