import fs from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { ValidationError, AppError } from '@/lib/errors';

// ============================================================
// 内部辅助函数
// ============================================================

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

// ============================================================
// 服务方法
// ============================================================

/**
 * 下载当前数据库文件
 * @returns { path: string; buffer: Buffer; filename: string }
 * @throws {AppError} 数据库文件不存在时抛出
 */
export async function downloadBackup() {
  const dbPath = getDbPath();

  if (!existsSync(dbPath)) {
    throw new AppError('数据库文件不存在', 404);
  }

  const buffer = await readFile(dbPath);
  const filename = `jade-backup-${getTimestampTag()}.db`;

  return { path: dbPath, buffer, filename };
}

/**
 * 从上传文件恢复数据库
 * 恢复前自动备份当前数据库
 * @param file 上传的文件对象（含 name, arrayBuffer, size）
 * @throws {ValidationError} 文件校验失败时抛出
 */
export async function restoreBackup(file: {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
  size: number;
}) {
  // 校验文件扩展名
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.db') && !lowerName.endsWith('.sqlite') && !lowerName.endsWith('.sqlite3')) {
    throw new ValidationError('仅支持 .db/.sqlite/.sqlite3 文件恢复');
  }

  // 校验文件大小（最大100MB）
  if (file.size > 100 * 1024 * 1024) {
    throw new ValidationError('文件大小不能超过100MB');
  }

  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  const preRestoreDir = getPreRestoreBackupDir();

  // 确保目录存在
  await mkdir(dbDir, { recursive: true });
  await mkdir(preRestoreDir, { recursive: true });

  let preRestoreBackupFilename: string | null = null;

  // 恢复前备份当前数据库
  if (existsSync(dbPath)) {
    preRestoreBackupFilename = `pre-restore-${getTimestampTag()}.db`;
    const preBackupPath = path.join(preRestoreDir, preRestoreBackupFilename);
    const currentBuffer = await readFile(dbPath);
    await writeFile(preBackupPath, currentBuffer);
  }

  // 写入新数据库文件
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dbPath, buffer);

  return {
    filename: file.name,
    size: file.size,
    preRestoreBackupFilename,
  };
}
