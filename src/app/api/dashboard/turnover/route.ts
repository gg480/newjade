import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') || '6');

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);
    const yearMonth = monthStartStr.slice(0, 7);

    // Cost of goods sold in this month
    const sales = await db.saleRecord.findMany({
      where: { saleDate: { gte: monthStartStr, lte: monthEndStr } },
      include: { item: true },
    });
    const cogs = sales.reduce((sum, s) => {
      const cost = s.item?.allocatedCost || s.item?.costPrice || 0;
      return sum + cost;
    }, 0);

    // Average inventory value: (start inventory + end inventory) / 2
    // We approximate by looking at items that were in stock at the end of the month
    // For simplicity: items created before month end that are not sold before month end
    const inStockItems = await db.item.findMany({
      where: {
        status: 'in_stock',
        isDeleted: false,
        createdAt: { lte: new Date(monthEndStr + 'T23:59:59') },
      },
      select: { costPrice: true, allocatedCost: true },
    });
    const avgInventoryValue = inStockItems.reduce((sum, item) => sum + (item.allocatedCost || item.costPrice || 0), 0);

    const turnoverRate = avgInventoryValue > 0 ? Math.round((cogs / avgInventoryValue) * 100) / 100 : 0;

    result.push({
      yearMonth,
      cogs: Math.round(cogs * 100) / 100,
      avgInventoryValue: Math.round(avgInventoryValue * 100) / 100,
      turnoverRate,
    });
  }

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
