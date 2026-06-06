// ============================================================
// 本地参考行情服务（gzjn168.com 融通金）
// 直接调用 gzjn168.com/admin/get_price5.php（AJAX API）
// 返回 CSV 格式：price,回购1,销售1,回购2,销售2,...,更新时间
// ============================================================

import type { LocalReferencePriceItem, LocalReferenceResponse } from '@/lib/api.types';

// ============================================================
// 内存缓存（5 分钟有效期，仅缓存成功结果）
// ============================================================

interface CacheEntry {
  data: LocalReferenceResponse;
  expiresAt: number;
}

let priceCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

// ============================================================
// gzjn168.com PHP API CSV 解析
// ============================================================

/** 融通金 AJAX 数据接口 */
const GZJN_API_URL = 'http://gzjn168.com/admin/get_price5.php';

/**
 * CSV 字段映射（price, rs[1], rs[2], ...）
 * rs[1]=黄金回购, rs[2]=黄金销售, rs[3]=白银回购, rs[4]=白银销售,
 * rs[5]=铂金回购, rs[6]=铂金销售, rs[7]=钯金回购, rs[8]=钯金销售,
 * rs[9]=港金回购, rs[10]=港金销售, rs[16]=更新时间
 */
interface MetalConfig {
  name: string;
  buyIndex: number;
  sellIndex: number;
}

const METAL_CONFIGS: MetalConfig[] = [
  { name: '黄金', buyIndex: 1, sellIndex: 2 },
  { name: '白银', buyIndex: 3, sellIndex: 4 },
  { name: '铂金', buyIndex: 5, sellIndex: 6 },
  { name: '钯金', buyIndex: 7, sellIndex: 8 },
  { name: '港金', buyIndex: 9, sellIndex: 10 },
];

const TIME_INDEX = 16;

/**
 * 解析 PHP API 返回的 CSV 数据
 * 格式：price,971.86,974.26,16.32,16.72,...,17:29:08
 */
function parseCsvResponse(csv: string): { items: LocalReferencePriceItem[]; time: string } {
  const parts = csv.split(',').map(s => s.trim());

  const time = parts[TIME_INDEX] || '';

  const items: LocalReferencePriceItem[] = [];
  for (const cfg of METAL_CONFIGS) {
    const buyPrice = parseFloat(parts[cfg.buyIndex]) || 0;
    const sellPrice = parseFloat(parts[cfg.sellIndex]) || 0;
    items.push({
      name: cfg.name,
      buyPrice,
      sellPrice,
      updatedAt: time,
    });
  }

  return { items, time };
}

/**
 * 从 gzjn168.com PHP API 获取贵金属参考行情
 * 内部 5 分钟内存缓存（仅缓存成功结果）
 */
export async function fetchLocalReferencePrices(): Promise<LocalReferenceResponse> {
  // 检查缓存
  if (priceCache && Date.now() < priceCache.expiresAt) {
    return priceCache.data;
  }

  const now = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(GZJN_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        items: [],
        message: `HTTP ${response.status}`,
        fetchedAt: now,
      };
    }

    const csv = await response.text();

    if (!csv || csv.length < 20 || !csv.startsWith('price,')) {
      return {
        available: false,
        items: [],
        message: '数据格式异常',
        fetchedAt: now,
      };
    }

    const { items, time } = parseCsvResponse(csv);

    // 检查数据有效性：至少黄金销售价 > 0
    const hasValidData = items.some(i => i.sellPrice > 0);
    if (!hasValidData) {
      return {
        available: false,
        items: [],
        message: '未获取到有效价格',
        fetchedAt: now,
      };
    }

    const result: LocalReferenceResponse = {
      available: true,
      items,
      fetchedAt: now,
    };

    // 仅缓存成功结果
    priceCache = {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return result;
  } catch (err) {
    // 不缓存失败结果，确保下次可以重试
    return {
      available: false,
      items: [],
      message: (err as Error).name === 'AbortError'
        ? '请求超时'
        : `网络错误: ${(err as Error).message}`,
      fetchedAt: now,
    };
  }
}

export function clearLocalReferenceCache(): void {
  priceCache = null;
}
