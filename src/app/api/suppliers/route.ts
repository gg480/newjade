import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword');
  const where: any = { isActive: true };
  if (keyword) {
    where.OR = [{ name: { contains: keyword } }, { contact: { contains: keyword } }];
  }
  const items = await db.supplier.findMany({ where, orderBy: { name: 'asc' } });
  return NextResponse.json({ code: 0, data: { items, pagination: { total: items.length, page: 1, size: 100, pages: 1 } }, message: 'ok' });
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const item = await db.supplier.create({ data: body });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
