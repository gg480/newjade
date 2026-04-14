import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  const where: any = {};
  if (startDate) where.saleDate = { ...where.saleDate, gte: startDate };
  if (endDate) where.saleDate = { ...where.saleDate, lte: endDate };

  const sales = await db.saleRecord.findMany({
    where,
    include: { item: { include: { material: true } } },
  });

  // Group by material
  const byMaterial = new Map<number, { materialName: string; revenue: number; cost: number; salesCount: number }>();
  for (const sale of sales) {
    const matId = sale.item?.materialId;
    const matName = sale.item?.material?.name || '未知';
    const cost = sale.item?.allocatedCost || sale.item?.costPrice || 0;
    if (!byMaterial.has(matId)) {
      byMaterial.set(matId, { materialName: matName, revenue: 0, cost: 0, salesCount: 0 });
    }
    const entry = byMaterial.get(matId)!;
    entry.revenue += sale.actualPrice;
    entry.cost += cost;
    entry.salesCount += 1;
  }

  const result = Array.from(byMaterial.values()).map(e => ({
    ...e,
    revenue: Math.round(e.revenue * 100) / 100,
    cost: Math.round(e.cost * 100) / 100,
    profit: Math.round((e.revenue - e.cost) * 100) / 100,
    profitMargin: e.revenue > 0 ? Math.round(((e.revenue - e.cost) / e.revenue) * 1000) / 1000 : 0,
  }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
