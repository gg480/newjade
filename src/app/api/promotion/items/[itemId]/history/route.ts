// 商品推广历史 API

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as promotionService from '@/services/content-promotion.service';

async function itemHistoryGet(req: Request, context: { params: Promise<{ itemId: string }> }) {
  const denied = await guardPermission(req, 'action:content_view');
  if (denied) return denied;

  try {
    const { itemId: itemIdStr } = await context.params;
    const itemId = parseInt(itemIdStr);
    if (Number.isNaN(itemId)) {
      return NextResponse.json(
        { code: 400, data: null, message: '商品 ID 必须为数字' },
        { status: 400 },
      );
    }
    const history = await promotionService.getItemPromotionHistory(itemId);
    return NextResponse.json({ code: 0, data: history, message: 'ok' });
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

export const GET = withApiLogging('promotion:item-history:GET', itemHistoryGet);
