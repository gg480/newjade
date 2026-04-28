import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAction } from '@/lib/log';

// 安全库存计算函数
function calculateSafetyStock(avgSales: number, leadTime: number, safetyFactor: number = 1.645) {
  // 简化的安全库存计算公式: 安全库存 = 平均销量 * 提前期 * 安全系数
  return Math.ceil(avgSales * leadTime * safetyFactor);
}

// 销量预测函数（基于历史数据的简单移动平均）
async function predictSales(materialId: number, days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90); // 使用过去90天的数据

  const sales = await prisma.saleRecord.findMany({
    where: {
      item: {
        materialId,
      },
      saleDate: {
        gte: startDate.toISOString().split('T')[0],
        lte: endDate.toISOString().split('T')[0],
      },
    },
  });

  const avgDailySales = sales.length / 90;
  return Math.round(avgDailySales * days);
}

// 季节性因子计算函数
async function getSeasonalFactor(materialId: number, month: number) {
  const seasonalFactor = await prisma.seasonalFactor.findFirst({
    where: {
      materialId,
      month,
    },
  });

  return seasonalFactor?.factor || 1.0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materialId, typeId, priceRangeId, ageRange, turnover, heat, budget, limit = 20 } = body;

    // 构建筛选条件
    const where: any = {
      status: 'in_stock',
      isDeleted: false,
    };

    if (materialId) {
      where.materialId = materialId;
    }

    if (typeId) {
      where.typeId = typeId;
    }

    // 获取所有符合条件的商品（限制数量，避免大数据量下的性能问题）
    const items = await prisma.item.findMany({
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
          // 只获取必要的字段，减少数据传输
          select: {
            id: true,
            saleDate: true,
          },
        },
      },
      // 限制查询数量，避免大数据量下的性能问题
      take: 1000,
    });

    // 进一步筛选（根据价格带、库龄、周转率、销售热度）
    const filteredItems = items.filter(item => {
      // 价格带筛选
      if (priceRangeId) {
        // 这里需要根据priceRangeId获取价格范围并进行筛选
        // 暂时跳过，后续实现
      }

      // 库龄筛选
      if (ageRange) {
        const purchaseDate = item.purchaseDate;
        if (purchaseDate) {
          const daysSincePurchase = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
          switch (ageRange) {
            case '0-30':
              if (daysSincePurchase > 30) return false;
              break;
            case '31-90':
              if (daysSincePurchase <= 30 || daysSincePurchase > 90) return false;
              break;
            case '91-180':
              if (daysSincePurchase <= 90 || daysSincePurchase > 180) return false;
              break;
            case '180+':
              if (daysSincePurchase <= 180) return false;
              break;
          }
        }
      }

      // 周转率筛选
      if (turnover) {
        const salesCount = item.saleRecords.length;
        const daysSinceCreation = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const turnoverRate = daysSinceCreation > 0 ? salesCount / daysSinceCreation : 0;
        
        switch (turnover) {
          case 'high':
            if (turnoverRate < 0.1) return false;
            break;
          case 'medium':
            if (turnoverRate < 0.01 || turnoverRate >= 0.1) return false;
            break;
          case 'low':
            if (turnoverRate >= 0.01) return false;
            break;
        }
      }

      // 销售热度筛选
      if (heat) {
        const salesCount = item.saleRecords.length;
        switch (heat) {
          case 'hot':
            if (salesCount < 3) return false;
            break;
          case 'normal':
            if (salesCount === 0 || salesCount >= 3) return false;
            break;
          case 'cold':
            if (salesCount > 0) return false;
            break;
        }
      }

      return true;
    });

    const recommendations = [];
    let remainingBudget = budget || Infinity;

    for (const item of filteredItems) {
      if (remainingBudget <= 0) break;

      // 计算最近销量
      const recentSales = item.saleRecords.length;
      const recentSalesVelocity = recentSales / 90; // 平均每天销量

      // 计算安全库存
      const safetyStock = calculateSafetyStock(recentSalesVelocity, 7); // 假设7天提前期

      const currentStock = await prisma.item.count({
        where: {
          materialId: item.materialId,
          status: 'in_stock',
          isDeleted: false
        }
      });

      // 预测未来30天销量
      const predictedSales = await predictSales(item.materialId, 30);

      // 获取季节性因子
      const currentMonth = new Date().getMonth() + 1;
      const seasonalFactor = await getSeasonalFactor(item.materialId, currentMonth);

      // 计算建议采购数量
      const recommendedQty = Math.max(0, safetyStock - currentStock + Math.round(predictedSales * seasonalFactor));

      if (recommendedQty > 0) {
        const estimatedCost = recommendedQty * (item.costPrice || item.allocatedCost || 0);

        if (estimatedCost <= remainingBudget) {
          // 计算置信度（基于销量历史和季节性）
          const confidence = Math.min(1.0, (recentSales / 10) + (seasonalFactor - 0.5));

          // 计算预期销售周期
          const estimatedSalesCycle = Math.round(30 / (recentSalesVelocity * seasonalFactor || 0.1));

          recommendations.push({
            itemId: item.id,
            currentStock,
            safetyStock,
            recentSalesVelocity,
            salesRank: recentSales,
            growthRate: 0, // 简化处理，实际应计算增长率
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

    // 按置信度排序并限制数量
    recommendations.sort((a, b) => b.confidence - a.confidence);
    const topRecommendations = recommendations.slice(0, limit);

    // 保存建议到数据库（批量操作，提高性能）
    if (topRecommendations.length > 0) {
      // 使用Promise.all并行处理，提高性能
      await Promise.all(
        topRecommendations.map(rec => 
          prisma.restockRecommendation.upsert({
            where: {
              itemId: rec.itemId,
            },
            update: rec,
            create: rec,
          })
        )
      );
    }

    // 记录操作日志
    await logAction(
      'generate_restock_recommendations',
      'restock',
      null,
      {
        materialId,
        typeId,
        priceRangeId,
        ageRange,
        turnover,
        heat,
        budget,
        limit,
        recommendationCount: topRecommendations.length,
      }
    );

    return NextResponse.json({
      code: 0,
      data: topRecommendations,
      message: '生成入货建议成功',
    });
  } catch (error) {
    console.error('Error generating restock recommendations:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '生成入货建议失败',
      },
      { status: 500 }
    );
  }
}
