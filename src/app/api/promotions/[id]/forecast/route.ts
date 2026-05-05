import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { NotFoundError } from '@/lib/errors';
import { forecastPromotionEffect } from '@/services/promotions.service';

async function promotionForecastGet(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;

  try {
    const result = await forecastPromotionEffect(parseInt(promotionId));
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    return NextResponse.json({ code: 500, data: null, message: `预测失败: ${message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('promotions:forecast:GET', promotionForecastGet);
