import { NextResponse } from 'next/server';
import { getTopCustomers } from '@/services/dashboard.service';

export async function GET() {
  try {
    const data = await getTopCustomers();
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '服务器错误';
    console.error('Top customers API error:', e);
    return NextResponse.json({ code: 500, data: null, message }, { status: 500 });
  }
}
