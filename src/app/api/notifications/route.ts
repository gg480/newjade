import { NextResponse } from 'next/server';
import * as notificationService from '@/services/notification.service';
import { AppError, ValidationError } from '@/lib/errors';

/**
 * GET /api/notifications?page=&size=&type=
 * 获取通知列表（分页），调用前自动触发惰性生成检查
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await notificationService.getNotifications({
      page: parseInt(searchParams.get('page') || '1', 10) || 1,
      size: parseInt(searchParams.get('size') || '20', 10) || 20,
      type: (searchParams.get('type') as notificationService.NotificationType) || undefined,
    });

    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '获取通知列表失败';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * POST /api/notifications/generate
 * 手动触发报表生成（周报/月报）
 * 请求体: { type: 'weekly_report' | 'monthly_report' }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type } = body;

    if (!type || !['weekly_report', 'monthly_report'].includes(type)) {
      return NextResponse.json(
        { code: 400, data: null, message: 'type 必须是 weekly_report 或 monthly_report' },
        { status: 400 },
      );
    }

    const data = await notificationService.manualGenerateReport(type);

    return NextResponse.json({ code: 0, data, message: '报表生成成功' });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '生成报表失败';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
