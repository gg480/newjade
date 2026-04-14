import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const WEIGHT_RANGES = [
  { range: '0-5g', label: '0-5g', min: 0, max: 5 },
  { range: '5-20g', label: '5-20g', min: 5, max: 20 },
  { range: '20-50g', label: '20-50g', min: 20, max: 50 },
  { range: '50-100g', label: '50-100g', min: 50, max: 100 },
  { range: '100g+', label: '100g+', min: 100, max: Infinity },
];

export async function GET() {
  const items = await db.item.findMany({
    where: { status: 'in_stock', isDeleted: false },
    include: { material: true, spec: true },
  });

  // Scatter data: items with weight
  const scatter: { weight: number; sellingPrice: number; materialName: string }[] = [];
  // Stacked data: grouped by weight range then by material
  const stackedMap = new Map<string, Map<string, number>>();

  for (const r of WEIGHT_RANGES) {
    stackedMap.set(r.range, new Map());
  }

  for (const item of items) {
    const weight = item.spec?.weight;
    if (weight == null) continue;

    const materialName = item.material?.name || '未知';

    // Scatter
    scatter.push({
      weight,
      sellingPrice: item.sellingPrice,
      materialName,
    });

    // Stacked
    for (const r of WEIGHT_RANGES) {
      if (weight >= r.min && weight < r.max) {
        const matMap = stackedMap.get(r.range)!;
        matMap.set(materialName, (matMap.get(materialName) || 0) + 1);
        break;
      }
    }
  }

  // Get all material names for stacked chart
  const allMaterials = new Set<string>();
  for (const item of items) {
    if (item.spec?.weight != null) {
      allMaterials.add(item.material?.name || '未知');
    }
  }

  const stacked = WEIGHT_RANGES.map(r => {
    const matMap = stackedMap.get(r.range)!;
    const entry: { range: string; label: string; materials: Record<string, number> } = {
      range: r.range,
      label: r.label,
      materials: {},
    };
    for (const mat of allMaterials) {
      entry.materials[mat] = matMap.get(mat) || 0;
    }
    return entry;
  });

  return NextResponse.json({ code: 0, data: { scatter, stacked, materials: Array.from(allMaterials) }, message: 'ok' });
}
