// 选品评分服务层 — 场景驱动多维度加权评分
// 计算 V/P/F/C/S 五个维度分，按场景权重加权，输出排序后的推广商品推荐列表

import { db } from '@/lib/db';
import type { SceneType, ProductScore, DimensionScores, SelectionParams } from '@/types/promotion';
import { PaginatedData } from '@/lib/api.types';

// ========== 权重矩阵（仅 Phase 1 的 5 个场景） ==========
const WEIGHT_MATRIX: Record<SceneType, { V: number; P: number; F: number; C: number; S: number }> = {
  new_arrival: { V: 25, P: 10, F: 40, C: 10, S: 15 },
  clearance:   { V: 20, P: 35, F: -25, C: 10, S: 10 },
  content:     { V: 40, P: 10, F: 10, C: 15, S: 25 },
  festival:    { V: 20, P: 25, F: 10, C: 15, S: 30 },
  knowledge:   { V: 15, P: 10, F: 10, C: 25, S: 40 },
};

/** Item + 关联数据原始查询结果 */
interface ItemRow {
  id: number;
  skuCode: string;
  name: string | null;
  status: string;
  costPrice: number | null;
  sellingPrice: number;
  notes: string | null;
  certNo: string | null;
  createdAt: Date;
  material: { id: number; name: string; category: string | null } | null;
  type: { id: number; name: string } | null;
  images: Array<{ filename: string; isCover: boolean; angleCode: string | null }>;
  itemTags: Array<{ tag: { name: string } }>;
}

// ========== 维度计算函数 ==========

