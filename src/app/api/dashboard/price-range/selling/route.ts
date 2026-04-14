import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const RANGES = [
  { range: '0-600', label: '0-600', min: 0, max: 600 },
  { range: '600-2000', label: '600-2000', min: 600, max: 2000 },
  { range: '2000-5000', label: '2000-5000', min: 2000, max: 5000 },
  { range: '5000-15000', label: '5000-1.5万', min: 5000, max: 15000 },
  { range: '15000-30000', label: '1.5万-3万', min: 15000, max: 30000 },
  { range: '30000-80000', label: '3万-8万', min: 30000, max: 80000 },
  { range: '80000+', label: '8万+', min: 80000, max: Infinity },
];

export async function GET() {
  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    select: { sellingPrice: true },
  });

  const counts = new Map<string, number>();
  for (const r of RANGES) counts.set(r.range, 0);

  for (const item of items) {
    const price = item.sellingPrice || 0;
    for (const r of RANGES) {
      if (price >= r.min && price < r.max) {
        counts.set(r.range, (counts.get(r.range) || 0) + 1);
        break;
      }
    }
  }

  const result = RANGES.map(r => ({
    range: r.range,
    label: r.label,
    count: counts.get(r.range) || 0,
  }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
