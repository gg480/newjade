import { NextResponse } from 'next/server';
import { getMomComparison } from '@/services/dashboard.service';

export async function GET() {
  const data = await getMomComparison();

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
