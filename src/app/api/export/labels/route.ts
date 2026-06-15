import { NextResponse } from 'next/server';
import { getLabelExportData } from '@/services/export.service';
import { ValidationError } from '@/lib/errors';
import { guardPermission } from '@/lib/api/permission-guard';

export async function POST(req: Request) {
  const denied = await guardPermission(req, 'action:export');
  if (denied) return denied;
  const { ids } = await req.json();

  // 校验 ids 是非空数组
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('请选择至少一个货品');
  }

  const { headers, rows } = await getLabelExportData({ ids });

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const bom = '\uFEFF';
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=labels_${today}.csv`,
    },
  });
}
