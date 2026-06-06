import { db } from '@/lib/db';
import { logAction } from '@/lib/log';

// ============================================================
// 类型定义
// ============================================================

export interface RestockRecommendationsQuery {
  materialId?: number;
  typeId?: number;
  minConfidence?: number;
  limit?: number;
}

export interface GenerateRestockInput {
  materialId?: number;
  typeId?: number;
  priceRangeId?: number;
  ageRange?: string;
  turnover?: string;
  heat?: string;
  budget?: number;
  limit?: number;
}

export interface PredictSalesInput {
  materialId: number;
  days: number;
}

export interface SafetyStockInput {
  materialId: number;
  targetTurnover: number;
}

export interface SeasonalFactorUpsert {
  materialId: number;
  month: number;
  factor: number;
}

// ============================================================
// 内部类型
// ============================================================

/** 生成入货建议时的中间聚合对象 */
interface RawRestockRec {
  itemId: number;
  materialId: number;
  materialName: string;
  currentStock: number;
  safetyStock: number;
  recentSalesVelocity: number;
  salesRank: number;
  growthRate: number;
  seasonalFactor: number;
  recommendedQty: number;
  estimatedCost: number;
  estimatedSalesCycle: number;
  confidence: number;
  sigmaD: number;
  avgCostPrice: number;
  itemIds: number[];
  exampleItemIds: number[];
}

// ============================================================
// 工具函数
// ============================================================

function calculateSafetyStockFn(avgSales: number, leadTime: number, safetyFactor: number = 1.645): number {
  return Math.ceil(avgSales * leadTime * safetyFactor);
}

async function predictSalesFn(materialId: number, days: number): Promise<{ predicted: number; totalSales: number }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const sales = await db.saleRecord.findMany({
    where: {
      item: { materialId },
      saleDate: {
        gte: startDate.toISOString().split('T')[0],
        lte: endDate.toISOString().split('T')[0],
      },
    },
  });

  const totalSales = sales.length;
  const avgDailySales = totalSales / 90;
  const predicted = Math.round(avgDailySales * days);
  return { predicted, totalSales };
}

async function getSeasonalFactorFn(materialId: number, month: number): Promise<number> {
  const seasonalFactor = await db.seasonalFactor.findFirst({
    where: { materialId, month },
  });
  return seasonalFactor?.factor || 1.0;
}

// ============================================================
// 服务方法
// ============================================================

/**
 * 获取入货推荐列表
 * 等同于 GET /api/restock/recommendations
 */
export async function getRestockRecommendations(query: RestockRecommendationsQuery) {
  const where: Record<string, unknown> = {};
  if (query.materialId) {
    where.item = { materialId: query.materialId };
  }
  if (query.typeId) {
    where.item = { ...(where.item as Record<string, unknown> || {}), typeId: query.typeId };
  }
  if (query.minConfidence) {
    where.confidence = { gte: query.minConfidence };
  }

  const limit = query.limit || 20;

  const recommendations = await db.restockRecommendation.findMany({
    where,
    include: {
      item: {
        include: {
          material: true,
          type: true,
        },
      },
    },
    orderBy: { confidence: 'desc' },
    take: limit,
  });

  return recommendations;
}

/**
 * 获取季节性因子列表
 * 等同于 GET /api/restock/seasonal
 */
export async function getSeasonalFactors(params: { materialId?: number }) {
  const where: Record<string, unknown> = {};
  if (params.materialId) {
    where.materialId = params.materialId;
  }

  const seasonalFactors = await db.seasonalFactor.findMany({
    where,
    include: { material: true },
    orderBy: { materialId: 'asc', month: 'asc' },
  });

  return seasonalFactors;
}

/**
 * 更新/创建季节性因子（upsert）
 * 等同于 POST /api/restock/seasonal
 */
