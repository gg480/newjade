import { NextResponse } from 'next/server';
import * as backupService from '@/services/backup.service';

// GET /api/backup — Download SQLite database backup
export async function GET() {
  try {
    const result = await backupService.downloadBackup();

    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.buffer.length.toString(),
      },
    });
  } catch (e: any) {
    const status = e.statusCode || 500;
    return NextResponse.json({ code: status, data: null, message: `备份失败: ${e.message}` }, { status });
  }
}

// POST /api/backup — Restore database from uploaded file
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('backup') as File | null;

    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请选择备份文件' }, { status: 400 });
    }

    const result = await backupService.restoreBackup({
      name: file.name,
      arrayBuffer: () => file.arrayBuffer(),
      size: file.size,
    });

    return NextResponse.json({
      code: 0,
      data: result,
      message: '数据库恢复成功，请刷新页面',
    });
  } catch (e: any) {
    const status = e.statusCode || 500;
    return NextResponse.json({ code: status, data: null, message: `恢复失败: ${e.message}` }, { status });
  }
}
