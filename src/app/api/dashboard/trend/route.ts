import { NextResponse } from 'next/server';
import { getSalesTrend } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') || '12');

  const data = await getSalesTrend({ months });

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
