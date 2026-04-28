import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');
    const typeId = searchParams.get('typeId');
    const minConfidence = searchParams.get('minConfidence');
    const limit = searchParams.get('limit') || '20';

    const where: any = {};
    if (materialId) {
      where.item = {
        materialId: parseInt(materialId),
      };
    }
    if (typeId) {
      where.item = {
        ...where.item,
        typeId: parseInt(typeId),
      };
    }
    if (minConfidence) {
      where.confidence = {
        gte: parseFloat(minConfidence),
      };
    }

    const recommendations = await prisma.restockRecommendation.findMany({
      where,
      include: {
        item: {
          include: {
            material: true,
            type: true,
          },
        },
      },
      orderBy: {
        confidence: 'desc',
      },
      take: parseInt(limit),
    });

    return NextResponse.json({
      code: 0,
      data: recommendations,
      message: 'ok',
    });
  } catch (error) {
    console.error('Error getting restock recommendations:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '获取入货建议失败',
      },
      { status: 500 }
    );
  }
}
