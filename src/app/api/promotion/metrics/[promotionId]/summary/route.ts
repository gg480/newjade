// 推广反馈数据汇总 API — 趋势图数据
// 返回总览数值 + 按日期聚合的趋势序列

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import {
  guardPermission,
  safeErrorMessage,
} from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as promotionService from '@/services/content-promotion.service';

async function metricsSummaryGet(
  req: Request,
  context: { params: Promise<{ promotionId: string }> },
) {
  const denied = await guardPermission(req, 'action:content_view');
  if (denied) return denied;

  try {
    const { promotionId } = await context.params;
    const summary = await promotionService.getMetricsSummary(promotionId);
    return NextResponse.json({ code: 0, data: summary, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { code: e.statusCode, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('promotion:metrics:summary:GET', metricsSummaryGet);
