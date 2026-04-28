import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';

// GET /api/dicts/price-ranges/[id] - 获取单个价格带详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const priceRange = await prisma.priceRange.findUnique({
      where: { id: parseInt(id) },
    });

    if (!priceRange) {
      return NextResponse.json(
        {
          code: 404,
          data: null,
          message: '价格带不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        code: 0,
        data: priceRange,
        message: 'ok',
      }
    );
  } catch (error) {
    console.error('获取价格带详情失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '获取价格带详情失败',
      },
      { status: 500 }
    );
  }
}

// PUT /api/dicts/price-ranges/[id] - 更新价格带
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, minPrice, maxPrice, sortOrder, isActive } = body;

    const priceRange = await prisma.priceRange.update({
      where: { id: parseInt(id) },
      data: {
        name,
        minPrice,
        maxPrice,
        sortOrder,
        isActive,
      },
    });

    return NextResponse.json(
      {
        code: 0,
        data: priceRange,
        message: '更新价格带成功',
      }
    );
  } catch (error) {
    console.error('更新价格带失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '更新价格带失败',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/dicts/price-ranges/[id] - 删除价格带
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.priceRange.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      {
        code: 0,
        data: null,
        message: '删除价格带成功',
      }
    );
  } catch (error) {
    console.error('删除价格带失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '删除价格带失败',
      },
      { status: 500 }
    );
  }
}
