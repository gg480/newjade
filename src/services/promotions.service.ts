import { db } from '@/lib/db';
import { logAction } from '@/lib/log';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ============================================================
// 类型定义
// ============================================================

export interface PromotionListQuery {
  page?: number;
  size?: number;
  status?: string;
  type?: string;
  keyword?: string;
}

export interface CreatePromotionInput {
  name: string;
  type: string;
  discountValue?: number;
  condition?: number;
  startDate: string;
  endDate: string;
  recurrence?: string;
  status?: string;
  targetMaterials?: string;
  targetTypes?: string;
}

/** 更新促销输入，所有字段可选 */
export type UpdatePromotionInput = Partial<CreatePromotionInput>;

export interface PromotionWithItemCount {
  id: number;
  name: string;
  type: string;
  discountValue: number | null;
  condition: number | null;
  startDate: string;
  endDate: string;
  recurrence: string;
  status: string;
  createdAt: Date;
  itemCount: number;
  items?: any[];
}

export interface ItemBrief {
  id: number;
  skuCode: string;
  name?: string;
  materialName?: string;
  typeName?: string;
  sellingPrice: number;
  coverImage?: string;
}

// ============================================================
// 促销活动 CRUD
// ============================================================

/**
 * 获取促销活动列表
 * 等同于 GET /api/promotions
 */
