import { NextResponse } from 'next/server';
import { getExportInventoryData } from '@/services/export.service';
import { guardPermission } from '@/lib/api/permission-guard';

export async function GET(req: Request) {
  const denied = await guardPermission(req, 'action:export');
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('material_id');
  const status = searchParams.get('status');

  const { headers, rows } = await getExportInventoryData({ materialId, status });

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=inventory_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
