import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  // Get latest price per material that has cost_per_gram
  const materials = await db.dictMaterial.findMany({
    where: { costPerGram: { not: null } },
    include: { metalPrices: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
  });

  const result = materials.map(m => ({
    materialId: m.id,
    materialName: m.name,
    subType: m.subType,
    costPerGram: m.costPerGram,
    currentPrice: m.metalPrices[0]?.pricePerGram || m.costPerGram || 0,
    effectiveDate: m.metalPrices[0]?.effectiveDate || null,
    lastUpdated: m.metalPrices[0]?.createdAt || null,
  }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { materialId, pricePerGram } = body;

  const today = new Date().toISOString().slice(0, 10);

  try {
    const parsedMaterialId = parseInt(materialId);
    const parsedPricePerGram = parseFloat(pricePerGram);

    if (!materialId || isNaN(parsedMaterialId)) {
      return NextResponse.json({ code: 400, data: null, message: '请选择材质' }, { status: 400 });
    }
    if (pricePerGram === '' || pricePerGram == null || isNaN(parsedPricePerGram) || parsedPricePerGram <= 0) {
      return NextResponse.json({ code: 400, data: null, message: '请输入有效的克价' }, { status: 400 });
    }

    const record = await db.metalPrice.create({
      data: { materialId: parsedMaterialId, pricePerGram: parsedPricePerGram, effectiveDate: today },
    });

    // Also update the material's cost_per_gram
    await db.dictMaterial.update({
      where: { id: parsedMaterialId },
      data: { costPerGram: parsedPricePerGram },
    });

    return NextResponse.json({ code: 0, data: record, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}
