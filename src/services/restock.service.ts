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
// 工具函数
// ============================================================

function calculateSafetyStockFn(avgSales: number, leadTime: number, safetyFactor: number = 1.645): number {
  return Math.ceil(avgSales * leadTime * safetyFactor);
}

async function predictSalesFn(materialId: number, days: number): Promise<number> {
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
  return Math.round(avgDailySales * days);
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
      saleRecords: {
        where: {
          saleDate: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          },
        },
        select: { id: true, saleDate: true },
      },
    },
    take: 1000,
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

    if (turnover) {
      const salesCount = item.saleRecords.length;
      const daysSinceCreation = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const turnoverRate = daysSinceCreation > 0 ? salesCount / daysSinceCreation : 0;

      switch (turnover) {
        case 'high': if (turnoverRate < 0.1) return false; break;
        case 'medium': if (turnoverRate < 0.01 || turnoverRate >= 0.1) return false; break;
        case 'low': if (turnoverRate >= 0.01) return false; break;
      }
    }

    if (heat) {
      const salesCount = item.saleRecords.length;
      switch (heat) {
        case 'hot': if (salesCount < 3) return false; break;
        case 'normal': if (salesCount === 0 || salesCount >= 3) return false; break;
        case 'cold': if (salesCount > 0) return false; break;
      }
    }

    return true;
  });

  const recommendations: any[] = [];
  let remainingBudget = budget || Infinity;

  for (const item of filteredItems) {
    if (remainingBudget <= 0) break;

    const recentSales = item.saleRecords.length;
    const recentSalesVelocity = recentSales / 90;
    const safetyStock = calculateSafetyStockFn(recentSalesVelocity, 7);

    const currentStock = await db.item.count({
      where: { materialId: item.materialId, status: 'in_stock', isDeleted: false },
    });

    const predictedSales = await predictSalesFn(item.materialId, 30);
    const currentMonth = new Date().getMonth() + 1;
    const seasonalFactor = await getSeasonalFactorFn(item.materialId, currentMonth);

    const recommendedQty = Math.max(0, safetyStock - currentStock + Math.round(predictedSales * seasonalFactor));

    if (recommendedQty > 0) {
      const estimatedCost = recommendedQty * (item.costPrice || item.allocatedCost || 0);

      if (estimatedCost <= remainingBudget) {
        const confidence = Math.min(1.0, (recentSales / 10) + (seasonalFactor - 0.5));
        const estimatedSalesCycle = Math.round(30 / (recentSalesVelocity * seasonalFactor || 0.1));

        recommendations.push({
          itemId: item.id,
          currentStock,
          safetyStock,
          recentSalesVelocity,
          salesRank: recentSales,
          growthRate: 0,
          seasonalFactor,
          recommendedQty,
          estimatedCost,
          estimatedSalesCycle,
          confidence,
        });

        remainingBudget -= estimatedCost;
      }
    }
  }

  recommendations.sort((a, b) => b.confidence - a.confidence);
  const topRecommendations = recommendations.slice(0, limit);

  if (topRecommendations.length > 0) {
    await Promise.all(
      topRecommendations.map(rec =>
        db.restockRecommendation.upsert({
          where: { itemId: rec.itemId },
          update: rec,
          create: rec,
        })
      )
    );
  }

  await logAction('generate_restock_recommendations', 'restock', null, {
    materialId, typeId, priceRangeId, ageRange, turnover, heat, budget, limit,
    recommendationCount: topRecommendations.length,
  });

  return topRecommendations;
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
