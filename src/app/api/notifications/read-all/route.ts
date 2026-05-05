import { NextResponse } from 'next/server';
import * as notificationService from '@/services/notification.service';

/**
 * PATCH /api/notifications/read-all
 * 标记所有通知为已读
 */
export async function PATCH() {
  try {
    const result = await notificationService.markAllAsRead();
    return NextResponse.json({ code: 0, data: result, message: '全部已读' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '标记全部已读失败';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
