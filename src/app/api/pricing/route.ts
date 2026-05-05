import { NextResponse } from 'next/server';
import * as pricingService from '@/services/pricing.service';

// Pricing engine: suggest selling price based on cost
export async function POST(req: Request) {
  try {
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
  } catch (e: any) {
    const status = e.statusCode || 500;
    const message = e.message || '定价计算失败';
    return NextResponse.json({ code: status, data: null, message }, { status });
  }
}
