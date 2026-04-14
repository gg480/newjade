import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  // Get all customers with their purchase count
  const customers = await db.customer.findMany({
    include: {
      saleRecords: {
        select: { id: true },
      },
    },
    where: { isActive: true },
  });

  // Count customers by purchase frequency
  const freqMap: Record<string, number> = {
    '1次': 0,
    '2次': 0,
    '3次': 0,
    '4次+': 0,
  };

  for (const customer of customers) {
    const count = customer.saleRecords.length;
    if (count === 0) continue; // Skip customers with no purchases
    if (count === 1) freqMap['1次'] += 1;
    else if (count === 2) freqMap['2次'] += 1;
    else if (count === 3) freqMap['3次'] += 1;
    else freqMap['4次+'] += 1;
  }

  const data = Object.entries(freqMap).map(([label, count]) => ({
    label,
    count,
  }));

  // Calculate repeat purchase rate
  const totalCustomers = data.reduce((sum, d) => sum + d.count, 0);
  const repeatCustomers = data.filter(d => d.label !== '1次').reduce((sum, d) => sum + d.count, 0);
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 10000) / 100 : 0;

  return NextResponse.json({
    code: 0,
    data: {
      distribution: data,
      totalCustomers,
      repeatCustomers,
      repeatRate,
    },
    message: 'ok',
  });
}
