import { NextRequest, NextResponse } from 'next/server';
import { listStocktakings, createStocktaking } from '@/services/stocktaking.service';

// GET /api/stocktaking - 获取盘点计划列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await listStocktakings({
      page: parseInt(searchParams.get('page') || '1'),
      size: parseInt(searchParams.get('size') || '10'),
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
    });

    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (error) {
    console.error('获取盘点计划列表失败:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '获取盘点计划列表失败' },
      { status: 500 },
    );
  }
}

// POST /api/stocktaking - 创建新的盘点计划
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const stocktaking = await createStocktaking(body);
    return NextResponse.json({ code: 0, data: stocktaking, message: '创建盘点计划成功' });
  } catch (error) {
    console.error('创建盘点计划失败:', error);
    return NextResponse.json(
      { code: 500, data: null, message: '创建盘点计划失败' },
      { status: 500 },
    );
  }
}
