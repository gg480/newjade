import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('material_id');
  const status = searchParams.get('status');

  const where: any = { isDeleted: false };
  if (materialId) where.materialId = parseInt(materialId);
  if (status) where.status = status;

  const items = await db.item.findMany({
    where,
    include: { material: true, type: true, spec: true, tags: true },
    orderBy: { skuCode: 'asc' },
  });

  // Generate CSV
  const headers = ['SKU', '名称', '材质', '器型', '成本', '分摊成本', '售价', '底价', '状态', '产地', '柜台', '证书号', '入库日期'];
  const rows = items.map(item => [
    item.skuCode,
    item.name || '',
    item.material?.name || '',
    item.type?.name || '',
    item.costPrice?.toFixed(2) || '',
    item.allocatedCost?.toFixed(2) || '',
    item.sellingPrice?.toFixed(2) || '',
    item.floorPrice?.toFixed(2) || '',
    { in_stock: '在库', sold: '已售', returned: '已退' }[item.status] || item.status,
    item.origin || '',
    item.counter?.toString() || '',
    item.certNo || '',
    item.purchaseDate || '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=inventory_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
