import { NextRequest, NextResponse } from 'next/server';
import { getRestockRecommendations } from '@/services/restock.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');
    const typeId = searchParams.get('typeId');
    const minConfidence = searchParams.get('minConfidence');
    const limit = searchParams.get('limit') || '20';

    const recommendations = await getRestockRecommendations({
      materialId: materialId ? parseInt(materialId) : undefined,
      typeId: typeId ? parseInt(typeId) : undefined,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      limit: parseInt(limit),
    });

    return NextResponse.json({ code: 0, data: recommendations, message: 'ok' });
  } catch (error) {
    console.error('Error getting restock recommendations:', error);
    return NextResponse.json({ code: 500, data: null, message: '获取入货建议失败' }, { status: 500 });
  }
}
