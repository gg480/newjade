// 节日日历 API — 获取节日信息和当前/即将到来的节日
// GET /api/promotion/festivals?upcoming=true&month=3

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import {
  getAllFestivals,
  getFestivalsByMonth,
  getUpcomingFestivals,
  getCurrentOrNextFestival,
  getFestivalById,
  getFestivalTimeline,
} from '@/services/festival-calendar';

async function festivalsGet(req: Request) {
  const denied = await guardPermission(req, 'content_view');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const upcoming = searchParams.get('upcoming');
  const month = searchParams.get('month');
  const timeline = searchParams.get('timeline');
  const id = searchParams.get('id');

  try {
    // 按 ID 查询特定节日
    if (id) {
      const festival = getFestivalById(id);
      if (!festival) {
        return NextResponse.json(
          { code: 404, data: null, message: '节日不存在' },
          { status: 404 },
        );
      }
      return NextResponse.json({ code: 0, data: festival, message: 'ok' });
    }

    // 获取当前/下一个节日
    if (upcoming === 'true') {
      const result = getCurrentOrNextFestival();
      return NextResponse.json({ code: 0, data: result, message: 'ok' });
    }

    // 获取近期节日时间线（支持指定月份范围）
    if (timeline === 'true') {
      const startMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const count = parseInt(searchParams.get('count') || '3');
      const entries = getFestivalTimeline(startMonth, Math.min(count, 12));
      return NextResponse.json({ code: 0, data: entries, message: 'ok' });
    }

    // 按月筛选
    if (month) {
      const m = parseInt(month);
      if (m < 1 || m > 12) {
        return NextResponse.json(
          { code: 400, data: null, message: 'month 无效，取值 1-12' },
          { status: 400 },
        );
      }
      const data = getFestivalsByMonth(m);
      return NextResponse.json({ code: 0, data, message: 'ok' });
    }

    // 默认：返回全部节日
    const data = getAllFestivals();
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e) {
    console.error('[Festivals API] Error:', e);
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('promotion:festivals:GET', festivalsGet);
