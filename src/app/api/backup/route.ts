import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

function resolveDbPathFromEnv(): string | null {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    const raw = dbUrl.slice('file:'.length);
    if (!raw) return null;
    return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  }
  return null;
}

function getDbPath(): string {
  const fromDbUrl = resolveDbPathFromEnv();
  if (fromDbUrl) return fromDbUrl;

  const dataDir = process.env.DATA_DIR;
  if (dataDir) return path.join(dataDir, 'db', 'custom.db');

  const cwdDefault = path.join(process.cwd(), 'db', 'custom.db');
  if (existsSync(cwdDefault)) return cwdDefault;

  // Local dev fallback
  return path.join(process.cwd(), 'prisma', 'dev.db');
}

function getPreRestoreBackupDir(): string {
  const base = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  return path.join(base, 'pre-restore');
}

function getTimestampTag(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// GET /api/backup — Download SQLite database backup
export async function GET() {
  try {
    const dbPath = getDbPath();

    if (!existsSync(dbPath)) {
      return NextResponse.json({ code: 404, data: null, message: '数据库文件不存在' }, { status: 404 });
    }

    const buffer = await readFile(dbPath);
    const filename = `jade-backup-${getTimestampTag()}.db`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
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
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.db') && !lowerName.endsWith('.sqlite') && !lowerName.endsWith('.sqlite3')) {
      return NextResponse.json({ code: 400, data: null, message: '仅支持 .db/.sqlite/.sqlite3 文件恢复' }, { status: 400 });
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ code: 400, data: null, message: '文件大小不能超过100MB' }, { status: 400 });
    }

    const dbPath = getDbPath();
    const dbDir = path.dirname(dbPath);
    const preRestoreDir = getPreRestoreBackupDir();

    // Ensure db directory exists
    await mkdir(dbDir, { recursive: true });
    await mkdir(preRestoreDir, { recursive: true });

    let preRestoreBackupFilename: string | null = null;

    // Save current db as backup before overwriting
    if (existsSync(dbPath)) {
      preRestoreBackupFilename = `pre-restore-${getTimestampTag()}.db`;
      const preBackupPath = path.join(preRestoreDir, preRestoreBackupFilename);
      const currentBuffer = await readFile(dbPath);
      await writeFile(preBackupPath, currentBuffer);
    }

    // Write new database file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(dbPath, buffer);

    return NextResponse.json({
      code: 0,
      data: { filename: file.name, size: file.size, preRestoreBackupFilename },
      message: '数据库恢复成功，请刷新页面',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `恢复失败: ${e.message}` }, { status: 500 });
  }
}
