import { NextResponse } from 'next/server';
import { getCustomerFrequency } from '@/services/dashboard.service';

export async function GET() {
  const data = await getCustomerFrequency();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}
