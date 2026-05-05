import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { importItemsFromCsv } from '@/services/import.service';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const autoCreate = formData.get('autoCreate') !== 'false';
    const skipExisting = formData.get('skipExisting') !== 'false';
    const batchIdStr = formData.get('batchId') as string | null;
    const batchId = batchIdStr ? parseInt(batchIdStr) : null;

    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请上传CSV文件' }, { status: 400 });
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    let csvText = buffer.toString('utf-8');
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    // Parse CSV with papaparse
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
    });

    if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
      return NextResponse.json({
        code: 400,
        data: null,
        message: `CSV解析失败: ${parseResult.errors[0].message}`,
      }, { status: 400 });
    }

    const rows = parseResult.data as Record<string, string>[];
    if (rows.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: 'CSV文件为空' }, { status: 400 });
    }

    // Use service to handle import logic
    const result = await importItemsFromCsv(rows, { autoCreate, skipExisting, batchId });

    return NextResponse.json({
      code: 0,
      data: result,
      message: `导入完成: 成功${result.successCount}条, 失败${result.failCount}条`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message: `导入失败: ${message}` }, { status: 500 });
  }
}
