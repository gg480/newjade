import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [itemCount, saleCount] = await Promise.all([
      db.item.count({ where: { isDeleted: false } }),
      db.saleRecord.count(),
    ]);

    return NextResponse.json({
      code: 0,
      data: {
        status: 'ok',
        itemCount,
        saleCount,
      },
      message: 'ok',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      code: 500,
      data: { status: 'error' },
      message: `health check failed: ${message}`,
    }, { status: 500 });
  }
}