export async function listPromotions(query: PromotionListQuery): Promise<{
  promotions: PromotionWithItemCount[];
  pagination: { total: number; page: number; size: number; pages: number };
}> {
  const page = query.page || 1;
  const size = query.size || 20;

  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.keyword) {
    where.OR = [{ name: { contains: query.keyword } }];
  }

  const [total, promotions] = await Promise.all([
    db.promotion.count({ where }),
    db.promotion.findMany({
      where,
      include: {
        items: {
          include: {
            item: {
              include: {
                material: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  const promotionsWithExtras = promotions.map(promotion => ({
    ...promotion,
    itemCount: promotion.items.length,
  }));

  return {
    promotions: promotionsWithExtras,
    pagination: { total, page, size, pages: Math.ceil(total / size) },
  };
}

/**
 * 创建促销活动
 * @throws {ValidationError} 参数校验失败
 * 等同于 POST /api/promotions
 */
export async function createPromotion(input: CreatePromotionInput) {
  const { name, type, discountValue, condition, startDate, endDate, recurrence, status } = input;

  if (!name) throw new ValidationError('请输入促销名称');
  if (!type) throw new ValidationError('请选择促销类型');
  if (!startDate) throw new ValidationError('请选择开始日期');
  if (!endDate) throw new ValidationError('请选择结束日期');
  if (new Date(startDate) > new Date(endDate)) {
    throw new ValidationError('开始日期不能晚于结束日期');
  }

  const validRecurrences = ['none', 'daily', 'weekly', 'monthly', 'quarterly'];
  if (recurrence && !validRecurrences.includes(recurrence)) {
    throw new ValidationError('无效的周期类型');
  }

  const promotion = await db.promotion.create({
    data: {
      name,
      type,
      discountValue: discountValue != null ? parseFloat(String(discountValue)) : null,
      condition: condition != null ? parseFloat(String(condition)) : null,
      startDate,
      endDate,
      recurrence: recurrence || 'none',
      status: status || 'draft',
    },
    include: {
      items: true,
    },
  });

  await logAction('create_promotion', 'promotion', promotion.id, {
    name: promotion.name,
    type: promotion.type,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    recurrence: promotion.recurrence,
  });

  return promotion;
}

/**
 * 更新促销活动
 * @throws {NotFoundError} 促销不存在
 * 等同于 PUT /api/promotions?id=
 */
export async function updatePromotion(id: number, input: UpdatePromotionInput) {
  const { name, type, discountValue, condition, startDate, endDate, recurrence, status } = input;

  if (!name) throw new ValidationError('请输入促销名称');
  if (!type) throw new ValidationError('请选择促销类型');
  if (!startDate) throw new ValidationError('请选择开始日期');
  if (!endDate) throw new ValidationError('请选择结束日期');
  if (new Date(startDate) > new Date(endDate)) {
    throw new ValidationError('开始日期不能晚于结束日期');
  }

  const validRecurrences = ['none', 'daily', 'weekly', 'monthly', 'quarterly'];
  if (recurrence && !validRecurrences.includes(recurrence)) {
    throw new ValidationError('无效的周期类型');
  }

  try {
    const promotion = await db.promotion.update({
      where: { id },
      data: {
        name,
        type,
        discountValue: discountValue != null ? parseFloat(String(discountValue)) : null,
        condition: condition != null ? parseFloat(String(condition)) : null,
        startDate,
        endDate,
        recurrence: recurrence || 'none',
        status: status || 'draft',
      },
      include: {
        items: true,
      },
    });

    await logAction('update_promotion', 'promotion', promotion.id, {
      name: promotion.name,
      type: promotion.type,
      status: promotion.status,
      recurrence: promotion.recurrence,
    });

    return promotion;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('Record to update not found')) {
      throw new NotFoundError('促销活动不存在');
    }
    throw e;
  }
}

/**
 * 删除促销活动（级联删除关联货品）
 * @throws {NotFoundError} 促销不存在
 * 等同于 DELETE /api/promotions?id=
 */
export async function deletePromotion(id: number): Promise<void> {
  try {
    await db.promotionItem.deleteMany({ where: { promotionId: id } });
    await db.promotion.delete({ where: { id } });

    await logAction('delete_promotion', 'promotion', id, {});
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('Record to delete not found')) {
      throw new NotFoundError('促销活动不存在');
    }
    throw e;
  }
}

// ============================================================
// 促销关联货品
// ============================================================

/**
 * 获取促销关联的货品列表
 * 等同于 GET /api/promotions/:id/items
 */
export async function getPromotionItems(promotionId: number): Promise<{
  items: ItemBrief[];
  promotionId: number;
  promotionName: string;
}> {
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    include: {
      items: {
        include: {
          item: {
            include: {
              material: true,
              type: true,
              spec: true,
              images: { where: { isCover: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!promotion) throw new NotFoundError('促销活动不存在');

  const itemsWithExtras = promotion.items.map(({ item }) => ({
    ...item,
    materialName: item.material?.name,
    typeName: item.type?.name,
    coverImage: item.images[0]?.filename || null,
  }));

  return {
    items: itemsWithExtras,
    promotionId: promotion.id,
    promotionName: promotion.name,
  };
}

/**
 * 添加货品到促销
 * 自动跳过已关联的货品
 * 等同于 POST /api/promotions/:id/items
 */
export async function addPromotionItems(promotionId: number, itemIds: number[]): Promise<{
  items: any[];
  addedCount: number;
  totalCount: number;
}> {
  const promotion = await db.promotion.findUnique({ where: { id: promotionId } });
  if (!promotion) throw new NotFoundError('促销活动不存在');

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new ValidationError('请选择要添加的商品');
  }

  const existingItems = await db.item.findMany({ where: { id: { in: itemIds } } });
  if (existingItems.length !== itemIds.length) {
    throw new ValidationError('部分商品不存在');
  }

  const existingAssociations = await db.promotionItem.findMany({
    where: { promotionId, itemId: { in: itemIds } },
  });

  const existingItemIds = new Set(existingAssociations.map(assoc => assoc.itemId));
  const newItemIds = itemIds.filter(id => !existingItemIds.has(id));

  if (newItemIds.length > 0) {
    await db.promotionItem.createMany({
      data: newItemIds.map(itemId => ({ promotionId, itemId })),
    });

    await logAction('add_promotion_items', 'promotion', promotionId, {
      itemIds: newItemIds,
      count: newItemIds.length,
    });
  }

  const updatedItems = await db.promotionItem.findMany({
    where: { promotionId },
    include: {
      item: {
        include: { material: true, type: true },
      },
    },
  });

  return {
    items: updatedItems.map(({ item }) => ({
      ...item,
      materialName: item.material?.name,
      typeName: item.type?.name,
    })),
    addedCount: newItemIds.length,
    totalCount: updatedItems.length,
  };
}

/**
 * 从促销中移除货品
 * 等同于 DELETE /api/promotions/:id/items
 */
export async function removePromotionItems(promotionId: number, itemIds: number[]): Promise<{
  items: any[];
  removedCount: number;
  totalCount: number;
}> {
  const promotion = await db.promotion.findUnique({ where: { id: promotionId } });
  if (!promotion) throw new NotFoundError('促销活动不存在');

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new ValidationError('请选择要移除的商品');
  }

  await db.promotionItem.deleteMany({
    where: { promotionId, itemId: { in: itemIds } },
  });

  await logAction('remove_promotion_items', 'promotion', promotionId, {
    itemIds,
    count: itemIds.length,
  });

  const updatedItems = await db.promotionItem.findMany({
    where: { promotionId },
    include: {
      item: {
        include: { material: true, type: true },
      },
    },
  });

  return {
    items: updatedItems.map(({ item }) => ({
      ...item,
      materialName: item.material?.name,
      typeName: item.type?.name,
    })),
    removedCount: itemIds.length,
    totalCount: updatedItems.length,
  };
}

// ============================================================
// 促销效果预测
// ============================================================

/**
 * 促销效果预测
 * 基于历史销售数据 + 促销类型/折扣率计算
 * 等同于 GET /api/promotions/:id/forecast
 */
export async function forecastPromotionEffect(promotionId: number): Promise<{
  promotionId: number;
  promotionName: string;
  promotionType: string;
  prediction: {
    salesGrowth: number;
    profitChange: number;
    confidence: number;
    daily: { salesCount: number; salesAmount: number; profit: number };
    total: { salesCount: number; salesAmount: number; profit: number; days: number };
    base: { dailySalesCount: number; dailySalesAmount: number; profitPerItem: number };
  };
  effectId: number;
  calculatedAt: Date;
}> {
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    include: {
      items: {
        include: {
          item: {
            include: { saleRecords: true },
          },
        },
      },
    },
  });

  if (!promotion) throw new NotFoundError('促销活动不存在');

  const promotionItems = promotion.items.map(({ item }) => item);
  const itemIds = promotionItems.map(item => item.id);

  const historicalSales = itemIds.length > 0 ? await db.saleRecord.findMany({
    where: {
      itemId: { in: itemIds },
      saleDate: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    },
    include: { item: true },
  }) : [];

  const daysInPeriod = 90;
  const baseSalesCount = historicalSales.length;
  const baseSalesAmount = historicalSales.reduce((sum, sale) => sum + sale.actualPrice, 0);
  const baseDailySalesCount = baseSalesCount / daysInPeriod;
  const baseDailySalesAmount = baseSalesAmount / daysInPeriod;

  const baseCost = promotionItems.length > 0
    ? promotionItems.reduce((sum, item) => sum + (item.allocatedCost || item.costPrice || 0), 0) / promotionItems.length
    : 0;

  const basePrice = promotionItems.length > 0
    ? promotionItems.reduce((sum, item) => sum + item.sellingPrice, 0) / promotionItems.length
    : 0;

  const baseProfitPerItem = basePrice - baseCost;

  let predictedSalesGrowth = 0;
  let predictedProfitChange = 0;
  let confidence = 0.5;

  if (promotion.type === 'discount' && promotion.discountValue) {
    const discountRate = promotion.discountValue / 100;
    predictedSalesGrowth = Math.min(100, discountRate * 200);
    const discountedPrice = basePrice * (1 - discountRate);
    const newProfitPerItem = discountedPrice - baseCost;
    const profitImpact = baseProfitPerItem !== 0 ? (newProfitPerItem - baseProfitPerItem) / baseProfitPerItem : 0;
    predictedProfitChange = (predictedSalesGrowth / 100 + 1) * (1 + profitImpact) - 1;
    confidence = Math.min(0.8, 0.5 + discountRate * 0.6);
  } else if (promotion.type === '满减' && promotion.condition && promotion.discountValue) {
    const discountAmount = promotion.discountValue;
    const threshold = promotion.condition;
    const discountRate = discountAmount / threshold;
    predictedSalesGrowth = Math.min(80, discountRate * 150);
    const effectiveDiscountRate = discountAmount / (threshold + discountAmount);
    const discountedPrice = basePrice * (1 - effectiveDiscountRate);
    const newProfitPerItem = discountedPrice - baseCost;
    const profitImpact = baseProfitPerItem !== 0 ? (newProfitPerItem - baseProfitPerItem) / baseProfitPerItem : 0;
    predictedProfitChange = (predictedSalesGrowth / 100 + 1) * (1 + profitImpact) - 1;
    confidence = Math.min(0.75, 0.5 + discountRate * 0.5);
  } else if (promotion.type === '赠品') {
    predictedSalesGrowth = 50;
    predictedProfitChange = 0.2;
    confidence = 0.6;
  } else if (promotion.type === '套餐') {
    predictedSalesGrowth = 70;
    predictedProfitChange = 0.3;
    confidence = 0.65;
  }

  const predictedDailySalesCount = baseDailySalesCount * (1 + predictedSalesGrowth / 100);
  const predictedDailySalesAmount = baseDailySalesAmount * (1 + predictedSalesGrowth / 100);
  const predictedDailyProfit = basePrice > 0
    ? baseDailySalesAmount * (baseProfitPerItem / basePrice) * (1 + predictedProfitChange)
    : baseDailySalesAmount * (1 + predictedProfitChange);

  const startDate = new Date(promotion.startDate);
  const endDate = new Date(promotion.endDate);
  const promotionDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const totalPredictedSalesCount = predictedDailySalesCount * promotionDays;
  const totalPredictedSalesAmount = predictedDailySalesAmount * promotionDays;
  const totalPredictedProfit = predictedDailyProfit * promotionDays;

  const promotionEffect = await db.promotionEffect.create({
    data: {
      promotionId,
      predictedSalesGrowth,
      predictedProfitChange: predictedProfitChange * 100,
      confidence,
    },
  });

  return {
    promotionId: promotion.id,
    promotionName: promotion.name,
    promotionType: promotion.type,
    prediction: {
      salesGrowth: predictedSalesGrowth,
      profitChange: predictedProfitChange * 100,
      confidence,
      daily: {
        salesCount: predictedDailySalesCount,
        salesAmount: predictedDailySalesAmount,
        profit: predictedDailyProfit,
      },
      total: {
        salesCount: totalPredictedSalesCount,
        salesAmount: totalPredictedSalesAmount,
        profit: totalPredictedProfit,
        days: promotionDays,
      },
      base: {
        dailySalesCount: baseDailySalesCount,
        dailySalesAmount: baseDailySalesAmount,
        profitPerItem: baseProfitPerItem,
      },
    },
    effectId: promotionEffect.id,
    calculatedAt: promotionEffect.calculatedAt,
  };
}
