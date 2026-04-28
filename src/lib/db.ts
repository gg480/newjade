import { PrismaClient } from '@prisma/client'
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
