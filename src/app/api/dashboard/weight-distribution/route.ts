import { NextResponse } from 'next/server';
import { getWeightDistribution } from '@/services/dashboard.service';

export async function GET() {
  const data = await getWeightDistribution();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}
