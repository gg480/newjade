import { NextResponse } from 'next/server';
import { getAgeDistribution } from '@/services/dashboard.service';

export async function GET() {
  const data = await getAgeDistribution();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}
