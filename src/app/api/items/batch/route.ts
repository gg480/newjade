import { NextResponse } from 'next/server';
import * as itemsService from '@/services/items.service';
import { AppError } from '@/lib/errors';

// POST /api/items/batch — Batch create items (legacy, supports both batchId FK and batchCode string)
export async function POST(req: Request) {
  const body = await req.json();

  try {
    const result = await itemsService.batchCreateItems(body);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.statusCode, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: `批量创建失败: ${e.message}` }, { status: 500 });
  }
}
