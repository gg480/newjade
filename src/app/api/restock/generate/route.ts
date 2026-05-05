import { NextRequest, NextResponse } from 'next/server';
import { generateRestockRecommendations } from '@/services/restock.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materialId, typeId, priceRangeId, ageRange, turnover, heat, budget, limit = 20 } = body;

    const recommendations = await generateRestockRecommendations({
      materialId,
      typeId,
      priceRangeId,
      ageRange,
      turnover,
      heat,
      budget,
      limit,
    });

    return NextResponse.json({ code: 0, data: recommendations, message: '生成入货建议成功' });
  } catch (error) {
    console.error('Error generating restock recommendations:', error);
    return NextResponse.json({ code: 500, data: null, message: '生成入货建议失败' }, { status: 500 });
  }
}
