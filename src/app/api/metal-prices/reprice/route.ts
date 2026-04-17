import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { materialId, newPricePerGram } = body;

  const parsedMaterialId = parseInt(materialId);
  const parsedNewPrice = parseFloat(newPricePerGram);

  if (!materialId || isNaN(parsedMaterialId)) {
    return NextResponse.json({ code: 400, data: null, message: '请选择材质' }, { status: 400 });
  }
  if (newPricePerGram === '' || newPricePerGram == null || isNaN(parsedNewPrice) || parsedNewPrice <= 0) {
    return NextResponse.json({ code: 400, data: null, message: '请输入有效的新克价' }, { status: 400 });
  }

  // Get current price
  const material = await db.dictMaterial.findUnique({ where: { id: parsedMaterialId } });
  if (!material) {
    return NextResponse.json({ code: 404, data: null, message: '材质不存在' }, { status: 404 });
  }

  const oldPrice = material.costPerGram || 0;

  // Find all in-stock items with this material that have weight
  const items = await db.item.findMany({
    where: { materialId: parsedMaterialId, status: 'in_stock', isDeleted: false },
    include: { spec: true },
  });

  const affectedItems = items
    .filter(item => item.spec?.weight && item.spec.weight > 0)
    .map(item => {
      const weight = item.spec!.weight!;
      const laborCost = item.sellingPrice - weight * oldPrice; // 工费 = 原售价 - 原克重×原单价
      const newPrice = Math.round((weight * parsedNewPrice + laborCost) * 100) / 100;
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
