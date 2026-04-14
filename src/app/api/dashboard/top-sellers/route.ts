import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '5');

  // Get all sold items with their sale records
  const soldItems = await db.saleRecord.findMany({
    include: {
      item: {
        include: {
          material: true,
          type: true,
        },
      },
    },
    orderBy: { actualPrice: 'desc' },
  });

  // Aggregate by item
  const itemMap = new Map<number, {
    itemId: number;
    name: string;
    skuCode: string;
    materialName: string;
    typeName: string;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    salesCount: number;
    margin: number;
  }>();

  for (const sale of soldItems) {
    const item = sale.item;
    if (!item) continue;
    const cost = item.allocatedCost || item.costPrice || 0;
    const profit = sale.actualPrice - cost;

    if (!itemMap.has(item.id)) {
      itemMap.set(item.id, {
        itemId: item.id,
        name: item.name || item.skuCode,
        skuCode: item.skuCode,
        materialName: item.material?.name || '-',
        typeName: item.type?.name || '-',
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        salesCount: 0,
        margin: 0,
      });
    }
    const entry = itemMap.get(item.id)!;
    entry.totalRevenue += sale.actualPrice;
    entry.totalCost += cost;
    entry.totalProfit += profit;
    entry.salesCount += 1;
  }

  // Calculate margin and sort by profit
  const items = Array.from(itemMap.values()).map(item => ({
    ...item,
    totalRevenue: Math.round(item.totalRevenue * 100) / 100,
    totalCost: Math.round(item.totalCost * 100) / 100,
    totalProfit: Math.round(item.totalProfit * 100) / 100,
    margin: item.totalRevenue > 0 ? Math.round((item.totalProfit / item.totalRevenue) * 10000) / 100 : 0,
  }));

  // Sort by totalProfit descending
  items.sort((a, b) => b.totalProfit - a.totalProfit);

  return NextResponse.json({
    code: 0,
    data: items.slice(0, limit),
    message: 'ok',
  });
}
