import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/stocktaking/[id] - 获取单个盘点计划详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stocktaking = await prisma.stocktaking.findUnique({
      where: { id: parseInt(id) },
      include: {
        details: {
          include: {
            item: {
              include: {
                material: true,
                type: true,
                batch: true,
              },
            },
          },
        },
      },
    });

    if (!stocktaking) {
      return NextResponse.json(
        {
          code: 404,
          data: null,
          message: '盘点计划不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: 0,
      data: stocktaking,
      message: 'ok',
    });
  } catch (error) {
    console.error('获取盘点计划详情失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '获取盘点计划详情失败',
      },
      { status: 500 }
    );
  }
}

// PUT /api/stocktaking/[id] - 更新盘点计划
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      endDate,
      notes,
    } = body;

    const stocktaking = await prisma.stocktaking.update({
      where: { id: parseInt(id) },
      data: {
        status,
        endDate,
        notes,
      },
      include: {
        details: {
          include: {
            item: {
              include: {
                material: true,
                type: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      code: 0,
      data: stocktaking,
      message: '更新盘点计划成功',
    });
  } catch (error) {
    console.error('更新盘点计划失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '更新盘点计划失败',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/stocktaking/[id] - 删除盘点计划
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.stocktaking.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({
      code: 0,
      data: null,
      message: '删除盘点计划成功',
    });
  } catch (error) {
    console.error('删除盘点计划失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '删除盘点计划失败',
      },
      { status: 500 }
    );
  }
}
