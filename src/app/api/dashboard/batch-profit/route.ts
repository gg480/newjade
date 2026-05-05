import { NextResponse } from 'next/server';
import { getBatchProfitReport } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('material_id') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  const data = await getBatchProfitReport({ materialId, status });

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