async function fetchItems(params: SelectionParams): Promise<ItemRow[]> {
  const limit = Math.min(100, params.limit ?? 20);
  const status = params.status || 'in_stock';
  const where: Record<string, unknown> = { status, isDeleted: false };
  if (params.materialId) where.materialId = params.materialId;
  if (params.typeId) where.typeId = params.typeId;

  return db.item.findMany({
    where,
    select: {
      id: true, skuCode: true, name: true, status: true,
      costPrice: true, sellingPrice: true, notes: true,
      certNo: true, createdAt: true,
      material: { select: { id: true, name: true, category: true } },
      type: { select: { id: true, name: true } },
      images: { select: { filename: true, isCover: true, angleCode: true }, orderBy: { isCover: 'desc' } },
      itemTags: { select: { tag: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit * 3, // 多取一些，评分后截断
  }) as unknown as ItemRow[];
}

/** 视觉分 V(0-100)：封面图 + 图片数量 + 描述 */
function calcVisual(row: ItemRow): number {
  let score = 0;
  const hasCover = row.images.some(img => img.isCover);
  if (hasCover) score += 40;
  const imgCount = row.images.length;
  if (imgCount >= 4) score += 30;
  else if (imgCount >= 2) score += 20;
  else if (imgCount >= 1) score += 10;
  if (row.notes && row.notes.length >= 20) score += 30;
  return score;
}

/** 利润分 P(0-100)：毛利率 + 售价区间 */
function calcProfit(row: ItemRow): number {
  let score = 0;
  if (row.costPrice != null && row.costPrice > 0) {
    const margin = (row.sellingPrice - row.costPrice) / row.sellingPrice;
    if (margin >= 0.5) score += 60;
    else if (margin >= 0.3) score += 40;
    else if (margin >= 0.1) score += 20;
  }
  if (row.sellingPrice >= 500 && row.sellingPrice <= 5000) score += 40;
  else score += 20;
  return score;
}

/** 新鲜分 F(0-100)：入库天数 + 在库状态 */
function calcFreshness(row: ItemRow): number {
  let score = 0;
  const daysInStock = Math.floor((Date.now() - row.createdAt.getTime()) / 86400000);
  if (daysInStock <= 7) score += 60;
  else if (daysInStock <= 30) score += 40;
  else if (daysInStock <= 90) score += 20;
  if (row.status === 'in_stock') score += 40;
  return score;
}

/** 完整分 C(0-100)：信息齐全度 */
function calcCompleteness(row: ItemRow): number {
  let score = 0;
  if (row.name) score += 30;
  if (row.material) score += 30;
  if (row.type) score += 20;
  const tags = row.itemTags.map(t => t.tag.name);
  if (tags.length >= 2) score += 20;
  return score;
}

/** 故事分 S(0-100)：材质文化内涵 + 证书 + 描述 */
function calcStory(row: ItemRow): number {
  let score = 0;
  const cat = row.material?.category;
  if (cat === '玉') score += 30;
  else if (cat === '贵金属') score += 20;
  else if (cat === '水晶' || cat === '文玩') score += 15;
  if (row.certNo) score += 20;
  const hasFaceAngle = row.images.some(img => img.angleCode === 'F');
  if (hasFaceAngle) score += 15;
  if (row.notes && row.notes.length >= 50) score += 15;
  return score;
}

/** 场景专属 bonus 加分 */
function calcBonus(row: ItemRow, scene: SceneType): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let bonus = 0;
  const daysInStock = Math.floor((Date.now() - row.createdAt.getTime()) / 86400000);
  const tags = row.itemTags.map(t => t.tag.name);

  switch (scene) {
    case 'new_arrival':
      if (daysInStock <= 7) { bonus += 8; reasons.push('7天内新品'); }
      if (row.notes && row.notes.length >= 20) { bonus += 3; reasons.push('有商品描述'); }
      if (row.images.length >= 4) { bonus += 3; reasons.push('图片丰富'); }
      break;
    case 'clearance':
      if (daysInStock >= 90) { bonus += 8; reasons.push('在库超90天'); }
      if (row.sellingPrice < 1000) { bonus += 5; reasons.push('低价商品'); }
      if (row.costPrice && row.costPrice > 0 && ((row.sellingPrice - row.costPrice) / row.sellingPrice) > 0.3) {
        bonus += 3; reasons.push('利润空间充足');
      }
      break;
    case 'content':
      if (row.images.some(img => img.isCover)) { bonus += 5; reasons.push('有封面图'); }
      if (row.images.length >= 4) { bonus += 3; reasons.push('图片丰富'); }
      if (row.notes && row.notes.length >= 50) { bonus += 3; reasons.push('故事丰富'); }
      if (row.material?.category === '玉') { bonus += 3; reasons.push('玉类材质'); }
      break;
    case 'festival':
      if (row.certNo) { bonus += 5; reasons.push('有证书'); }
      if (row.sellingPrice >= 500 && row.sellingPrice <= 5000) { bonus += 5; reasons.push('送礼价位'); }
      if (row.material?.category === '贵金属') { bonus += 3; reasons.push('贵金属'); }
      break;
    case 'knowledge':
      if (row.material?.category === '玉') { bonus += 8; reasons.push('玉类材质适合科普'); }
      if (row.certNo) { bonus += 5; reasons.push('有鉴定证书'); }
      if (row.notes && row.notes.length >= 100) { bonus += 5; reasons.push('描述详尽'); }
      if (row.material?.category === '水晶' || row.material?.category === '文玩') { bonus += 3; reasons.push('小众材质'); }
      break;
  }
  return { score: bonus, reasons };
}

// ========== 主函数 ==========

export async function selectProducts(params: SelectionParams): Promise<PaginatedData<ProductScore>> {
  const page = params.page ?? 1;
  const limit = Math.min(100, params.limit ?? 20);
  const weights = WEIGHT_MATRIX[params.scene];

  // 1. 获取候选商品
  const rows = await fetchItems(params);

  // 2. 逐项评分
  const scored: ProductScore[] = rows.map(row => {
    const visual = calcVisual(row);
    const profit = calcProfit(row);
    const freshness = calcFreshness(row);
    const completeness = calcCompleteness(row);
    const story = calcStory(row);
    const { score: bonusScore, reasons: bonusReasons } = calcBonus(row, params.scene);

    const dimensions: DimensionScores = { visual, profit, freshness, completeness, story, bonus: bonusScore };

    // 加权综合分（清仓场景新鲜分反向加权）
    const finalScore = Math.round(
      (visual * weights.V + profit * weights.P + freshness * weights.F + completeness * weights.C + story * weights.S) / 100
      + bonusScore
    );

    // 构建推荐理由
    const reasons: string[] = [];
    if (dimensions.visual >= 70) reasons.push('视觉素材丰富');
    if (dimensions.profit >= 60) reasons.push('利润空间高');
    if (dimensions.freshness >= 60) reasons.push('近期入库');
    if (dimensions.story >= 50) reasons.push('有故事性');
    if (row.certNo) reasons.push('有证书');
    reasons.push(...bonusReasons);

    const tags = row.itemTags.map(t => t.tag.name);
    const images = row.images.map(img => img.filename);

    return {
      itemId: row.id,
      sku: row.skuCode,
      name: row.name,
      materialName: row.material?.name ?? null,
      typeName: row.type?.name ?? null,
      tags,
      images,
      sellingPrice: row.sellingPrice,
      costPrice: row.costPrice,
      status: row.status,
      score: Math.max(0, finalScore),
      dimensions,
      reasons,
    };
  });

  // 3. 排序：综合分降序
  scored.sort((a, b) => b.score - a.score);

  // 4. 分页
  const total = scored.length;
  const start = (page - 1) * limit;
  const items = scored.slice(start, start + limit);

  return {
    items,
    pagination: {
      page,
      size: limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
