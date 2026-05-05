import { NextRequest, NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';
import { NotFoundError } from '@/lib/errors';

// GET /api/dicts/customer-segments/[id] - 获取客户分类详情
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const segment = await dictsService.getCustomerSegmentById(parseInt(rawId));
    return NextResponse.json({ code: 0, data: segment, message: 'ok' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '客户分类不存在' }, { status: 404 });
    }
    console.error('获取客户分类详情失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '获取客户分类详情失败' }, { status: 500 });
  }
}

// PUT /api/dicts/customer-segments/[id] - 更新客户分类
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const body = await request.json();
    const segment = await dictsService.updateCustomerSegment(parseInt(idStr), body);
    return NextResponse.json({ code: 0, data: segment, message: '更新客户分类成功' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '客户分类不存在' }, { status: 404 });
    }
    console.error('更新客户分类失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '更新客户分类失败' }, { status: 500 });
  }
}

// DELETE /api/dicts/customer-segments/[id] - 删除客户分类
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const segment = await dictsService.deleteCustomerSegment(parseInt(idStr));
    return NextResponse.json({ code: 0, data: segment, message: '删除客户分类成功' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '客户分类不存在' }, { status: 404 });
    }
    console.error('删除客户分类失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '删除客户分类失败' }, { status: 500 });
  }
}