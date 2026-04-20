import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const configs = await db.sysConfig.findMany();
  return NextResponse.json({ code: 0, data: configs, message: 'ok' });
}

export async function PUT(req: Request) {
  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return NextResponse.json({ code: 400, data: null, message: '缺少 key 或 value' }, { status: 400 });
  }
  try {
    const normalizedKey = String(key).trim();
    const normalizedValue = String(value);
    const config = await db.sysConfig.upsert({
      where: { key: normalizedKey },
      update: { value: normalizedValue },
      create: {
        key: normalizedKey,
        value: normalizedValue,
        description: normalizedKey,
      },
    });
    return NextResponse.json({ code: 0, data: config, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `保存配置失败: ${e.message || 'unknown error'}` }, { status: 500 });
  }
}
