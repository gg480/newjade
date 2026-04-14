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
    const config = await db.sysConfig.update({ where: { key }, data: { value } });
    return NextResponse.json({ code: 0, data: config, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 404, data: null, message: '配置项不存在' }, { status: 404 });
  }
}
