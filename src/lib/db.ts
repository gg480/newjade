import { PrismaClient } from '@prisma/client'
import { mkdirSync, existsSync } from 'fs'
import path from 'path'

// Resolve database path with Prisma path normalization.
// Prisma CLI resolves "file:./db/custom.db" relative to prisma/schema.prisma dir,
// so the actual DB file ends up at prisma/db/custom.db, not ./db/custom.db.
// Next.js runtime resolves relative to CWD (project root), so we need to fix the path.
function resolveDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL;

  if (rawUrl) {
    // If DATABASE_URL is set, check if the file actually exists at the raw path.
    // If not, check if Prisma created it under prisma/ directory instead.
    const rawPath = rawUrl.replace(/^file:/, '');
    const absRawPath = path.resolve(process.cwd(), rawPath);
    if (existsSync(absRawPath)) {
      return rawUrl;
    }
    // Prisma likely placed it relative to schema dir
    const prismaPath = path.resolve(process.cwd(), 'prisma', rawPath);
    if (existsSync(prismaPath)) {
      return `file:${prismaPath}`;
    }
    // Neither exists — ensure directory for raw path and let Prisma create it
    const dbDir = path.dirname(absRawPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    return rawUrl;
  }

  const dataDir = process.env.DATA_DIR;
  if (dataDir) {
    const dbDir = path.join(dataDir, 'db');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    return `file:${path.join(dbDir, 'custom.db')}`;
  }

  // Fallback: try prisma/db first, then ./db
  const prismaFallback = path.resolve(process.cwd(), 'prisma', 'db', 'custom.db');
  if (existsSync(prismaFallback)) {
    return `file:${prismaFallback}`;
  }
  const rootFallback = path.resolve(process.cwd(), 'db', 'custom.db');
  const dbDir = path.dirname(rootFallback);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
  return `file:${rootFallback}`;
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
