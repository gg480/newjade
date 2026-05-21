import { NextResponse } from 'next/server';
import { getCurrentPrices, createPriceRecord } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function metalPricesGET() {
  const data = await getCurrentPrices();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}

async function metalPricesPOST(req: Request) {
  const body = await req.json();
  const materialId = parseInt(body.materialId);
  const pricePerGram = parseFloat(body.pricePerGram);

  const record = await createPriceRecord({ materialId, pricePerGram });
  return NextResponse.json({ code: 0, data: record, message: 'ok' });
}

export const GET = withApiLogging('metal-prices:GET', metalPricesGET);
export const POST = withApiLogging('metal-prices:POST', metalPricesPOST);
