import { db } from '@/lib/db';
import { fetchMarketPrices } from '@/services/market-price.service';

// ============================================================
// 类型定义
// ============================================================

export interface GoldAlertItem {
  itemId: number;
  skuCode: string;
  name: string | null;
  materialId: number;
  materialName: string;
  typeName: string | null;
  weight: number;
  costPrice: number;
  costPerGram: number;
  marketPricePerGram: number;
  deviation: number;       // marketPricePerGram - costPerGram
  deviationPercent: number; // deviation / marketPricePerGram * 100
  tagged: boolean;          // 当前是否已标记为"需预定"
}

export interface GoldAlertResult {
  items: GoldAlertItem[];
  totalCount: number;
  alertCount: number;       // 偏离 > 50 的件数
  marketSource: string;     // 数据源
  updatedAt: string;        // 行情更新时间
  summary: {
    avgDeviation: number;
    maxDeviation: number;
    minDeviation: number;
  };
}

// ============================================================
// 行情码 → 材质类别映射（用于识别贵金属行情码）
// ============================================================

const PRECIOUS_METAL_SUBTYPES = ['Au9999', 'AgT+D', 'PT9995'];

// ============================================================
// 核心方法
// ============================================================

/**
 * 获取黄金预警数据
 * 1. 从融通金获取行情价
 * 2. 查找所有贵金属材质的在库货品
 * 3. 计算每件货品的成本克重单价 = costPrice / weight
 * 4. 比对行情价，偏离超过 50 的标记为"需预定"
 */
export async function getGoldAlertData(): Promise<GoldAlertResult> {
  // 1. 获取行情价
  let marketPrices = await fetchMarketPrices('auto');
  const marketSource = '融通金';

  // 构建行情码 → 价格映射
  const marketPriceMap = new Map<string, number>();
  for (const mp of marketPrices) {
    marketPriceMap.set(mp.code, mp.price);
  }

  // 2. 查询所有贵金属材质（category = '贵金属' 或 subType 匹配行情码）
  const materials = await db.dictMaterial.findMany({
    where: {
      OR: [
        { category: '贵金属' },
        { subType: { in: PRECIOUS_METAL_SUBTYPES } },
      ],
      isActive: true,
    },
  });

  if (materials.length === 0) {
    return {
      items: [],
      totalCount: 0,
      alertCount: 0,
      marketSource,
      updatedAt: new Date().toISOString(),
      summary: { avgDeviation: 0, maxDeviation: 0, minDeviation: 0 },
    };
  }

  const materialIds = materials.map(m => m.id);

  // 构建材质ID → 行情价映射
  // 优先使用材质的 subType 匹配行情码，否则使用 costPerGram 作为参考价
  const marketPriceByMaterial = new Map<number, number>();
  for (const mat of materials) {
    if (mat.subType && marketPriceMap.has(mat.subType)) {
      marketPriceByMaterial.set(mat.id, marketPriceMap.get(mat.subType)!);
    } else if (mat.costPerGram) {
      // 无行情码时使用系统记录的最新克价
      const latestPrice = await db.metalPrice.findFirst({
        where: { materialId: mat.id },
        orderBy: { effectiveDate: 'desc' },
      });
      marketPriceByMaterial.set(mat.id, latestPrice?.pricePerGram ?? mat.costPerGram);
    }
  }

  // 3. 查询在库货品（含 spec.weight）
  const items = await db.item.findMany({
    where: {
      materialId: { in: materialIds },
      status: 'in_stock',
      isDeleted: false,
      costPrice: { not: null },
    },
    include: {
      spec: true,
      material: true,
      type: true,
      itemTags: { include: { tag: true } },
    },
  });

  // 4. 计算每件的成本克重单价
  const result: GoldAlertItem[] = [];
  const deviationValues: number[] = [];

  for (const item of items) {
    const weight = item.spec?.weight;
    if (!weight || weight <= 0) continue;
    if (!item.costPrice || item.costPrice <= 0) continue;

    const costPerGram = item.costPrice / weight;
    const marketPricePerGram = marketPriceByMaterial.get(item.materialId);

    if (!marketPricePerGram || marketPricePerGram <= 0) continue;

    const deviation = marketPricePerGram - costPerGram;
    const deviationPercent = (deviation / marketPricePerGram) * 100;

    // 检查是否已有"需预定"标签
    const hasGoodTag = item.itemTags.some(it => it.tag.name === '需预定');

    // 偏离超过 50 的才算预警
    if (deviation > 50) {
      deviationValues.push(deviation);
    }

    result.push({
      itemId: item.id,
      skuCode: item.skuCode,
      name: item.name,
      materialId: item.materialId,
      materialName: item.material.name,
      typeName: item.type?.name ?? null,
      weight,
      costPrice: item.costPrice,
      costPerGram: Math.round(costPerGram * 100) / 100,
      marketPricePerGram,
      deviation: Math.round(deviation * 100) / 100,
      deviationPercent: Math.round(deviationPercent * 100) / 100,
      tagged: hasGoodTag,
    });
  }

  // 按偏离降序排列
  result.sort((a, b) => b.deviation - a.deviation);

  const alertItems = result.filter(r => r.deviation > 50);

  return {
    items: result,
    totalCount: result.length,
    alertCount: alertItems.length,
    marketSource,
    updatedAt: new Date().toISOString(),
    summary: {
      avgDeviation: deviationValues.length > 0
        ? Math.round((deviationValues.reduce((s, v) => s + v, 0) / deviationValues.length) * 100) / 100
        : 0,
      maxDeviation: deviationValues.length > 0 ? Math.max(...deviationValues) : 0,
      minDeviation: deviationValues.length > 0 ? Math.min(...deviationValues) : 0,
    },
  };
}

/**
 * 自动标记"需预定"标签
 * - 偏离 > 50 的货品自动添加"需预定"标签
 * - 偏离 ≤ 50 的货品自动移除"需预定"标签
 * @returns 新增标记数和移除标记数
 */
export async function autoTagGoldAlert(): Promise<{ tagged: number; untagged: number }> {
  // 1. 获取预警数据
  const alertData = await getGoldAlertData();

  // 2. 查找或创建"需预定"标签
  let goodTag = await db.dictTag.findFirst({ where: { name: '需预定' } });
  if (!goodTag) {
    goodTag = await db.dictTag.create({
      data: { name: '需预定', groupName: '预警', isGlobal: true },
    });
  }

  let tagged = 0;
  let untagged = 0;

  for (const item of alertData.items) {
    const shouldHaveTag = item.deviation > 50;
    const hasTag = item.tagged;

    if (shouldHaveTag && !hasTag) {
      // 添加标签
      await db.itemTag.create({
        data: { itemId: item.itemId, tagId: goodTag.id },
      });
      tagged++;
    } else if (!shouldHaveTag && hasTag) {
      // 移除标签
      await db.itemTag.deleteMany({
        where: { itemId: item.itemId, tagId: goodTag.id },
      });
      untagged++;
    }
  }

  return { tagged, untagged };
}
