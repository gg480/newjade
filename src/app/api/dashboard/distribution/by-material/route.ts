import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  // 1. Price distribution (by material for in-stock items)
  const inStockItems = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    include: { material: true },
  });
  const priceByMaterial = new Map<string, number>();
  for (const item of inStockItems) {
    const materialName = item.material?.name || '未知';
    priceByMaterial.set(materialName, (priceByMaterial.get(materialName) || 0) + item.sellingPrice);
  }
  const priceDistribution = Array.from(priceByMaterial.entries()).map(([materialName, totalSellingPrice]) => ({
    materialName,
    totalSellingPrice: Math.round(totalSellingPrice * 100) / 100,
  }));

  // 2-4. Sales-based distributions
  const saleWhere: any = {};
  if (startDate) saleWhere.saleDate = { ...saleWhere.saleDate, gte: startDate };
  if (endDate) saleWhere.saleDate = { ...saleWhere.saleDate, lte: endDate };

  const sales = await db.saleRecord.findMany({
    where: saleWhere,
    include: { item: { include: { material: true } } },
  });

  const profitByMaterial = new Map<string, number>();
  const countByMaterial = new Map<string, number>();
  const marginByMaterial = new Map<string, { sum: number; count: number }>();

  for (const sale of sales) {
    const materialName = sale.item?.material?.name || '未知';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    const profit = sale.actualPrice - cost;
    const margin = sale.actualPrice > 0 ? profit / sale.actualPrice : 0;

    profitByMaterial.set(materialName, (profitByMaterial.get(materialName) || 0) + profit);
    countByMaterial.set(materialName, (countByMaterial.get(materialName) || 0) + 1);

    if (!marginByMaterial.has(materialName)) marginByMaterial.set(materialName, { sum: 0, count: 0 });
    const m = marginByMaterial.get(materialName)!;
    m.sum += margin;
    m.count += 1;
  }

  const profitDistribution = Array.from(profitByMaterial.entries()).map(([materialName, totalProfit]) => ({
    materialName,
    totalProfit: Math.round(totalProfit * 100) / 100,
  }));

  const countDistribution = Array.from(countByMaterial.entries()).map(([materialName, salesCount]) => ({
    materialName,
    salesCount,
  }));

  const marginDistribution = Array.from(marginByMaterial.entries()).map(([materialName, { sum, count }]) => ({
    materialName,
    avgMargin: Math.round((sum / count) * 1000) / 1000,
  }));

  return NextResponse.json({
    code: 0,
    data: { priceDistribution, profitDistribution, countDistribution, marginDistribution },
    message: 'ok',
  });
}
