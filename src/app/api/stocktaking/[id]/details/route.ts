import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/lib/errors';
import { updateStocktakingDetails } from '@/services/stocktaking.service';

// POST /api/stocktaking/[id]/details - 更新盘点明细
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { details } = body;

    const stocktaking = await updateStocktakingDetails(parseInt(id), details);
    return NextResponse.json({ code: 0, data: stocktaking, message: '更新盘点明细成功' });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ code: 400, data: null, message: error.message }, { status: 400 });
    }
    console.error('更新盘点明细失败:', error);
    return NextResponse.json({ code: 500, data: null, message: '更新盘点明细失败' }, { status: 500 });
  }
}
