import { NextResponse } from 'next/server';
import * as notificationService from '@/services/notification.service';
import { NotFoundError } from '@/lib/errors';

/**
 * PATCH /api/notifications/:id
 * 标记单条通知为已读
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id, 10);

    if (isNaN(idNum) || idNum <= 0) {
      return NextResponse.json(
        { code: 400, data: null, message: '通知 ID 无效' },
        { status: 400 },
      );
    }

    const result = await notificationService.markAsRead(idNum);

    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: e.message }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : '标记已读失败';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
