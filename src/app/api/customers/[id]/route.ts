import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id: parseInt(id) },
    include: {
      saleRecords: {
        include: {
          item: {
            include: {
              material: true,
              type: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      },
    },
  });
  if (!customer) return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });

  // Parse tags
  let parsedTags: string[] = [];
  try { parsedTags = customer.tags ? JSON.parse(customer.tags) : []; } catch { parsedTags = []; }

  // Calculate purchase statistics
  const saleRecords = customer.saleRecords || [];
  const totalSpending = saleRecords.reduce((sum, s) => sum + (s.actualPrice || 0), 0);
  const orderCount = saleRecords.length;
  const avgOrderValue = orderCount > 0 ? Math.round((totalSpending / orderCount) * 100) / 100 : 0;

  // Last purchase date & days since
  const lastPurchaseDate = saleRecords.length > 0 ? saleRecords[0].saleDate : null;
  const daysSinceLastPurchase = lastPurchaseDate
    ? Math.floor((Date.now() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Monthly spending for chart (last 12 months)
  const monthlySpending: { month: string; amount: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthSales = saleRecords.filter(s => s.saleDate && s.saleDate.startsWith(monthKey));
    const amount = monthSales.reduce((sum, s) => sum + (s.actualPrice || 0), 0);
    monthlySpending.push({ month: monthKey, amount });
  }

  // Preference analysis: most bought material types
  const materialCounts: Record<string, { count: number; total: number }> = {};
  for (const sr of saleRecords) {
    const matName = (sr.item as any)?.material?.name || '未知';
    if (!materialCounts[matName]) materialCounts[matName] = { count: 0, total: 0 };
    materialCounts[matName].count++;
    materialCounts[matName].total += sr.actualPrice || 0;
  }
  const topMaterials = Object.entries(materialCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data]) => ({ name, count: data.count, totalSpending: data.total }));

  // VIP level progress
  const vipThresholds = [
    { label: '普通客户', min: 0, max: 5000 },
    { label: '银卡会员', min: 5000, max: 20000 },
    { label: '金卡会员', min: 20000, max: 50000 },
    { label: '钻石会员', min: 50000, max: Infinity },
  ];
  const currentVip = vipThresholds.find(v => totalSpending >= v.min && totalSpending < v.max) || vipThresholds[vipThresholds.length - 1];
  const nextVip = vipThresholds.find(v => v.min > currentVip.min);
  const progressToNext = nextVip
    ? Math.min(((totalSpending - currentVip.min) / (nextVip.min - currentVip.min)) * 100, 100)
    : 100;

  return NextResponse.json({
    code: 0,
    data: {
      ...customer,
      tags: parsedTags,
      purchaseStats: {
        totalSpending,
        orderCount,
        avgOrderValue,
        lastPurchaseDate,
        daysSinceLastPurchase,
      },
      monthlySpending,
      topMaterials,
      vipProgress: {
        currentLevel: currentVip.label,
        currentMin: currentVip.min,
        nextLevel: nextVip?.label || null,
        nextMin: nextVip?.min || null,
        progressToNext: Math.round(progressToNext),
      },
    },
    message: 'ok',
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Handle tags: convert array to JSON string
  const updateData: any = { ...body };
  if (Array.isArray(body.tags)) {
    updateData.tags = body.tags.length > 0 ? JSON.stringify(body.tags) : null;
  }

  try {
    const customer = await db.customer.update({ where: { id: parseInt(id) }, data: updateData });
    const parsedTags: string[] = [];
    try { if (customer.tags) parsedTags.push(...JSON.parse(customer.tags)); } catch { /* empty */ }
    return NextResponse.json({ code: 0, data: { ...customer, tags: parsedTags }, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const customer = await db.customer.findUnique({
      where: { id: parseInt(id) },
    });
    if (!customer) return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });

    const activeSales = await db.saleRecord.count({
      where: { customerId: parseInt(id), item: { status: 'sold' } },
    });
    if (activeSales > 0) {
      return NextResponse.json({ code: 400, data: null, message: `该客户有 ${activeSales} 笔有效销售记录，无法删除` }, { status: 400 });
    }

    await db.customer.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ code: 0, data: null, message: '已删除' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
