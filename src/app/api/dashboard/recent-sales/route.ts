import { NextResponse } from 'next/server';
import { getRecentSales } from '@/services/dashboard.service';

export async function GET() {
  try {
    const data = await getRecentSales();
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (error) {
    console.error('Recent sales API error:', error);
    return NextResponse.json({
      code: -1,
      message: '获取最近销售记录失败',
      data: [],
    });
  }
}
