import { NextResponse } from 'next/server';
import { previewReprice } from '@/services/metal-prices.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const materialId = parseInt(body.materialId);
    const newPricePerGram = parseFloat(body.newPricePerGram);

    const result = await previewReprice(materialId, newPricePerGram);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: any) {
    const status = e.statusCode || 500;
    return NextResponse.json({ code: status, data: null, message: e.message || '重定价预览失败' }, { status });
  }
}
