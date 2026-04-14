import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// GET /api/backup — Download SQLite database backup
export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'db', 'custom.db');

    if (!existsSync(dbPath)) {
      return NextResponse.json({ code: 404, data: null, message: '数据库文件不存在' }, { status: 404 });
    }

    const buffer = await readFile(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `jade-backup-${timestamp}.db`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `备份失败: ${e.message}` }, { status: 500 });
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

    // Validate file extension
    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ code: 400, data: null, message: '仅支持 .db 文件恢复' }, { status: 400 });
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ code: 400, data: null, message: '文件大小不能超过100MB' }, { status: 400 });
    }

    const dbPath = path.join(process.cwd(), 'db', 'custom.db');
    const backupDir = path.join(process.cwd(), 'db');

    // Ensure db directory exists
    await mkdir(backupDir, { recursive: true });

    // Save current db as backup before overwriting
    if (existsSync(dbPath)) {
      const preBackupPath = path.join(backupDir, `pre-restore-${Date.now()}.db`);
      const currentBuffer = await readFile(dbPath);
      await writeFile(preBackupPath, currentBuffer);
    }

    // Write new database file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(dbPath, buffer);

    return NextResponse.json({
      code: 0,
      data: { filename: file.name, size: file.size },
      message: '数据库恢复成功，请刷新页面',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `恢复失败: ${e.message}` }, { status: 500 });
  }
}
