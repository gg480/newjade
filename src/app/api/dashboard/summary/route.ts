import { NextResponse } from 'next/server';
import { getDashboardSummary } from '@/services/dashboard.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agingDays = parseInt(searchParams.get('aging_days') || '90');

    const data = await getDashboardSummary({ agingDays });

    return NextResponse.json({
      code: 0,
      data,
      message: `ok (aging_days=${agingDays})`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      code: 500,
      data: null,
      message: `dashboard summary failed: ${message}`,
    }, { status: 500 });
  }
}
