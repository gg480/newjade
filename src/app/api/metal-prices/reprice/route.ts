import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { materialId, newPricePerGram } = body;

  // Get current price
  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  if (!material) {
    return NextResponse.json({ code: 404, data: null, message: '材质不存在' }, { status: 404 });
  }

  const oldPrice = material.costPerGram || 0;

  // Find all in-stock items with this material that have weight
  const items = await db.item.findMany({
    where: { materialId, status: 'in_stock', isDeleted: false },
    include: { spec: true },
  });

  const affectedItems = items
    .filter(item => item.spec?.weight && item.spec.weight > 0)
    .map(item => {
      const weight = item.spec!.weight!;
      const laborCost = item.sellingPrice - weight * oldPrice; // 工费 = 原售价 - 原克重×原单价
      const newPrice = Math.round((weight * newPricePerGram + laborCost) * 100) / 100;
      return {
        skuCode: item.skuCode,
        name: item.name,
        oldPrice: item.sellingPrice,
        newPrice,
        itemId: item.id,
      };
    });

  return NextResponse.json({ code: 0, data: { affectedItems }, message: 'ok' });
}
