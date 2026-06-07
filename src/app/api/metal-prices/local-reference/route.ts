import { NextResponse } from 'next/server';
import { fetchLocalReferencePrices } from '@/services/local-reference-price.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { AppError } from '@/lib/errors';

/**
 * GET /api/metal-prices/local-reference
 * 从 gzjn168.com 获取本地贵金属参考行情（回购价/销售价）
 * 使用 5 分钟内存缓存，避免频繁请求外部站点
 */
async function localReferenceGET() {
  try {
    const data = await fetchLocalReferencePrices();
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

export const GET = withApiLogging('metal-prices:local-reference:GET', localReferenceGET);
