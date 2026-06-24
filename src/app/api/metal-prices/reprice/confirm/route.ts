import { NextResponse } from 'next/server';
import { confirmReprice } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { guardPermission } from '@/lib/api/permission-guard';
import { logAction, resolveOperator } from '@/lib/log';

async function confirmRepricePOST(req: Request) {
  const denied = await guardPermission(req, 'action:metal_price_manage');
  if (denied) return denied;
  const body = await req.json();
  const materialId = parseInt(body.materialId);
  const newPricePerGram = parseFloat(body.newPricePerGram);

  const result = await confirmReprice(materialId, newPricePerGram);
  await logAction('reprice', 'metal_price', materialId, {
    materialId, newPricePerGram, updatedCount: result.updatedCount,
  }, await resolveOperator(req));
  return NextResponse.json({ code: 0, data: result, message: `已更新 ${result.updatedCount} 件货品价格` });
}

export const POST = withApiLogging('metal-prices/reprice/confirm:POST', confirmRepricePOST);
