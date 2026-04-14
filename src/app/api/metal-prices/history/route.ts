import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('material_id');
  const limit = parseInt(searchParams.get('limit') || '20');

  const where: any = {};
  if (materialId) where.materialId = parseInt(materialId);

  const records = await db.metalPrice.findMany({
    where,
    include: { material: true },
    orderBy: { effectiveDate: 'desc' },
    take: limit,
  });

  const result = records.map(r => ({
    ...r,
    materialName: r.material?.name,
  }));

  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}
