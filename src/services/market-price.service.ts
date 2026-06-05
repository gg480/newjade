import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { fetchLocalReferencePrices } from '@/services/local-reference-price.service';

// ============================================================
// 类型定义
// ============================================================

export interface MarketPriceItem {
  code: string;      // 行情码: Au9999, Ag(T+D), Pt9995
  price: number;     // 元/克
  unit: string;      // 元/克
  updatedAt: string; // 数据时间
}

// ============================================================
// 内存缓存（5 分钟有效期）
// ============================================================

interface CacheEntry {
  data: MarketPriceItem[];
  expiresAt: number;
}

let priceCache: CacheEntry | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

function getFromCache(): MarketPriceItem[] | null {
  if (priceCache && Date.now() < priceCache.expiresAt) {
    return priceCache.data;
  }
  return null;
}

function setCache(data: MarketPriceItem[]): void {
  priceCache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

// ============================================================
// 探数API 响应类型
// ============================================================

interface TanshuGoldItem {
  type: string;         // 品种代码，如 Au9999, Ag(T+D), Pt9995
  typename: string;     // 品种中文名
  price: string;        // 最新价
  buyprice?: string;    // 买入价
  sellprice?: string;   // 卖出价
  unit: string;         // 单位: 元/克 or 元/千克
  updatetime?: string;  // 更新时间
}

interface TanshuApiResponse {
  code?: number;
  msg?: string;
  data?: {
    list?: Record<string, TanshuGoldItem>;
  };
}

// ============================================================
// 探数API 路由配置 — 每个行情码对应一个API子接口
// ============================================================

/** API 完整URL（不含key参数） */
const API_URLS: Record<string, string> = {
  gold:   'https://api2.tanshuapi.com/api/gold/v1/shgold2',
  silver: 'https://api2.tanshuapi.com/api/silver/v1/shgold3',
};

/** 行情码 → 使用哪个API */
const CODE_API_MAP: Record<string, string> = {
  Au9999: 'gold',      // 上海黄金交易所 黄金9999
  PT9995: 'gold',      // 上海黄金交易所 铂金9995
  'AgT+D': 'silver',   // 上海黄金交易所 白银延期（元/千克，需÷1000）
};

/** 需要除1000的行情码（探数API某些品种以元/千克返回） */
const CODES_NEED_DIVISION = new Set<string>(['AgT+D']);

/**
 * gzjn168.com 金属名 → 行情码映射
 * 用于融通金数据源：将抓取的零售金价映射到交易所行情码
 */
const GZJN_TO_CODE_MAP: Record<string, string> = {
  '黄金': 'Au9999',
  '白银': 'AgT+D',
  '铂金': 'PT9995',
  // 钯金/港金无对应行情码，跳过
};

/**
 * 调用单个探数API子接口，提取指定行情码的数据
 */
async function fetchFromEndpoint(
  apiKey: string,
  apiName: string,
  codes: string[],
): Promise<MarketPriceItem[]> {
  const url = `${API_URLS[apiName]}?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AppError('行情数据请求超时，请稍后重试', 502, 502);
    }
    throw new AppError('行情数据请求失败，请稍后重试', 502, 502);
  }

  if (!response.ok) {
    throw new AppError('行情数据服务暂时不可用', 502, 502);
  }

  let json: TanshuApiResponse;
  try {
    json = await response.json();
  } catch {
    throw new AppError('行情数据格式异常', 502, 502);
  }

  if (json.code !== 1) {
    throw new AppError('行情数据服务返回异常，请稍后重试', 502, 502);
  }

  const list = json.data?.list;
  if (!list || Object.keys(list).length === 0) {
    return [];
  }

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const results: MarketPriceItem[] = [];

  for (const code of codes) {
    const matched = list[code];
    if (!matched) continue;

    let price = parseFloat(matched.price);
    if (isNaN(price)) continue;

    if (CODES_NEED_DIVISION.has(code)) {
      price = price / 1000;
    }

    price = Math.round(price * 1000) / 1000;

    const updatedAt = matched.updatetime
      ? matched.updatetime.slice(0, 16).replace('T', ' ')
      : now;

    results.push({ code, price, unit: '元/克', updatedAt });
  }

  return results;
}

/**
 * 从探数API获取贵金属行情价（私有函数，不管理缓存）
 * 按 endpoint 分组去重调用，返回行情价列表
 * @throws {AppError} API不可用时抛出
 */
async function fetchFromTanshu(): Promise<MarketPriceItem[]> {
  // 1. 从 SysConfig 读取 API Key
  const config = await db.sysConfig.findUnique({ where: { key: 'tanshu_api_key' } });
  const apiKey = config?.value?.trim();
  if (!apiKey) {
    throw new AppError('探数API Key 未配置，请在系统设置中填写 tanshu_api_key', 400, 400);
  }

  // 2. 按 endpoint 分组，去重调用
  const allCodes = Object.keys(CODE_API_MAP);
  const endpoints = [...new Set(Object.values(CODE_API_MAP))];

  const prices: MarketPriceItem[] = [];

  for (const endpoint of endpoints) {
    const codesForThisEndpoint = allCodes.filter((c) => CODE_API_MAP[c] === endpoint);
    const results = await fetchFromEndpoint(apiKey, endpoint, codesForThisEndpoint);
    prices.push(...results);
  }

  if (prices.length === 0) {
    throw new AppError('未获取到有效的行情数据', 502, 502);
  }

  return prices;
}

/**
 * 从 gzjn168.com 获取行情价并映射为 MarketPriceItem
 * 使用销售价（sellPrice）作为行情价 price
 * 内部通过 fetchLocalReferencePrices 已有 5 分钟缓存
 */
async function fetchFromGzjn168(): Promise<MarketPriceItem[]> {
  const ref = await fetchLocalReferencePrices();
  if (!ref.available || ref.items.length === 0) {
    throw new AppError('无法从融通金获取行情数据', 502, 502);
  }

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const results: MarketPriceItem[] = [];

  for (const item of ref.items) {
    const code = GZJN_TO_CODE_MAP[item.name];
    if (!code) continue; // 跳过无映射的金属（钯金/港金）

    // 使用销售价作为行情价
    const price = item.sellPrice;
    if (price <= 0) continue;

    results.push({
      code,
      price: Math.round(price * 1000) / 1000,
      unit: '元/克',
      updatedAt: item.updatedAt
        ? `${now.slice(0, 10)} ${item.updatedAt}`
        : now,
    });
  }

  if (results.length === 0) {
    throw new AppError('未能从融通金行情中提取有效数据', 502, 502);
  }

  return results;
}

/**
 * 获取贵金属行情价
 * 支持三种数据源：
 *   - gzjn168: 从融通金(gzjn168.com)抓取零售金价
 *   - tanshu:  从探数API获取上海金交所交易所行情价
 *   - auto:    优先融通金（gzjn168），失败时回退到探数API
 * auto 模式下 gzjn168 使用其内部 5 分钟缓存；tanshu 数据使用独立 5 分钟缓存
 */
export async function fetchMarketPrices(
  source: 'auto' | 'gzjn168' | 'tanshu' = 'auto'
): Promise<MarketPriceItem[]> {
  // gzjn168 源：走融通金（不走 tanshu 缓存）
  if (source === 'gzjn168') {
    return fetchFromGzjn168();
  }

  // tanshu 源：只走探数API
  if (source === 'tanshu') {
    let cached = getFromCache();
    if (cached) {
      if (shouldRefresh()) {
        clearMarketPriceCache();
        cached = null;
      } else {
        return cached;
      }
    }
    const prices = await fetchFromTanshu();
    setCache(prices);
    return prices;
  }

  // auto 模式：优先融通金，失败回退探数API
  try {
    return await fetchFromGzjn168();
  } catch {
    let cached = getFromCache();
    if (cached) {
      if (shouldRefresh()) {
        clearMarketPriceCache();
        cached = null;
      } else {
        return cached;
      }
    }
    const prices = await fetchFromTanshu();
    setCache(prices);
    return prices;
  }
}

/**
 * 从探数API获取行情价（含材质折算参考价 + 最终克价）
 * refPrice = 行情价 * marketRatio（行情参考价）
 * finalPrice = 行情价 * marketRatio + laborCostPerGram（最终克价，含工费）
 */
export interface MarketPriceWithRef extends MarketPriceItem {
  materialId: number | null;
  materialName: string | null;
  marketRatio: number | null;
  refPrice: number | null;      // 参考价 = 行情价 * marketRatio
  laborCostPerGram: number | null; // 工费单价（元/克）
  finalPrice: number | null;    // 最终克价 = 行情价 * marketRatio + 工费单价
}

/**
 * 获取行情价及对应材质的参考价与最终克价
 * 查询 DictMaterial 中 subType 匹配行情码的材质记录
 * @param source 数据源，传递给 fetchMarketPrices
 */
export async function fetchMarketPricesWithRef(
  source?: 'auto' | 'gzjn168' | 'tanshu'
): Promise<MarketPriceWithRef[]> {
  const marketPrices = await fetchMarketPrices(source);

  // 找到所有有行情码的材质
  const materials = await db.dictMaterial.findMany({
    where: {
      subType: { in: Object.keys(CODE_API_MAP) },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      subType: true,
      marketRatio: true,
      laborCostPerGram: true,
    },
  });

  const result: MarketPriceWithRef[] = [];

  for (const mp of marketPrices) {
    // 找到匹配该行情码的材质
    const matchedMaterials = materials.filter(
      (m) => m.subType?.toLowerCase() === mp.code.toLowerCase()
    );

    if (matchedMaterials.length > 0) {
      for (const mat of matchedMaterials) {
        const ratio = mat.marketRatio ?? null;
        const laborCost = mat.laborCostPerGram ?? null;
        const refPrice = ratio !== null ? Math.round(mp.price * ratio * 100) / 100 : null;
        const finalPrice = refPrice !== null && laborCost !== null
          ? Math.round((refPrice + laborCost) * 100) / 100
          : refPrice;
        result.push({
          ...mp,
          materialId: mat.id,
          materialName: mat.name,
          marketRatio: ratio,
          refPrice,
          laborCostPerGram: laborCost,
          finalPrice,
        });
      }
    } else {
      // 行情码没有对应材质，仍然返回行情信息
      result.push({
        ...mp,
        materialId: null,
        materialName: null,
        marketRatio: null,
        refPrice: null,
        laborCostPerGram: null,
        finalPrice: null,
      });
    }
  }

  return result;
}

/**
 * 清除行情价缓存（用于手动刷新）
 */
export function clearMarketPriceCache(): void {
  priceCache = null;
}

// ============================================================
// 竞品金价 — storegold2 API（1小时内存缓存）
// ============================================================

export interface CompetitorGoldPrice {
  name: string;
  gold: number;
  platinum: string | null;
  goldbar: string | null;
  unit: string;
  date: string;
}

/** 探数 storegold2 API 响应中单条品牌数据 */
interface TanshuStoreGoldItem {
  typename: string;     // 品牌名，如 周大福（API返回字段）
  name?: string;        // 兼容备用
  gold: string;         // 黄金价格（元/克），如 "719"
  platinum?: string;    // 铂金价格
  goldbar?: string;     // 金条价格
  unit: string;         // 单位: "元/克" | "港币/克" | "台币/克" 等
  date?: string;        // 发布日期
}

interface TanshuStoreGoldResponse {
  code?: number;
  msg?: string;
  data?: {
    list?: TanshuStoreGoldItem[];
  };
}

interface CompetitorCacheEntry {
  data: CompetitorGoldPrice[];
  expiresAt: number;
}

let competitorCache: CompetitorCacheEntry | null = null;
const COMPETITOR_CACHE_TTL_MS = 60 * 60 * 1000; // 1小时

/** 港台货币单位（需过滤，单位不一致） */
const HKTWD_UNITS = new Set(['港币/克', '台币/克', '港幣/克', '臺幣/克', '港币/两', '台币/两', '港幣/兩', '臺幣/兩']);

/**
 * 获取各品牌金店金价（探数API storegold2）
 * 1小时内存缓存，自动过滤港台店铺
 * @returns 品牌金价列表
 * @throws {AppError} API不可用时抛出
 */
export async function fetchCompetitorGoldPrices(): Promise<CompetitorGoldPrice[]> {
  // 1. 检查缓存
  if (competitorCache && Date.now() < competitorCache.expiresAt) {
    return competitorCache.data;
  }

  // 2. 从 SysConfig 读取 API Key
  const config = await db.sysConfig.findUnique({ where: { key: 'tanshu_api_key' } });
  const apiKey = config?.value?.trim();
  if (!apiKey) {
    throw new AppError('探数API Key 未配置，请在系统设置中填写 tanshu_api_key', 400, 400);
  }

  const url = `https://api2.tanshuapi.com/api/gold/v1/storegold2?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AppError('竞品金价请求超时，请稍后重试', 502, 502);
    }
    throw new AppError('竞品金价请求失败，请稍后重试', 502, 502);
  }

  if (!response.ok) {
    throw new AppError('竞品金价服务暂时不可用', 502, 502);
  }

  let json: TanshuStoreGoldResponse;
  try {
    json = await response.json();
  } catch {
    throw new AppError('竞品金价数据格式异常', 502, 502);
  }

  if (json.code !== 1) {
    throw new AppError(`竞品金价API返回错误: ${json.msg || `code=${json.code}`}`, 502, 502);
  }

  const rawData = json.data?.list;
  if (!rawData || rawData.length === 0) {
    return [];
  }

  // 过滤港台店铺，解析并整理
  const today = new Date().toISOString().slice(0, 10);
  const result: CompetitorGoldPrice[] = [];

  for (const item of rawData) {
    // 过滤港台货币单位（与人民币换算不一致）
    if (item.unit && HKTWD_UNITS.has(item.unit)) continue;

    const gold = parseInt(item.gold, 10);
    if (isNaN(gold)) continue;

    result.push({
      name: item.typename || item.name,
      gold,
      platinum: item.platinum ?? null,
      goldbar: item.goldbar ?? null,
      unit: item.unit || '元/克',
      date: item.date || today,
    });
  }

  // 写入缓存
  competitorCache = {
    data: result,
    expiresAt: Date.now() + COMPETITOR_CACHE_TTL_MS,
  };

  return result;
}

/**
 * 清除竞品金价缓存（用于手动刷新）
 */
export function clearCompetitorPriceCache(): void {
  competitorCache = null;
}

// ============================================================
// 定时刷新逻辑
// ============================================================

/**
 * 检查是否应该刷新行情价缓存
 * 在 9:00、12:00、18:00 三个时间窗口内，如果缓存是昨天的则触发刷新
 */
export function shouldRefresh(): boolean {
  const now = new Date();
  const hour = now.getHours();
  // 9:00, 12:00, 18:00 三个时间窗口（前后30分钟）
  const scheduledHours = [9, 12, 18];
  const inWindow = scheduledHours.some(h => hour >= h && hour < h + 1);
  if (!inWindow) return false;

  // 检查缓存时间是否早于今天的该时段
  const today = now.toISOString().slice(0, 10);
  // 从缓存中取第一条数据的日期（如果缓存存在）
  if (!priceCache || !priceCache.data || priceCache.data.length === 0) return true;
  const cacheDate = priceCache.data[0]?.updatedAt?.slice(0, 10);
  return cacheDate !== today;
}
