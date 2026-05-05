import { NextResponse } from 'next/server';
import * as logsService from '@/services/logs.service';

export async function DELETE() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count how many will be deleted
    const count = await logsService.countOldLogs(thirtyDaysAgo);

    if (count === 0) {
      return NextResponse.json({
        code: 0,
        data: { deleted: 0 },
        message: '没有超过30天的操作日志',
      });
    }

    const result = await logsService.cleanupOldLogs(thirtyDaysAgo);

    return NextResponse.json({
      code: 0,
      data: { deleted: result.deleted },
      message: `已清除 ${result.deleted} 条30天前的操作日志`,
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

    const count = await logsService.countOldLogs(thirtyDaysAgo);

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
