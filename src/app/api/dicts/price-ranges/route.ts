import { NextRequest, NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';

// GET /api/dicts/price-ranges - 获取价格带列表
export async function GET() {
  try {
    const priceRanges = await dictsService.listPriceRanges();
    return NextResponse.json({ code: 0, data: priceRanges, message: 'ok' });
  } catch (error) {
    console.error('获取价格带列表失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '获取价格带列表失败' }, { status: 500 });
  }
}

// POST /api/dicts/price-ranges - 创建价格带
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, minPrice, maxPrice, sortOrder } = body;
    const priceRange = await dictsService.createPriceRange({ name, minPrice, maxPrice, sortOrder });
    return NextResponse.json({ code: 0, data: priceRange, message: '创建价格带成功' });
  } catch (error) {
    console.error('创建价格带失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '创建价格带失败' }, { status: 500 });
  }
}
