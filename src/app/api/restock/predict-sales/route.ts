import { NextRequest, NextResponse } from 'next/server';
import { predictSales } from '@/services/restock.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materialId, days } = body;

    const prediction = await predictSales({ materialId, days });

    return NextResponse.json({ code: 0, data: prediction, message: '预测销量成功' });
  } catch (error) {
    console.error('Error predicting sales:', error);
    return NextResponse.json({ code: 500, data: null, message: '预测销量失败' }, { status: 500 });
  }
}
