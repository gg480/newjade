import { NextResponse } from 'next/server';
import { getCostPriceDistribution } from '@/services/dashboard.service';

export async function GET() {
  const data = await getCostPriceDistribution();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}
