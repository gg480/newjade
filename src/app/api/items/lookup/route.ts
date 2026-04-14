import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Lookup item by SKU code (for scan-to-sell)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sku = searchParams.get('sku');

  if (!sku) {
    return NextResponse.json({ code: 400, data: null, message: '请提供SKU码' }, { status: 400 });
  }

  const item = await db.item.findFirst({
    where: {
      skuCode: sku,
      isDeleted: false,
    },
    include: {
      material: true,
      type: true,
      spec: true,
    },
  });

  if (!item) {
    return NextResponse.json({ code: 404, data: null, message: '未找到该货品' }, { status: 404 });
  }

  return NextResponse.json({
    code: 0,
    data: {
      id: item.id,
      skuCode: item.skuCode,
      name: item.name,
      materialName: item.material?.name,
      typeName: item.type?.name,
      costPrice: item.costPrice,
      allocatedCost: item.allocatedCost,
      sellingPrice: item.sellingPrice,
      floorPrice: item.floorPrice,
      status: item.status,
      counter: item.counter,
      weight: item.spec?.weight,
    },
    message: 'ok',
  });
}
