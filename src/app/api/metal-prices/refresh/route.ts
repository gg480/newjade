import { NextResponse } from 'next/server';
import { fetchMarketPricesWithRef, clearMarketPriceCache, clearCompetitorPriceCache } from '@/services/market-price.service';
import { clearLocalReferenceCache } from '@/services/local-reference-price.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { guardPermission } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';

/**
 * POST /api/metal-prices/refresh
 * 强制刷新贵金属行情价缓存并返回最新数据
 * 供外部定时任务（cron job）在 9:00/12:00/18:00 调用
 */
async function refreshPOST(request: Request) {
  const denied = await guardPermission(request, 'action:metal_price_manage');
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const sourceParam = url.searchParams.get('source') || 'auto';
    const source = ['auto', 'gzjn168', 'tanshu'].includes(sourceParam)
      ? (sourceParam as 'auto' | 'gzjn168' | 'tanshu')
      : 'auto';

    // 清除所有缓存，确保获取最新数据
    clearMarketPriceCache();
    clearCompetitorPriceCache();
    clearLocalReferenceCache();

    const data = await fetchMarketPricesWithRef(source);
    return NextResponse.json({
      code: 0,
      data,
      message: `已刷新行情数据（${source} 源），共 ${data.length} 条`,
    });
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

export const POST = withApiLogging('metal-prices:refresh:POST', refreshPOST);
