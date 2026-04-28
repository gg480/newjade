import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';

// GET /api/dicts/customer-segments/[id] - 获取客户分类详情
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    const segment = await prisma.customerSegment.findUnique({
      where: { id },
    });

    if (!segment) {
      return NextResponse.json(
        {
          code: 404,
          data: null,
          message: '客户分类不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: 0,
      data: segment,
      message: 'ok',
    });
  } catch (error) {
    console.error('获取客户分类详情失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '获取客户分类详情失败',
      },
      { status: 500 }
    );
  }
}

// PUT /api/dicts/customer-segments/[id] - 更新客户分类
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const body = await request.json();
    const { name, discountRate, description, isActive } = body;

    const segment = await prisma.customerSegment.update({
      where: { id },
      data: {
        name: name || undefined,
        discountRate: discountRate || undefined,
        description: description || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({
      code: 0,
      data: segment,
      message: '更新客户分类成功',
    });
  } catch (error) {
    console.error('更新客户分类失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '更新客户分类失败',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/dicts/customer-segments/[id] - 删除客户分类
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    
    // 软删除：将isActive设置为false
    const segment = await prisma.customerSegment.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      code: 0,
      data: segment,
      message: '删除客户分类成功',
    });
  } catch (error) {
    console.error('删除客户分类失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '删除客户分类失败',
      },
      { status: 500 }
    );
  }
}