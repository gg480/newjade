import { NextResponse } from 'next/server';
import { getExportBatchesData } from '@/services/export.service';
import { guardPermission } from '@/lib/api/permission-guard';

export async function GET(req: Request) {
  const denied = await guardPermission(req, 'action:export');
  if (denied) return denied;
  const { headers, rows } = await getExportBatchesData();

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=batches_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
