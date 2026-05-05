import { NextResponse } from 'next/server';
import { getInventoryTurnover } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') || '6');

  const data = await getInventoryTurnover({ months });

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
