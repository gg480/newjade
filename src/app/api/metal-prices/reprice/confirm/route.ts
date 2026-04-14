import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { materialId, newPricePerGram } = body;

  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  if (!material) {
    return NextResponse.json({ code: 404, data: null, message: '材质不存在' }, { status: 404 });
  }

  const oldPrice = material.costPerGram || 0;

  const items = await db.item.findMany({
    where: { materialId, status: 'in_stock', isDeleted: false },
    include: { spec: true },
  });

  let updatedCount = 0;
  for (const item of items) {
    if (!item.spec?.weight || item.spec.weight <= 0) continue;
    const weight = item.spec.weight;
    const laborCost = item.sellingPrice - weight * oldPrice;
    const newPrice = Math.round((weight * newPricePerGram + laborCost) * 100) / 100;
    await db.item.update({ where: { id: item.id }, data: { sellingPrice: newPrice } });
    updatedCount++;
  }

  // Update material price and add history
  await db.dictMaterial.update({ where: { id: materialId }, data: { costPerGram: newPricePerGram } });
  const today = new Date().toISOString().slice(0, 10);
  await db.metalPrice.create({ data: { materialId, pricePerGram: newPricePerGram, effectiveDate: today } });

  return NextResponse.json({ code: 0, data: { updatedCount }, message: `已更新 ${updatedCount} 件货品价格` });
}
