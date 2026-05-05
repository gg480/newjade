import { NextResponse } from 'next/server';
import { getSalesByChannel } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date') ?? undefined;
  const endDate = searchParams.get('end_date') ?? undefined;

  const data = await getSalesByChannel({ startDate, endDate });

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
