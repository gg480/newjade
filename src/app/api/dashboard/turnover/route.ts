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
  const months = parseInt(searchParams.get('months') || '6');

  const now = new Date();
  const allSales = await db.saleRecord.findMany({ include: { item: true } });

  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthStartStr = toLocalDateString(monthStart);
    const monthEndStr = toLocalDateString(monthEnd);
    const yearMonth = monthStartStr.slice(0, 7);

    // Cost of goods sold in this month
    const sales = allSales.filter(s => {
      const d = normalizeSaleDate(s.saleDate);
      return d && d >= monthStartStr && d <= monthEndStr;
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
