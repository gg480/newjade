import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ============================================================
// 类型定义
// ============================================================

export interface CurrentPriceItem {
  materialId: number;
  materialName: string;
  subType: string | null;
  costPerGram: number | null;
  currentPrice: number;
  effectiveDate: string | null;
  lastUpdated: Date | null;
}

export interface PriceHistoryParams {
  materialId?: string | null;
  limit?: number;
}

export interface PriceHistoryItem {
  id: number;
  materialId: number;
  pricePerGram: number;
  effectiveDate: string;
  materialName: string | null;
  createdAt: Date;
}

export interface RepricePreviewItem {
  skuCode: string;
  name: string | null;
  oldPrice: number;
  newPrice: number;
  itemId: number;
}

export interface RepricePreviewResult {
  affectedItems: RepricePreviewItem[];
}

export interface RepriceConfirmResult {
  updatedCount: number;
}

export interface CreatePriceInput {
  materialId: number;
  pricePerGram: number;
}

// ============================================================
// 服务方法
// ============================================================

/**
 * 获取各材质最新价格列表
 * 查询所有有克价的材质，附带最新一条价格记录
 */
export async function getCurrentPrices(): Promise<CurrentPriceItem[]> {
  const materials = await db.dictMaterial.findMany({
    where: { costPerGram: { not: null } },
    include: { metalPrices: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
  });

  return materials.map(m => ({
    materialId: m.id,
    materialName: m.name,
    subType: m.subType,
    costPerGram: m.costPerGram,
    currentPrice: m.metalPrices[0]?.pricePerGram || m.costPerGram || 0,
    effectiveDate: m.metalPrices[0]?.effectiveDate || null,
    lastUpdated: m.metalPrices[0]?.createdAt || null,
  }));
}

/**
 * 获取价格历史（按日期降序，可筛选材质）
 */
export async function getPriceHistory(params: PriceHistoryParams): Promise<PriceHistoryItem[]> {
  const where: any = {};
  if (params.materialId) where.materialId = parseInt(params.materialId);

  const records = await db.metalPrice.findMany({
    where,
    include: { material: true },
    orderBy: { effectiveDate: 'desc' },
    take: params.limit || 20,
  });

  return records.map(r => ({
    id: r.id,
    materialId: r.materialId,
    pricePerGram: r.pricePerGram,
    effectiveDate: r.effectiveDate,
    materialName: r.material?.name || null,
    createdAt: r.createdAt,
  }));
}

/**
 * 创建新的价格记录（同时更新材质的 costPerGram）
 * @throws {ValidationError} 参数校验失败时抛出
 */
export async function createPriceRecord(data: CreatePriceInput) {
  const today = new Date().toISOString().slice(0, 10);

  if (!data.materialId || isNaN(data.materialId)) {
    throw new ValidationError('请选择材质');
  }
  if (data.pricePerGram === null || data.pricePerGram === undefined || isNaN(data.pricePerGram) || data.pricePerGram <= 0) {
    throw new ValidationError('请输入有效的克价');
  }

  const record = await db.metalPrice.create({
    data: { materialId: data.materialId, pricePerGram: data.pricePerGram, effectiveDate: today },
  });

  await db.dictMaterial.update({
    where: { id: data.materialId },
    data: { costPerGram: data.pricePerGram },
  });

  return record;
}

/**
 * 重定价预览：计算按新克价批量重算后的售价
 * @throws {ValidationError} 参数校验失败时抛出
 * @throws {NotFoundError} 材质不存在时抛出
 */
export async function previewReprice(materialId: number, newPricePerGram: number): Promise<RepricePreviewResult> {
  if (!materialId || isNaN(materialId)) {
    throw new ValidationError('请选择材质');
  }
  if (newPricePerGram === null || newPricePerGram === undefined || isNaN(newPricePerGram) || newPricePerGram <= 0) {
    throw new ValidationError('请输入有效的新克价');
  }

  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  if (!material) {
    throw new NotFoundError('材质不存在');
  }

  const oldPrice = material.costPerGram || 0;

  const items = await db.item.findMany({
    where: { materialId, status: 'in_stock', isDeleted: false },
    include: { spec: true },
  });

  const affectedItems = items
    .filter(item => item.spec?.weight && item.spec.weight > 0)
    .map(item => {
      const weight = item.spec!.weight!;
      const laborCost = item.sellingPrice - weight * oldPrice;
      const newPrice = Math.round((weight * newPricePerGram + laborCost) * 100) / 100;
      return {
        skuCode: item.skuCode,
        name: item.name,
        oldPrice: item.sellingPrice,
        newPrice,
        itemId: item.id,
      };
    });

  return { affectedItems };
}

/**
 * 确认重定价：更新货品售价 + 更新材质克价 + 新增价格历史
 * @throws {NotFoundError} 材质不存在时抛出
 */
export async function confirmReprice(materialId: number, newPricePerGram: number): Promise<RepriceConfirmResult> {
  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  if (!material) {
    throw new NotFoundError('材质不存在');
  }

  const oldPrice = material.costPerGram || 0;

  const items = await db.item.findMany({
    where: { materialId, status: 'in_stock', isDeleted: false },
    include: { spec: true },
  });

  let updatedCount = 0;
  for (const item of items) {
    if (!item.spec?.weight || item.spec.weight <= 0) continue;
    const weight = item.spec.weight;
    const laborCost = item.sellingPrice - weight * oldPrice;
    const newPrice = Math.round((weight * newPricePerGram + laborCost) * 100) / 100;
    await db.item.update({ where: { id: item.id }, data: { sellingPrice: newPrice } });
    updatedCount++;
  }

  await db.dictMaterial.update({ where: { id: materialId }, data: { costPerGram: newPricePerGram } });

  const today = new Date().toISOString().slice(0, 10);
  await db.metalPrice.create({ data: { materialId, pricePerGram: newPricePerGram, effectiveDate: today } });

  return { updatedCount };
}
