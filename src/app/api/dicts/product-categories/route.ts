import { NextRequest, NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';

// GET /api/dicts/product-categories - 获取商品分类列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeChildren = searchParams.get('includeChildren') === 'true';
    const categories = await dictsService.listProductCategories({ includeChildren });
    return NextResponse.json({ code: 0, data: categories, message: 'ok' });
  } catch (error) {
    console.error('获取商品分类列表失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '获取商品分类列表失败' }, { status: 500 });
  }
}

// POST /api/dicts/product-categories - 创建商品分类
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parentId, sortOrder } = body;
    const category = await dictsService.createProductCategory({ name, parentId, sortOrder });
    return NextResponse.json({ code: 0, data: category, message: '创建商品分类成功' });
  } catch (error) {
    console.error('创建商品分类失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '创建商品分类失败' }, { status: 500 });
  }
}
