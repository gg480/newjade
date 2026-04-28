import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 安全库存计算函数
function calculateSafetyStock(avgSales: number, leadTime: number, safetyFactor: number = 1.645) {
  // 简化的安全库存计算公式: 安全库存 = 平均销量 * 提前期 * 安全系数
  return Math.ceil(avgSales * leadTime * safetyFactor);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materialId, targetTurnover } = body;

    // 获取过去90天的销售数据
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

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

    // 计算平均日销量
    const avgDailySales = sales.length / 90;

    // 计算提前期（假设为7天）
    const leadTime = 7;

    // 计算安全系数（基于目标周转率）
    const safetyFactor = Math.max(1.0, 2.0 - (targetTurnover / 100));

    // 计算安全库存
    const safetyStock = calculateSafetyStock(avgDailySales, leadTime, safetyFactor);

    return NextResponse.json({
      code: 0,
      data: {
        safetyStock,
        avgDailySales,
        leadTime,
        safetyFactor,
      },
      message: '计算安全库存成功',
    });
  } catch (error) {
    console.error('Error calculating safety stock:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '计算安全库存失败',
      },
      { status: 500 }
    );
  }
}
