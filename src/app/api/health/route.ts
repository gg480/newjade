import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    code: 0,
    data: {
      ok: dbOk,
      db: dbOk,
      version: '0.2.0',
      timestamp: new Date().toISOString(),
    },
    message: 'ok',
  });
}
