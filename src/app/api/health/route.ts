import { db, toUserFriendlyMessage } from '@/lib/db';
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
    const message = toUserFriendlyMessage(e);
    return NextResponse.json({
      code: 500,
      data: { status: 'error' },
      message,
    }, { status: 500 });
  }
}
