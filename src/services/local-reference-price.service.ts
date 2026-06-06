// ============================================================
// 本地参考行情服务（gzjn168.com 融通金）
// 从 http://gzjn168.com/phone.html 抓取 HTML 并解析贵金属价格
// ============================================================

export interface LocalReferenceItem {
  name: string;
  sellPrice: number;
  buyPrice: number;
}

export interface LocalReferenceResponse {
  available: boolean;
  items: LocalReferenceItem[];
  message?: string;
  cachedAt?: string;
}

// ============================================================
// 内存缓存（5 分钟有效期）
// ============================================================

interface CacheEntry {
  data: LocalReferenceResponse;
  expiresAt: number;
}

let priceCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

// ============================================================
// HTML 解析 — gzjn168.com/phone.html
// ============================================================

const GZJN_URL = 'http://gzjn168.com/phone.html';

/**
 * 从 HTML table rows 中解析贵金属价格
 * phone.html 页面结构：包含 <table> → <tr> → <td>
 * 每行格式：品种名 | 销售价 | 回购价
 */
function parsePhoneHtml(html: string): LocalReferenceItem[] {
  const items: LocalReferenceItem[] = [];

  // 提取 <table> 内容（第一个表格）
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    // 回退：尝试直接找 <tr>
    return parseTrRows(html);
  }

  const tableHtml = tableMatch[1];
  const trMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const trList: string[] = [];
  for (const m of trMatches) {
    trList.push(m[1]);
  }

  if (trList.length === 0) {
    return parseTrRows(html);
  }

  return parseTrs(trList);
}

function parseTrRows(html: string): LocalReferenceItem[] {
  const trMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const trList: string[] = [];
  for (const m of trMatches) {
    trList.push(m[1]);
  }
  return parseTrs(trList);
}

function parseTrs(trList: string[]): LocalReferenceItem[] {
  const items: LocalReferenceItem[] = [];

  for (const rowHtml of trList) {
    // 提取所有 <td> 内容
    const tdMatches = rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    const cells: string[] = [];
    for (const m of tdMatches) {
      // 去除 HTML 标签和空白
      const text = m[1].replace(/<[^>]*>/g, '').trim();
      cells.push(text);
    }

    // 过滤表头行
    if (cells.length < 2) continue;
    // 跳过纯数字标题行（全数字或为空）
    if (cells.every(c => /^[\d\s]*$/.test(c))) continue;

    // 取前 3 列：品种名、销售价、回购价
    const name = cells[0];
    const sellPrice = parseFloat(cells[1]?.replace(/[^\d.]/g, '') || '0');
    const buyPrice = parseFloat(cells[2]?.replace(/[^\d.]/g, '') || '0');

    if (!name || isNaN(sellPrice) || isNaN(buyPrice)) continue;

    items.push({ name, sellPrice, buyPrice });
  }

  return items;
}

/**
 * 从 gzjn168.com 抓取并解析贵金属参考行情
 * 内部 5 分钟内存缓存
 */
export async function fetchLocalReferencePrices(): Promise<LocalReferenceResponse> {
  // 检查缓存
  if (priceCache && Date.now() < priceCache.expiresAt) {
    return priceCache.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(GZJN_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        items: [],
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    // 检测是否被重定向到登录/错误页面
    if (html.length < 100 || !/(<table|<tr|<td)/i.test(html)) {
      return {
        available: false,
        items: [],
        message: '网站数据格式异常，可能页面结构已变更',
      };
    }

    const items = parsePhoneHtml(html);

    if (items.length === 0) {
      return {
        available: false,
        items: [],
        message: '未能从页面中解析到有效价格数据',
      };
    }

    const result: LocalReferenceResponse = {
      available: true,
      items,
      cachedAt: new Date().toISOString(),
    };

    // 写入缓存
    priceCache = {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return result;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        available: false,
        items: [],
        message: '请求融通金网站超时',
      };
    }
    return {
      available: false,
      items: [],
      message: `网络请求失败: ${(err as Error).message}`,
    };
  }
}

export function clearLocalReferenceCache(): void {
  priceCache = null;
}
