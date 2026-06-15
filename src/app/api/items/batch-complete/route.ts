import { NextResponse } from 'next/server';
import { batchCompleteItems } from '@/services/items.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { guardPermission } from '@/lib/api/permission-guard';

async function itemsBatchCompletePatch(req: Request) {
  const denied = await guardPermission(req, 'action:item_batch_ops');
  if (denied) return denied;
  try {
    const body = await req.json();
    const { ids, materialId, typeId, name, tagIds, counter, floorPrice, origin, weight } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: '请选择要补全的货品' }, { status: 400 });
    }

    const result = await batchCompleteItems({ ids, materialId, typeId, name, tagIds, counter, floorPrice, origin, weight });
    return NextResponse.json({ code: 0, data: result, message: `补全完成: 成功${result.success}件` });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message: `批量补全失败: ${message}` }, { status: 500 });
  }
}

export const PATCH = withApiLogging('items:batch-complete:PATCH', itemsBatchCompletePatch);
