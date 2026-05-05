import { NextResponse } from 'next/server';
import { getAggregate } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date') ?? undefined;
  const endDate = searchParams.get('end_date') ?? undefined;
  const agingDays = parseInt(searchParams.get('aging_days') || '90');
  const months = parseInt(searchParams.get('months') || '12');
  const limit = parseInt(searchParams.get('limit') || '5');

  try {
    const data = await getAggregate({ startDate, endDate, agingDays, months, limit });

    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message }, { status: 500 });
  }
}