export async function upsertSeasonalFactor(input: SeasonalFactorUpsert) {
  const { materialId, month, factor } = input;

  const seasonalFactor = await db.seasonalFactor.upsert({
    where: {
      materialId_month: { materialId, month },
    },
    update: { factor },
    create: { materialId, month, factor },
  });

  return seasonalFactor;
}

/**
 * 生成入货建议
 * 等同于 POST /api/restock/generate
 */
export async function generateRestockRecommendations(input: GenerateRestockInput) {
  const { materialId, typeId, priceRangeId, ageRange, turnover, heat, budget, limit = 20 } = input;

  const where: Record<string, unknown> = {
    status: 'in_stock',
    isDeleted: false,
  };

  if (materialId) where.materialId = materialId;
  if (typeId) where.typeId = typeId;

  const items = await db.item.findMany({
    where,
    include: {
      material: true,
      type: true,
    },
    take: 10000,
  });

  const filteredItems = items.filter(item => {
    if (priceRangeId) {
      // 暂不实现，保留筛选
    }

    if (ageRange) {
      const purchaseDate = item.purchaseDate;
      if (purchaseDate) {
        const daysSincePurchase = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
        switch (ageRange) {
          case '0-30': if (daysSincePurchase > 30) return false; break;
          case '31-90': if (daysSincePurchase <= 30 || daysSincePurchase > 90) return false; break;
          case '91-180': if (daysSincePurchase <= 90 || daysSincePurchase > 180) return false; break;
          case '180+': if (daysSincePurchase <= 180) return false; break;
        }
      }
    }

    // turnover 和 heat 筛选移到材质级（见下方 salesMap）
    return true;
  });

  // 按 materialId 分组
  const materialGroups = new Map<number, typeof filteredItems>();
  for (const item of filteredItems) {
    const list = materialGroups.get(item.materialId) || [];
    list.push(item);
    materialGroups.set(item.materialId, list);
  }

  const uniqueMaterialIds = Array.from(materialGroups.keys());
  const currentMonth = new Date().getMonth() + 1;

  // 循环外批量查询：预测/季节因子 各只查一次 per material
  const predictMap = new Map<number, number>();
  const factorMap = new Map<number, number>();
  const stockMap = new Map<number, number>();
  const salesMap = new Map<number, number>();

  // stockMap 来自 materialGroups 的实际大小（与 item.findMany 的 take 一致）
  for (const [mid, group] of materialGroups) {
    stockMap.set(mid, group.length);
  }

  await Promise.all(
    uniqueMaterialIds.map(async (mid) => {
      const [result, factor] = await Promise.all([
        predictSalesFn(mid, 30),
        getSeasonalFactorFn(mid, currentMonth),
      ]);
      predictMap.set(mid, result.predicted);
      salesMap.set(mid, result.totalSales);
      factorMap.set(mid, factor);
    })
  );

  // 材质级聚合计算建议
  const recommendations: RawRestockRec[] = [];
  const Z = 1.645;
  const L = 7;

  for (const [materialId, groupItems] of materialGroups) {
    const totalSales90 = salesMap.get(materialId) || 0;
    const predictedSales = predictMap.get(materialId) || 0;
    const seasonalFactor = factorMap.get(materialId) || 1.0;
    const currentStock = stockMap.get(materialId) || 0;

    // 材质级周转率/热度筛选
    const avgDaily = totalSales90 / 90;
    const turnoverPerItem = groupItems.length > 0 ? avgDaily / groupItems.length : 0;

    if (turnover) {
      switch (turnover) {
        case 'high': if (turnoverPerItem < 0.1) continue; break;
        case 'medium': if (turnoverPerItem < 0.01 || turnoverPerItem >= 0.1) continue; break;
        case 'low': if (turnoverPerItem >= 0.01) continue; break;
      }
    }

    if (heat) {
      switch (heat) {
        case 'hot': if (totalSales90 < 30) continue; break;
        case 'normal': if (totalSales90 === 0 || totalSales90 >= 30) continue; break;
        case 'cold': if (totalSales90 > 0) continue; break;
      }
    }

    // 使用泊松近似计算销售标准差：σd ≈ √(日均销量)
    const avgDailySales = Math.max(totalSales90 / 90, 0.01);
    const sigmaD = Math.sqrt(avgDailySales);

    // 行业标准安全库存：Z × σd × √L
    const safetyStock = Math.ceil(Z * sigmaD * Math.sqrt(L));

    const predictedAdjusted = Math.round(predictedSales * seasonalFactor);
    const recommendedQty = Math.max(0, safetyStock - currentStock + predictedAdjusted);

    if (recommendedQty <= 0) continue;

    const totalCost = groupItems.reduce((s, it) => s + (it.costPrice || it.allocatedCost || 0), 0);
    const avgCostPrice = groupItems.length > 0 ? totalCost / groupItems.length : 0;
    const estimatedCost = recommendedQty * avgCostPrice;

    // 置信度：基于90天总销量的稳定性
    const confidence = Math.min(1.0, totalSales90 / 30);

    // 取该材质下前3件作为前端展示示例
    const exampleItems = groupItems.slice(0, 3).map(it => it.id);
    const materialInfo = groupItems[0]?.material;

    recommendations.push({
      itemId: groupItems[0].id,
      materialId,
      materialName: materialInfo?.name || '',
      currentStock,
      safetyStock,
      recentSalesVelocity: avgDailySales,
      salesRank: totalSales90,
      growthRate: 0,
      seasonalFactor,
      recommendedQty,
      estimatedCost,
      estimatedSalesCycle: Math.round(30 / (avgDailySales * seasonalFactor || 0.1)),
      confidence,
      sigmaD,
      avgCostPrice,
      itemIds: groupItems.map(it => it.id),
      exampleItemIds: exampleItems,
    });
  }

  // 按置信度降序 → 分配预算
  recommendations.sort((a, b) => b.confidence - a.confidence);

  const selectedRecommendations: RawRestockRec[] = [];
  let remainingBudget = budget || Infinity;

  for (const rec of recommendations) {
    if (remainingBudget <= 0) break;
    if (rec.estimatedCost <= remainingBudget) {
      selectedRecommendations.push(rec);
      remainingBudget -= rec.estimatedCost;
    }
  }

  const topRecommendations = selectedRecommendations.slice(0, limit);

  // 批量查询商品信息，注入返回结果（供前端渲染）
  const itemIds = topRecommendations.map(r => r.itemId);
  const dbItems = await db.item.findMany({
    where: { id: { in: itemIds } },
    include: { material: true, type: true },
  });
  const itemMap = new Map(dbItems.map(i => [i.id, i]));
  const enrichedRecommendations = topRecommendations.map(rec => ({
    ...rec,
    item: itemMap.get(rec.itemId) || null,
  }));

  if (topRecommendations.length > 0) {
    const schemaFields = ['itemId', 'currentStock', 'safetyStock', 'recentSalesVelocity', 'salesRank', 'growthRate', 'seasonalFactor', 'recommendedQty', 'estimatedCost', 'estimatedSalesCycle', 'confidence'];
    await Promise.all(
      topRecommendations.map(rec => {
        const dbRec: Record<string, unknown> = {};
        for (const field of schemaFields) {
          if (field in rec) dbRec[field] = rec[field as keyof typeof rec];
        }
        return db.restockRecommendation.upsert({
          where: { itemId: rec.itemId },
          update: dbRec,
          create: dbRec,
        });
      })
    );
  }

  await logAction('generate_restock_recommendations', 'restock', null, {
    materialId, typeId, priceRangeId, ageRange, turnover, heat, budget, limit,
    materialCount: uniqueMaterialIds.length,
    recommendationCount: topRecommendations.length,
  });

  return enrichedRecommendations;
}

