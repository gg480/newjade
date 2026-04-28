import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/stocktaking/[id]/details - 更新盘点明细
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { details } = body;

    if (!Array.isArray(details)) {
      return NextResponse.json(
        {
          code: 400,
          data: null,
          message: 'details必须是数组',
        },
        { status: 400 }
      );
    }

    // 批量更新盘点明细
    const updatedDetails = await Promise.all(
      details.map(async (detail: any) => {
        const { detailId, actualQty, notes } = detail;
        return await prisma.stocktakingDetail.update({
          where: { id: detailId },
          data: {
            actualQty,
            variance: actualQty - (detail.systemQty || 1),
            notes,
          },
        });
      })
    );

    // 获取更新后的完整盘点计划
    const stocktaking = await prisma.stocktaking.findUnique({
      where: { id: parseInt(id) },
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
      message: '更新盘点明细成功',
    });
  } catch (error) {
    console.error('更新盘点明细失败:', error);
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: '更新盘点明细失败',
      },
      { status: 500 }
    );
  }
}
