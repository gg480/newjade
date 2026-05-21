import { NextResponse } from 'next/server';
import { previewReprice } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function repricePOST(req: Request) {
  const body = await req.json();
  const materialId = parseInt(body.materialId);
  const newPricePerGram = parseFloat(body.newPricePerGram);

  const result = await previewReprice(materialId, newPricePerGram);
  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}

export const POST = withApiLogging('metal-prices/reprice:POST', repricePOST);
