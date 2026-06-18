// 推广反馈数据 API — 查询 + 录入
// 录入端点允许 OpenClaw 或具备 content_manage 权限的用户调用

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import {
  guardPermission,
  guardPermissionOrOpenClaw,
  safeErrorMessage,
} from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as promotionService from '@/services/content-promotion.service';
import type { CreateMetricRequest } from '@/types/promotion';

async function metricsGet(req: Request, context: { params: Promise<{ promotionId: string }> }) {
  const denied = await guardPermission(req, 'action:content_view');
  if (denied) return denied;

  try {
    const { promotionId } = await context.params;
    const metrics = await promotionService.getMetrics(promotionId);
    return NextResponse.json({ code: 0, data: metrics, message: 'ok' });
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

async function metricsCreatePost(
  req: Request,
  context: { params: Promise<{ promotionId: string }> },
) {
  // 允许 OpenClaw API Key 或具备 content_manage 权限的用户调用
  const denied = await guardPermissionOrOpenClaw(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const { promotionId } = await context.params;
    const body = (await req.json()) as CreateMetricRequest;
    const metric = await promotionService.createMetric(promotionId, body);
    return NextResponse.json({ code: 0, data: metric, message: 'ok' });
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

export const GET = withApiLogging('promotion:metrics:GET', metricsGet);
export const POST = withApiLogging('promotion:metrics:POST', metricsCreatePost);
