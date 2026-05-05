import { NextResponse } from 'next/server';
import { getExportBatchesData } from '@/services/export.service';

export async function GET() {
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
