import { NextResponse } from 'next/server';
import { parse as csvParse } from 'csv-parse/sync';
import { importSalesRows } from '@/services/import.service';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const autoCreate = formData.get('autoCreate') !== 'false';

    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请上传CSV文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let csvText = buffer.toString('utf-8');
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    const rows = csvParse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];

    if (rows.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: 'CSV文件为空' }, { status: 400 });
    }

    const { successCount, failCount, results } = await importSalesRows(rows, { autoCreate });

    return NextResponse.json({
      code: 0,
      data: {
        total: rows.length,
        successCount,
        failCount,
        results,
      },
      message: `导入完成: 成功${successCount}条, 失败${failCount}条`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message: `导入失败: ${message}` }, { status: 500 });
  }
}
