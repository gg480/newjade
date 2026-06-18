// 推广记录管理 API — 列表 + 创建

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as promotionService from '@/services/content-promotion.service';
import type { PromotionListParams, CreatePromotionRequest } from '@/types/promotion';

async function promotionsListGet(req: Request) {
  const denied = await guardPermission(req, 'action:content_view');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const params: PromotionListParams = {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    status: (searchParams.get('status') as PromotionListParams['status']) || undefined,
    channel: (searchParams.get('channel') as PromotionListParams['channel']) || undefined,
    contentId: searchParams.get('content_id') || undefined,
  };

  try {
    const result = await promotionService.listPromotions(params);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

async function promotionsCreatePost(req: Request) {
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const body = (await req.json()) as CreatePromotionRequest;
    const userId = req.headers.get('x-user-id') || 'system';
    const promotion = await promotionService.createPromotion(body, userId);
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

export const GET = withApiLogging('promotion:promotions:GET', promotionsListGet);
export const POST = withApiLogging('promotion:promotions:POST', promotionsCreatePost);
