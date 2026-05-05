import { NextResponse } from 'next/server';
import { getTopSellers } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '5');

  const data = await getTopSellers({ limit });

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
