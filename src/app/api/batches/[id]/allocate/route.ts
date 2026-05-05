import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import * as batchesService from '@/services/batches.service';

// POST /api/batches/[id]/allocate — Trigger cost allocation
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await batchesService.allocateItems(parseInt(id));
    return NextResponse.json({ code: 0, data, message: '分摊完成' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '分摊失败' }, { status: 500 });
  }
}
