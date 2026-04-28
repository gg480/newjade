import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';

// GET /api/dicts/product-categories/[id] - 获取单个商品分类详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.productCategory.findUnique({
      where: { id: parseInt(id) },
      include: { children: true },
    });

    if (!category) {
      return NextResponse.json(
        {
          code: 404,
          data: null,
          message: '商品分类不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        code: 0,
        data: category,
        message: 'ok',
      }
    );
  } catch (error) {
    console.error('获取商品分类详情失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '获取商品分类详情失败',
      },
      { status: 500 }
    );
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
    const { name, parentId, sortOrder, isActive } = body;

    // 计算路径和层级
    let path = name;
    let level = 1;

    if (parentId) {
      const parent = await prisma.productCategory.findUnique({
        where: { id: parentId },
      });
      if (parent) {
        path = `${parent.path}/${name}`;
        level = parent.level + 1;
      }
    }

    const category = await prisma.productCategory.update({
      where: { id: parseInt(id) },
      data: {
        name,
        parentId,
        level,
        path,
        sortOrder,
        isActive,
      },
    });

    return NextResponse.json(
      {
        code: 0,
        data: category,
        message: '更新商品分类成功',
      }
    );
  } catch (error) {
    console.error('更新商品分类失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '更新商品分类失败',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/dicts/product-categories/[id] - 删除商品分类
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查是否有子分类
    const childrenCount = await prisma.productCategory.count({
      where: { parentId: parseInt(id) },
    });

    if (childrenCount > 0) {
      return NextResponse.json(
        {
          code: 400,
          data: null,
          message: '该分类下有子分类，无法删除',
        },
        { status: 400 }
      );
    }

    await prisma.productCategory.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      {
        code: 0,
        data: null,
        message: '删除商品分类成功',
      }
    );
  } catch (error) {
    console.error('删除商品分类失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '删除商品分类失败',
      },
      { status: 500 }
    );
  }
}
