import { NextResponse } from 'next/server';
import * as backupService from '@/services/backup.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

// GET /api/backup — Download SQLite database backup
async function backupGET() {
  const result = await backupService.downloadBackup();

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-sqlite3',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.buffer.length.toString(),
    },
  });
}

// POST /api/backup — Restore database from uploaded file
async function backupPOST(req: Request) {
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
}

export const GET = withApiLogging('backup:GET', backupGET);
export const POST = withApiLogging('backup:POST', backupPOST);
