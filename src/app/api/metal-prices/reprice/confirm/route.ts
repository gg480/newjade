import { NextResponse } from 'next/server';
import { confirmReprice } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function confirmRepricePOST(req: Request) {
  const body = await req.json();
  const materialId = parseInt(body.materialId);
  const newPricePerGram = parseFloat(body.newPricePerGram);

  const result = await confirmReprice(materialId, newPricePerGram);
  return NextResponse.json({ code: 0, data: result, message: `已更新 ${result.updatedCount} 件货品价格` });
}

export const POST = withApiLogging('metal-prices/reprice/confirm:POST', confirmRepricePOST);
