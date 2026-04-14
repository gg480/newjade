import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const AGE_RANGES = [
  { range: '0-30', label: '0-30天', min: 0, max: 30 },
  { range: '30-60', label: '30-60天', min: 30, max: 60 },
  { range: '60-90', label: '60-90天', min: 60, max: 90 },
  { range: '90-180', label: '90-180天', min: 90, max: 180 },
  { range: '180+', label: '180天+', min: 180, max: Infinity },
];

export async function GET() {
  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false, purchaseDate: { not: null } },
    select: { allocatedCost: true, costPrice: true, purchaseDate: true },
  });

  const today = new Date();
  const buckets = AGE_RANGES.map(r => ({ range: r.range, label: r.label, count: 0, totalValue: 0 }));

  for (const item of items) {
    if (!item.purchaseDate) continue;
    const ageDays = Math.floor((today.getTime() - new Date(item.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    const cost = item.allocatedCost || item.costPrice || 0;

    for (let i = 0; i < AGE_RANGES.length; i++) {
      if (ageDays >= AGE_RANGES[i].min && ageDays < AGE_RANGES[i].max) {
        buckets[i].count += 1;
        buckets[i].totalValue += cost;
        break;
      }
    }
  }

  const result = buckets.map(b => ({
    ...b,
    totalValue: Math.round(b.totalValue * 100) / 100,
  }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
