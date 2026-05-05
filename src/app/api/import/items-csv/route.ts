import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { importItemsCsvRows } from '@/services/import.service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ code: 400, message: '请上传CSV文件' }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    const result = await importItemsCsvRows(records as Record<string, string>[]);

    // Build result message
    let message = `导入完成: 成功${result.success}件, 跳过${result.skipped}行`;
    if (result.duplicated > 0) message += `, 重复跳过${result.duplicated}件`;
    if (result.errors.length > 0) message += `, 错误${result.errors.length}行`;
    if (result.autoCreated.materials.length > 0) message += ` | 自动创建材质: ${result.autoCreated.materials.join('、')}`;
    if (result.autoCreated.types.length > 0) message += ` | 自动创建器型: ${result.autoCreated.types.join('、')}`;

    return NextResponse.json({
      code: 0,
      data: {
        success: result.success,
        skipped: result.skipped,
        duplicated: result.duplicated,
        errors: result.errors,
        autoCreated: result.autoCreated,
        inferred: result.inferred,
      },
      message,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, message: `导入失败: ${message}` }, { status: 500 });
  }
}
