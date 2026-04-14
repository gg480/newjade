import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const inStockItems = await db.item.findMany({
      where: { status: 'in_stock', isDeleted: false },
      include: { material: true },
    });

    const categoryMap = new Map<string, { value: number; count: number }>();
    for (const item of inStockItems) {
      const category = item.material?.category || '未分类';
      const existing = categoryMap.get(category) || { value: 0, count: 0 };
      existing.value += item.sellingPrice || 0;
      existing.count += 1;
      categoryMap.set(category, existing);
    }

    const data = Array.from(categoryMap.entries()).map(([category, info]) => ({
      category,
      totalValue: Math.round(info.value * 100) / 100,
      count: info.count,
    })).sort((a, b) => b.totalValue - a.totalValue);

    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: e.message }, { status: 500 });
  }
}