/**
 * 销售预测 — 基于历史移动平均
 * 等同于 POST /api/restock/predict-sales
 */
export async function predictSales(input: PredictSalesInput): Promise<{
  predictedSales: number;
  avgDailySales: number;
  historicalSales: number;
  confidence: number;
}> {
  const { materialId, days } = input;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const sales = await db.saleRecord.findMany({
    where: {
      item: { materialId },
      saleDate: {
        gte: startDate.toISOString().split('T')[0],
        lte: endDate.toISOString().split('T')[0],
      },
    },
  });

  const avgDailySales = sales.length / 90;
  const predictedSales = Math.round(avgDailySales * days);
  const confidence = Math.min(1.0, sales.length / 30);

  return { predictedSales, avgDailySales, historicalSales: sales.length, confidence };
}

/**
 * 安全库存计算 — 基于平均销量×提前期×安全系数
 * 等同于 POST /api/restock/safety-stock
 */
export async function calculateSafetyStock(input: SafetyStockInput): Promise<{
  safetyStock: number;
  avgDailySales: number;
  leadTime: number;
  safetyFactor: number;
}> {
  const { materialId, targetTurnover } = input;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const sales = await db.saleRecord.findMany({
    where: {
      item: { materialId },
      saleDate: {
        gte: startDate.toISOString().split('T')[0],
        lte: endDate.toISOString().split('T')[0],
      },
    },
  });

  const avgDailySales = sales.length / 90;
  const leadTime = 7;
  const safetyFactor = Math.max(1.0, 2.0 - (targetTurnover / 100));
  const safetyStock = calculateSafetyStockFn(avgDailySales, leadTime, safetyFactor);

  return { safetyStock, avgDailySales, leadTime, safetyFactor };
}

