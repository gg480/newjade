#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { apply: false, limit: 20 };
  for (const raw of argv) {
    if (raw === '--apply') args.apply = true;
    if (raw.startsWith('--limit=')) {
      const n = parseInt(raw.split('=')[1], 10);
      if (!Number.isNaN(n) && n >= 0) args.limit = n;
    }
  }
  return args;
}

function loadDatabaseUrlFromDotenv(projectRoot) {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === 'DATABASE_URL' && value) {
      process.env.DATABASE_URL = value;
      return;
    }
  }
}

function normalizeSaleDate(rawInput) {
  if (rawInput === null || rawInput === undefined) return { normalized: null, reason: 'empty' };
  const raw = String(rawInput).trim();
  if (!raw) return { normalized: null, reason: 'empty' };

  // Strict date separators: 2026-4-2 / 2026/4/2 / 2026.4.2 / 2026年4月2日
  const normalized = raw
    .replace(/[年./]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '');
  const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return { normalized: null, reason: 'invalid_ymd' };
    return {
      normalized: `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      reason: 'ymd',
    };
  }

  // Excel serial date
  if (/^\d{5}$/.test(raw)) {
    const serial = parseInt(raw, 10);
    if (serial > 20000 && serial < 100000) {
      const base = new Date(Date.UTC(1899, 11, 30));
      const dt = new Date(base.getTime() + serial * 86400000);
      return {
        normalized: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
        reason: 'excel_serial',
      };
    }
  }

  // Unknown format: do not force-convert to avoid accidental corruption.
  return { normalized: null, reason: 'unrecognized' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  loadDatabaseUrlFromDotenv(projectRoot);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 未设置，且 .env 中未找到');
  }

  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();

  try {
    const records = await db.saleRecord.findMany({
      select: { id: true, saleNo: true, saleDate: true },
      orderBy: { id: 'asc' },
    });

    let alreadyGood = 0;
    let convertible = 0;
    let invalid = 0;
    let needsChange = 0;
    const changeSamples = [];
    const invalidSamples = [];

    for (const r of records) {
      const { normalized, reason } = normalizeSaleDate(r.saleDate);
      const current = String(r.saleDate || '').trim();
      const isAlreadyStandard = /^\d{4}-\d{2}-\d{2}$/.test(current);
      if (isAlreadyStandard) alreadyGood++;

      if (normalized) {
        convertible++;
        if (normalized !== current) {
          needsChange++;
          if (changeSamples.length < args.limit) {
            changeSamples.push({ id: r.id, saleNo: r.saleNo, from: current, to: normalized, reason });
          }
        }
      } else {
        invalid++;
        if (invalidSamples.length < args.limit) {
          invalidSamples.push({ id: r.id, saleNo: r.saleNo, raw: current, reason });
        }
      }
    }

    console.log('=== saleDate 清洗预检查 ===');
    console.log(`DATABASE_URL=${process.env.DATABASE_URL}`);
    console.log(`总记录: ${records.length}`);
    console.log(`已标准(YYYY-MM-DD): ${alreadyGood}`);
    console.log(`可识别日期: ${convertible}`);
    console.log(`需修改条数: ${needsChange}`);
    console.log(`无法识别条数: ${invalid}`);
    console.log('');
    console.log(`需修改样例(最多${args.limit}条):`);
    console.log(JSON.stringify(changeSamples, null, 2));
    console.log('');
    console.log(`无法识别样例(最多${args.limit}条):`);
    console.log(JSON.stringify(invalidSamples, null, 2));

    if (!args.apply) {
      console.log('');
      console.log('当前为检查模式（未写入数据库）。');
      console.log('确认后执行: node scripts/normalize-sale-date.js --apply');
      return;
    }

    if (needsChange === 0) {
      console.log('');
      console.log('无需修改，退出。');
      return;
    }

    await db.$transaction(async (tx) => {
      for (const r of records) {
        const current = String(r.saleDate || '').trim();
        const { normalized } = normalizeSaleDate(current);
        if (!normalized || normalized === current) continue;
        await tx.saleRecord.update({
          where: { id: r.id },
          data: { saleDate: normalized },
        });
      }
    });

    console.log('');
    console.log(`已完成写入，更新 ${needsChange} 条 saleDate。`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});
