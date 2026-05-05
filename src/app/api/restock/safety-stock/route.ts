import { NextRequest, NextResponse } from 'next/server';
import { calculateSafetyStock } from '@/services/restock.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materialId, targetTurnover } = body;

    const result = await calculateSafetyStock({ materialId, targetTurnover });

    return NextResponse.json({ code: 0, data: result, message: '计算安全库存成功' });
  } catch (error) {
    console.error('Error calculating safety stock:', error);
    return NextResponse.json({ code: 500, data: null, message: '计算安全库存失败' }, { status: 500 });
  }
}
