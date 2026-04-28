import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/stocktaking - 获取盘点计划列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = parseInt(searchParams.get('size') || '10');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [stocktakings, total] = await Promise.all([
      prisma.stocktaking.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.stocktaking.count({ where }),
    ]);

    return NextResponse.json({
      code: 0,
      data: {
        stocktakings,
        total,
        page,
        size,
      },
      message: 'ok',
    });
  } catch (error) {
    console.error('获取盘点计划列表失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '获取盘点计划列表失败',
      },
      { status: 500 }
    );
  }
}

// POST /api/stocktaking - 创建新的盘点计划
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      startDate,
      notes,
      itemIds = [],
    } = body;

    const stocktaking = await prisma.stocktaking.create({
      data: {
        type,
        startDate,
        notes,
        details: {
          create: itemIds.map((itemId: number) => ({
            itemId,
            systemQty: 1, // 默认系统数量为1
            actualQty: 0, // 实际数量默认为0
            variance: -1, // 差异默认为-1
          })),
        },
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
      message: '创建盘点计划成功',
    });
  } catch (error) {
    console.error('创建盘点计划失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '创建盘点计划失败',
      },
      { status: 500 }
    );
  }
}
