import { NextRequest, NextResponse } from 'next/server';
import { getSeasonalFactors, upsertSeasonalFactor } from '@/services/restock.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');

    const seasonalFactors = await getSeasonalFactors({
      materialId: materialId ? parseInt(materialId) : undefined,
    });

    return NextResponse.json({ code: 0, data: seasonalFactors, message: 'ok' });
  } catch (error) {
    console.error('Error getting seasonal factors:', error);
    return NextResponse.json({ code: 500, data: null, message: '获取季节性因子失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materialId, month, factor } = body;

    const seasonalFactor = await upsertSeasonalFactor({ materialId, month, factor });

    return NextResponse.json({ code: 0, data: seasonalFactor, message: '更新季节性因子成功' });
  } catch (error) {
    console.error('Error updating seasonal factor:', error);
    return NextResponse.json({ code: 500, data: null, message: '更新季节性因子失败' }, { status: 500 });
  }
}
