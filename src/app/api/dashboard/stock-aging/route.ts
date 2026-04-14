import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minDays = parseInt(searchParams.get('min_days') || '90');

  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false, purchaseDate: { not: null } },
    include: { material: true, type: true },
  });

  const today = new Date();
  const agingItems = items
    .map(item => {
      const ageDays = item.purchaseDate
        ? Math.floor((today.getTime() - new Date(item.purchaseDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return { ...item, ageDays };
    })
    .filter(item => item.ageDays >= minDays)
    .sort((a, b) => b.ageDays - a.ageDays);

  const result = agingItems.map(item => ({
    itemId: item.id,
    skuCode: item.skuCode,
    name: item.name,
    batchCode: item.batchCode,
    materialName: item.material?.name,
    typeName: item.type?.name,
    costPrice: item.costPrice,
    allocatedCost: item.allocatedCost,
    sellingPrice: item.sellingPrice,
    purchaseDate: item.purchaseDate,
    ageDays: item.ageDays,
    counter: item.counter,
  }));

  const totalValue = result.reduce((sum, i) => sum + (i.allocatedCost || i.costPrice || 0), 0);

  return NextResponse.json({
    code: 0,
    data: {
      items: result,
      totalItems: result.length,
      totalValue: Math.round(totalValue * 100) / 100,
    },
    message: 'ok',
  });
}