/**
 * 计算季节性因子 — 分析过去12个月销售数据
 * 等同于 POST /api/restock/calculate-seasonal
 */
export async function calculateSeasonalFactors(): Promise<{
  materialId: number;
  materialName?: string;
  month: number;
  sales: number;
  factor: number;
}[]> {
  const materials = await db.dictMaterial.findMany({ where: { isActive: true } });
  const results: { materialId: number; materialName?: string; month: number; sales: number; factor: number }[] = [];

  for (const material of materials) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const sales = await db.saleRecord.findMany({
      where: {
        item: { materialId: material.id },
        saleDate: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0],
        },
      },
      select: { saleDate: true },
    });

    const monthlySalesMap = new Map<number, number>();
    for (let i = 1; i <= 12; i++) monthlySalesMap.set(i, 0);

    sales.forEach(sale => {
      const month = new Date(sale.saleDate).getMonth() + 1;
      monthlySalesMap.set(month, (monthlySalesMap.get(month) || 0) + 1);
    });

    const monthlySales = Array.from(monthlySalesMap.entries())
      .map(([month, salesCount]) => ({ month, sales: salesCount }))
      .sort((a, b) => a.month - b.month);

    const totalSales = monthlySales.reduce((sum, month) => sum + month.sales, 0);
    const avgMonthlySales = totalSales / 12;

    const upsertPromises = [];

    for (const monthData of monthlySales) {
      const factor = avgMonthlySales > 0 ? monthData.sales / avgMonthlySales : 1.0;

      upsertPromises.push(
        db.seasonalFactor.upsert({
          where: {
            materialId_month: { materialId: material.id, month: monthData.month },
          },
          update: { factor },
          create: { materialId: material.id, month: monthData.month, factor },
        })
      );

      results.push({
        materialId: material.id,
        materialName: material.name,
        month: monthData.month,
        sales: monthData.sales,
        factor,
      });
    }

    await Promise.all(upsertPromises);
  }

  await logAction('calculate_seasonal_factors', 'seasonal', null, {
    materialCount: new Set(results.map(r => r.materialId)).size,
    factorCount: results.length,
  });

  return results;
}
