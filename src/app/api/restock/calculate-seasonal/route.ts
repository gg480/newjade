import { NextRequest, NextResponse } from 'next/server';
import { calculateSeasonalFactors } from '@/services/restock.service';

export async function POST(request: NextRequest) {
  try {
    const results = await calculateSeasonalFactors();

    return NextResponse.json({ code: 0, data: results, message: '计算季节性因子成功' });
  } catch (error) {
    console.error('Error calculating seasonal factors:', error);
    return NextResponse.json({ code: 500, data: null, message: '计算季节性因子失败' }, { status: 500 });
  }
}
