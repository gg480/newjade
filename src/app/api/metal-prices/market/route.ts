import { NextResponse } from 'next/server';
import { fetchMarketPricesWithRef } from '@/services/market-price.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { AppError } from '@/lib/errors';

/**
 * GET /api/metal-prices/market
 * 获取贵金属行情价（含材质折算参考价）
 * 支持 ?source=auto|gzjn168|tanshu 参数切换数据源：
 *   - gzjn168: 从融通金(gzjn168.com)抓取零售金价（销售价作为行情价）
 *   - tanshu:  从探数API获取上海金交所交易所行情价
 *   - auto:    优先融通金（gzjn168），失败时回退探数API
 * gzjn168 数据使用其内部 5 分钟缓存；探数数据使用独立 5 分钟缓存
 */
async function marketPricesGET(request: Request) {
  try {
    const url = new URL(request.url);
    const sourceParam = url.searchParams.get('source') || 'auto';
    const source = ['auto', 'gzjn168', 'tanshu'].includes(sourceParam)
      ? (sourceParam as 'auto' | 'gzjn168' | 'tanshu')
      : 'auto';
    const data = await fetchMarketPricesWithRef(source);
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

export const GET = withApiLogging('metal-prices:market:GET', marketPricesGET);
