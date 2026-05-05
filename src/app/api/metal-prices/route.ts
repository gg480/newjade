import { NextResponse } from 'next/server';
import { getCurrentPrices, createPriceRecord } from '@/services/metal-prices.service';

export async function GET() {
  const data = await getCurrentPrices();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const materialId = parseInt(body.materialId);
    const pricePerGram = parseFloat(body.pricePerGram);

    const record = await createPriceRecord({ materialId, pricePerGram });
    return NextResponse.json({ code: 0, data: record, message: 'ok' });
  } catch (e: any) {
    const status = e.statusCode || 500;
    return NextResponse.json({ code: status, data: null, message: e.message || '更新失败' }, { status });
  }
}
