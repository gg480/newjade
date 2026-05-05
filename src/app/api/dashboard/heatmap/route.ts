import { NextResponse } from 'next/server';
import { getSalesHeatmap } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') || '3');

  const data = await getSalesHeatmap({ months });

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
