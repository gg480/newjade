import { NextResponse } from 'next/server';
import { getExportSalesData } from '@/services/export.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  const { headers, rows } = await getExportSalesData({ startDate, endDate });

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=sales_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
