import { PrismaClient, Prisma } from '@prisma/client'
import { mkdirSync, existsSync } from 'fs'
import path from 'path'

// Resolve database path: DATA_DIR/db/custom.db or fallback to ./db/custom.db
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    const raw = process.env.DATABASE_URL.trim();
    if (raw.startsWith('file:./') || raw.startsWith('file:../')) {
      const rel = raw.slice('file:'.length);
      return `file:${path.resolve(process.cwd(), rel)}`;
    }
    return raw;
  }

  const dataDir = process.env.DATA_DIR;
  if (dataDir) {
    const dbDir = path.join(dataDir, 'db');
    // Ensure db directory exists
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    return `file:${path.join(dbDir, 'custom.db')}`;
  }

  return 'file:./db/custom.db';
}

process.env.DATABASE_URL = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Alias export for compatibility with routes that import { prisma }
export const prisma = db

/** 已知的 Prisma/SQLite 连接错误关键词，用于匹配后替换为用户友好消息 */
const KNOWN_DB_ERROR_PATTERNS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /unable to open database file/i,
    message: '系统数据库连接异常，请刷新页面重试，或检查服务器磁盘状态',
  },
  {
    pattern: /SQLITE_BUSY/i,
    message: '数据库暂被占用，请稍后重试',
  },
  {
    pattern: /SQLITE_CORRUPT/i,
    message: '数据库文件损坏，请联系管理员恢复备份',
  },
  {
    pattern: /SQLITE_READONLY/i,
    message: '数据库为只读状态，请检查文件权限',
  },
  {
    pattern: /SQLITE_LOCKED/i,
    message: '数据库被锁定，请稍后重试',
  },
  {
    pattern: /no such table/i,
    message: '数据库结构异常，请运行数据库迁移',
  },
  {
    pattern: /connection timeout|ECONNREFUSED|ENOTFOUND/i,
    message: '数据库服务连接超时，请检查数据库服务状态',
  },
];

/**
 * 将 Prisma 原始错误转换为用户友好的中文消息。
 * - ConnectorError / PrismaClientKnownRequestError 等会被识别并替换
 * - 非数据库错误保持原样返回
 */
export function toUserFriendlyMessage(e: unknown): string {
  if (!e) return '服务器内部错误';

  const rawMessage = e instanceof Error ? e.message : String(e);

  for (const { pattern, message } of KNOWN_DB_ERROR_PATTERNS) {
    if (pattern.test(rawMessage)) {
      console.error('[DB] Matched known error pattern:', pattern.source, 'original:', rawMessage);
      return message;
    }
  }

  // Prisma known request errors with standard codes
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P1001': return '无法连接数据库，请检查数据库服务是否已启动';
      case 'P1003': return '数据库文件不存在，请检查配置路径';
      case 'P1017': return '与数据库的连接已断开，请刷新页面重试';
      case 'P2002': return '数据重复，请检查输入';
      case 'P2025': return '要操作的数据不存在，请刷新后重试';
      default: return '数据处理异常，请刷新重试';
    }
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    return '请求数据格式异常';
  }

  // Fallback to original error for non-database errors
  return rawMessage;
}

/**
 * 验证数据库是否可正常连接。
 * 返回 true 表示连接正常，false 表示异常。
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    return true;
  } catch {
    return false;
  }
}
