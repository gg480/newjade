import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupName = searchParams.get('group_name');
  const includeInactive = searchParams.get('include_inactive') === 'true';
  const where: any = {};
  if (groupName) where.groupName = groupName;
  if (!includeInactive) where.isActive = true;
  const items = await db.dictTag.findMany({ where, orderBy: [{ groupName: 'asc' }, { name: 'asc' }] });
  return NextResponse.json({ code: 0, data: items, message: 'ok' });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, groupName } = body;
  try {
    const item = await db.dictTag.create({ data: { name, groupName } });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      return NextResponse.json({ code: 400, data: null, message: '标签名称已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
