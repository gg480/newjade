import * as customersService from '@/services/customers.service';
import { AppError } from '@/lib/errors';
import { NextResponse } from 'next/server';

/**
 * POST /api/customers/[id]/merge
 * 合并客户：将指定销售记录归入目标客户，软删除源客户
 *
 * 请求体: { targetCustomerId: number, saleRecordIds: number[] }
 * - [id] 是源客户ID（将被软删除）
 * - targetCustomerId 是目标客户ID（接收销售记录）
 * - saleRecordIds 是需要转移的销售记录ID列表
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const sourceId = parseInt((await params).id);

    if (isNaN(sourceId)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的源客户ID' }, { status: 400 });
    }

    let body: { targetCustomerId?: number; saleRecordIds?: number[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: 400, data: null, message: '请求体格式错误' }, { status: 400 });
    }

    const result = await customersService.mergeCustomers(sourceId, {
      targetCustomerId: body.targetCustomerId!,
      saleRecordIds: body.saleRecordIds!,
    });

    const message = result.isUnlinkedMerge
      ? `已将 ${result.mergedSales} 条散客记录归入「${result.targetCustomer.name}」`
      : `已将 ${result.mergedSales} 条销售记录合并到「${result.targetCustomer.name}」，源客户「${result.sourceCustomer?.name}」已停用`;

    return NextResponse.json({
      code: 0,
      data: {
        mergedSales: result.mergedSales,
        sourceCustomer: result.sourceCustomer,
        targetCustomer: result.targetCustomer,
      },
      message,
    });
  } catch (e: any) {
    console.error('[MergeCustomer]', e);
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json(
      { code: 500, data: null, message: `合并失败: ${e.message}` },
      { status: 500 },
    );
  }
}
