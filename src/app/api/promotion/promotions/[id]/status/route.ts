// 推广状态变更 API

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as promotionService from '@/services/content-promotion.service';
import type { UpdatePromotionStatusRequest } from '@/types/promotion';

async function promotionStatusPatch(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = (await req.json()) as UpdatePromotionStatusRequest;
    const promotion = await promotionService.updatePromotionStatus(id, body);
    return NextResponse.json({ code: 0, data: promotion, message: 'ok' });
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

export const PATCH = withApiLogging('promotion:status:PATCH', promotionStatusPatch);
