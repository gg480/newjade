import { NextResponse } from 'next/server';
import { batchAdjustPrice } from '@/services/items-extra.service';
import { ValidationError } from '@/lib/errors';

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { ids, adjustmentType, value, direction } = body;

    const data = await batchAdjustPrice({ ids, adjustmentType, value, direction });

    return NextResponse.json({
      code: 0,
      data,
      message: `批量调价完成: 成功${data.success}件`,
    });
  } catch (e: unknown) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ code: 400, message: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, message: `批量调价失败: ${message}` }, { status: 500 });
  }
}
