import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAction } from '@/lib/log';

// 计算季节性因子的函数
async function calculateSeasonalFactors() {
  // 获取所有材质
  const materials = await prisma.dictMaterial.findMany({
    where: {
      isActive: true,
    },
  });

  const results = [];

  for (const material of materials) {
    // 分析过去12个月的销售数据
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    // 一次性获取所有销售数据，然后在内存中按月份分组（减少数据库查询次数）
    const sales = await prisma.saleRecord.findMany({
      where: {
        item: {
          materialId: material.id,
        },
        saleDate: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0],
        },
      },
      select: {
        saleDate: true,
      },
    });

    // 按月分组计算销量
    const monthlySalesMap = new Map<number, number>();
    // 初始化12个月的销量为0
    for (let i = 1; i <= 12; i++) {
      monthlySalesMap.set(i, 0);
    }

    // 统计每个月的销量
    sales.forEach(sale => {
      const month = new Date(sale.saleDate).getMonth() + 1;
      monthlySalesMap.set(month, (monthlySalesMap.get(month) || 0) + 1);
    });

    // 转换为数组格式
    const monthlySales = Array.from(monthlySalesMap.entries()).map(([month, sales]) => ({
      month,
      sales,
    })).sort((a, b) => a.month - b.month);

    // 计算月平均销量
    const totalSales = monthlySales.reduce((sum, month) => sum + month.sales, 0);
    const avgMonthlySales = totalSales / 12;

    // 计算每个月的季节性因子
    const materialResults = [];
    const upsertPromises = [];

    for (const monthData of monthlySales) {
      const factor = avgMonthlySales > 0 ? monthData.sales / avgMonthlySales : 1.0;

      // 保存或更新季节性因子（并行处理）
      upsertPromises.push(
        prisma.seasonalFactor.upsert({
          where: {
            materialId_month: {
              materialId: material.id,
              month: monthData.month,
            },
          },
          update: { factor },
          create: { materialId: material.id, month: monthData.month, factor },
        })
      );

      materialResults.push({
        materialId: material.id,
        materialName: material.name,
        month: monthData.month,
        sales: monthData.sales,
        factor,
      });
    }

    // 并行执行所有upsert操作，提高性能
    await Promise.all(upsertPromises);
    results.push(...materialResults);
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const results = await calculateSeasonalFactors();

    // 记录操作日志
    await logAction(
      'calculate_seasonal_factors',
      'seasonal',
      null,
      {
        materialCount: new Set(results.map(r => r.materialId)).size,
        factorCount: results.length,
      }
    );

    return NextResponse.json({
      code: 0,
      data: results,
      message: '计算季节性因子成功',
    });
  } catch (error) {
    console.error('Error calculating seasonal factors:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '计算季节性因子失败',
      },
      { status: 500 }
    );
  }
}
