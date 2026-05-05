import { NextResponse } from 'next/server';
import * as notificationService from '@/services/notification.service';
import { ValidationError } from '@/lib/errors';

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
