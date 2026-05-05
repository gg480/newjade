import { NextResponse } from 'next/server';
import { getStockAging } from '@/services/dashboard.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minDays = parseInt(searchParams.get('min_days') || '90');

  const data = await getStockAging({ minDays });

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
