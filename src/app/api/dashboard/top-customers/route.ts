import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get top 5 customers by total purchase amount
    const topCustomers = await db.customer.findMany({
      where: { isActive: true },
      include: {
        saleRecords: {
          select: {
            id: true,
            actualPrice: true,
            saleDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate spending for each customer
    const customerSpend = topCustomers
      .map(c => {
        const totalSpending = c.saleRecords.reduce((sum, s) => sum + (s.actualPrice || 0), 0);
        const orderCount = c.saleRecords.length;
        const lastPurchaseDate = c.saleRecords.length > 0
          ? c.saleRecords.reduce((latest, s) => {
              return s.saleDate > latest ? s.saleDate : latest;
            }, c.saleRecords[0].saleDate)
          : null;

        // Check VIP level
        let vipLevel = '';
        if (totalSpending >= 50000) vipLevel = '钻石';
        else if (totalSpending >= 20000) vipLevel = '金卡';
        else if (totalSpending >= 5000) vipLevel = '银卡';

        return {
          id: c.id,
          name: c.name,
          customerCode: c.customerCode,
          totalSpending,
          orderCount,
          lastPurchaseDate,
          vipLevel,
        };
      })
      .filter(c => c.orderCount > 0)
      .sort((a, b) => b.totalSpending - a.totalSpending)
      .slice(0, 10);

    return NextResponse.json({
      code: 0,
      data: customerSpend,
      message: 'ok',
    });
  } catch (e: any) {
    console.error('Top customers API error:', e);
    return NextResponse.json({ code: 500, data: null, message: e.message || '服务器错误' }, { status: 500 });
  }
}
