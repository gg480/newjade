import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function getPriceChangeLogs(req: Request) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('item_id') ? parseInt(searchParams.get('item_id')!) : undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  try {
    const where: any = {};
    if (itemId) {
      where.itemId = itemId;
    }
    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate)
      };
    }
    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const [logs, total] = await Promise.all([
      db.priceChangeLog.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              skuCode: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size
      }),
      db.priceChangeLog.count({ where })
    ]);

    return NextResponse.json({
      code: 0,
      data: {
        logs,
        total,
        page,
        size
      },
      message: 'ok'
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `获取调价记录失败: ${e.message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('items/price-logs:GET', getPriceChangeLogs);
