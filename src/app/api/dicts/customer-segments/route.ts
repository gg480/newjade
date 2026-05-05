import { NextRequest, NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';

// GET /api/dicts/customer-segments - 获取客户分类列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const segments = await dictsService.listCustomerSegments({ includeInactive });
    return NextResponse.json({ code: 0, data: segments, message: 'ok' });
  } catch (error) {
    console.error('获取客户分类列表失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '获取客户分类列表失败' }, { status: 500 });
  }
}

// POST /api/dicts/customer-segments - 创建客户分类
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, discountRate, description } = body;
    const segment = await dictsService.createCustomerSegment({ name, discountRate, description });
    return NextResponse.json({ code: 0, data: segment, message: '创建客户分类成功' });
  } catch (error) {
    console.error('创建客户分类失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '创建客户分类失败' }, { status: 500 });
  }
}