import { NextResponse } from 'next/server';
import { getInventoryValueByCategory } from '@/services/dashboard.service';

export async function GET() {
  try {
    const data = await getInventoryValueByCategory();
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message }, { status: 500 });
  }
}
