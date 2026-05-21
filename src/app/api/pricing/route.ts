import { NextResponse } from 'next/server';
import * as pricingService from '@/services/pricing.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

// Pricing engine: suggest selling price based on cost
async function pricingPOST(req: Request) {
  const body = await req.json();
  const { costPrice, materialId, typeId, weight } = body;

  const result = await pricingService.calculatePrice({
    costPrice,
    materialId: materialId ?? null,
    typeId: typeId ?? null,
    weight: weight ?? null,
  });

  return NextResponse.json({
    code: 0,
    data: result,
    message: 'ok',
  });
}

export const POST = withApiLogging('pricing:POST', pricingPOST);
