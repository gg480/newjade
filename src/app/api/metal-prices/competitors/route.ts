import { NextResponse } from 'next/server';
import { fetchCompetitorGoldPrices } from '@/services/market-price.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { AppError } from '@/lib/errors';

/**
 * GET /api/metal-prices/competitors
 * 获取各品牌金店金价（周大福、老凤祥等）
 * 使用1小时内存缓存，自动过滤港台店铺
 */
async function competitorsGET() {
  try {
    const data = await fetchCompetitorGoldPrices();
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, data: null, message: err.message },
        { status: err.statusCode }
      );
    }
    throw err;
  }
}

export const GET = withApiLogging('metal-prices:competitors:GET', competitorsGET);
