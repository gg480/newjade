import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

async function generateCustomerCode(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `cst${today}`;
  const last = await db.customer.findFirst({
    where: { customerCode: { startsWith: prefix } },
    orderBy: { customerCode: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.customerCode.slice(-3));
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = parseInt(searchParams.get('size') || '20');
    const keyword = searchParams.get('keyword');
    const tag = searchParams.get('tag');

    const where: any = { isActive: true };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { phone: { contains: keyword } },
        { wechat: { contains: keyword } },
      ];
    }
    if (tag) {
      where.tags = { contains: tag };
    }

    const total = await db.customer.count({ where });
    const items = await db.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    });

    const customerIds = items.map(c => c.id);
    const spendingAgg = await db.saleRecord.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _sum: { actualPrice: true },
      _count: { id: true },
    });

    const spendingMap = new Map<number, { totalSpending: number; orderCount: number }>();
    for (const agg of spendingAgg) {
      if (agg.customerId) {
        spendingMap.set(agg.customerId, {
          totalSpending: agg._sum.actualPrice || 0,
          orderCount: agg._count.id,
        });
      }
    }

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const [totalCustomers, newThisMonth, totalSpendingAll] = await Promise.all([
      db.customer.count({ where: { isActive: true } }),
      db.customer.count({ where: { isActive: true, createdAt: { gte: new Date(monthStart) } } }),
      db.saleRecord.aggregate({ _sum: { actualPrice: true } }),
    ]);

    const avgOrderValue = totalSpendingAll._sum.actualPrice
      ? Math.round((totalSpendingAll._sum.actualPrice / Math.max(totalCustomers, 1)) * 100) / 100
      : 0;

    const itemsWithSpending = items.map(c => {
      const spending = spendingMap.get(c.id) || { totalSpending: 0, orderCount: 0 };
      let parsedTags: string[] = [];
      try {
        parsedTags = c.tags ? JSON.parse(c.tags) : [];
      } catch { parsedTags = []; }
      return {
        ...c,
        tags: parsedTags,
        totalSpending: spending.totalSpending,
        orderCount: spending.orderCount,
      };
    });

    // Get all unique tags for tag filter dropdown
    const allCustomers = await db.customer.findMany({
      where: { isActive: true },
      select: { tags: true },
    });
    const tagSet = new Set<string>();
    for (const c of allCustomers) {
      try {
        if (c.tags) {
          const parsed = JSON.parse(c.tags);
          if (Array.isArray(parsed)) parsed.forEach((t: string) => tagSet.add(t));
        }
      } catch { /* skip invalid tags */ }
    }
    const allTags = Array.from(tagSet).sort();

    return NextResponse.json({
      code: 0,
      data: {
        items: itemsWithSpending,
        pagination: { total, page, size, pages: Math.ceil(total / size) },
        stats: {
          totalCustomers,
          newThisMonth,
          totalSpending: totalSpendingAll._sum.actualPrice || 0,
          avgOrderValue,
        },
        allTags,
      },
      message: 'ok',
    });
  } catch (e: any) {
    console.error('Customer API error:', e);
    return NextResponse.json({ code: 500, data: null, message: e.message || '服务器错误' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, phone, wechat, address, notes, tags } = body;
  try {
    const customerCode = await generateCustomerCode();
    const tagsStr = Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null;
    const customer = await db.customer.create({
      data: { customerCode, name, phone, wechat, address, notes, tags: tagsStr },
    });
    return NextResponse.json({ code: 0, data: { ...customer, tags: tags || [] }, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
