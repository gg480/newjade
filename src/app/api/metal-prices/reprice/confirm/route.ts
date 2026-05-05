import { NextResponse } from 'next/server';
import { confirmReprice } from '@/services/metal-prices.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const materialId = parseInt(body.materialId);
    const newPricePerGram = parseFloat(body.newPricePerGram);

    const result = await confirmReprice(materialId, newPricePerGram);
    return NextResponse.json({ code: 0, data: result, message: `已更新 ${result.updatedCount} 件货品价格` });
  } catch (e: any) {
    const status = e.statusCode || 500;
    return NextResponse.json({ code: status, data: null, message: e.message || '重定价确认失败' }, { status });
  }
}
