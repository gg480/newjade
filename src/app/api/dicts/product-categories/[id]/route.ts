import { NextRequest, NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';
import { NotFoundError, ValidationError } from '@/lib/errors';

// GET /api/dicts/product-categories/[id] - 获取单个商品分类详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await dictsService.getProductCategoryById(parseInt(id));
    return NextResponse.json({ code: 0, data: category, message: 'ok' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '商品分类不存在' }, { status: 404 });
    }
    console.error('获取商品分类详情失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '获取商品分类详情失败' }, { status: 500 });
  }
}

// PUT /api/dicts/product-categories/[id] - 更新商品分类
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const category = await dictsService.updateProductCategory(parseInt(id), body);
    return NextResponse.json({ code: 0, data: category, message: '更新商品分类成功' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '商品分类不存在' }, { status: 404 });
    }
    console.error('更新商品分类失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '更新商品分类失败' }, { status: 500 });
  }
}

// DELETE /api/dicts/product-categories/[id] - 删除商品分类
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dictsService.deleteProductCategory(parseInt(id));
    return NextResponse.json({ code: 0, data: null, message: '删除商品分类成功' });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ code: 400, data: null, message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '商品分类不存在' }, { status: 404 });
    }
    console.error('删除商品分类失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '删除商品分类失败' }, { status: 500 });
  }
}
