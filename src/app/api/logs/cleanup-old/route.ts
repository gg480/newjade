import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count how many will be deleted
    const count = await db.operationLog.count({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    if (count === 0) {
      return NextResponse.json({
        code: 0,
        data: { deleted: 0 },
        message: '没有超过30天的操作日志',
      });
    }

    const result = await db.operationLog.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    return NextResponse.json({
      code: 0,
      data: { deleted: result.count },
      message: `已清除 ${result.count} 条30天前的操作日志`,
    });
  } catch (error) {
    console.error('Cleanup old logs error:', error);
    return NextResponse.json({
      code: -1,
      message: '清除操作日志失败',
      data: { deleted: 0 },
    });
  }
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const count = await db.operationLog.count({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
    return NextResponse.json({
      code: 0,
      data: { count },
      message: 'ok',
    });
  } catch (error) {
    console.error('Count old logs error:', error);
    return NextResponse.json({
      code: -1,
      message: '查询失败',
      data: { count: 0 },
    });
  }
}
