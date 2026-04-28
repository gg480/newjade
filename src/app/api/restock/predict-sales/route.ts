import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

  // 计算平均日销量
  const avgDailySales = sales.length / 90;
  
  // 预测未来销量
  const predictedSales = Math.round(avgDailySales * days);

  // 计算置信度（基于历史数据量）
  const confidence = Math.min(1.0, sales.length / 30); // 30天销量数据为100%置信度

  return {
    predictedSales,
    avgDailySales,
    historicalSales: sales.length,
    confidence,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materialId, days } = body;

    const prediction = await predictSales(materialId, days);

    return NextResponse.json({
      code: 0,
      data: prediction,
      message: '预测销量成功',
    });
  } catch (error) {
    console.error('Error predicting sales:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '预测销量失败',
      },
      { status: 500 }
    );
  }
}
