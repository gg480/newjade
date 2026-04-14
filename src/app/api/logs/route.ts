import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

// Operation logs API endpoint

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const action = searchParams.get('action');
  const targetType = searchParams.get('target_type');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const search = searchParams.get('search');

  const where: any = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (search) {
    where.detail = { contains: search, mode: Prisma.QueryMode.insensitive };
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const total = await db.operationLog.count({ where });
  const logs = await db.operationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * size,
    take: size,
  });

  return NextResponse.json({
    code: 0,
    data: {
      items: logs,
      pagination: { total, page, size, pages: Math.ceil(total / size) },
    },
    message: 'ok',
  });
}
