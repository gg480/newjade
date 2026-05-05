import { NextResponse } from 'next/server';
import { getSellingPriceDistribution } from '@/services/dashboard.service';

export async function GET() {
  const data = await getSellingPriceDistribution();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}
