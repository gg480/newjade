import { db, toUserFriendlyMessage } from '@/lib/db';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 读取容器内版本信息（由 CI 构建时写入）
function getVersionInfo(): Record<string, unknown> {
  try {
    const versionPath = path.join(process.cwd(), 'public', 'version.json');
    if (fs.existsSync(versionPath)) {
      return JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    }
  } catch {
    // 静默失败，返回默认值
  }
  return {
    version: process.env.npm_package_version || 'unknown',
    buildTime: null,
    gitSha: null,
  };
}

export async function GET() {
  try {
    const [itemCount, saleCount] = await Promise.all([
      db.item.count({ where: { isDeleted: false } }),
      db.saleRecord.count(),
    ]);

    return NextResponse.json({
      code: 0,
      data: {
        status: 'ok',
        itemCount,
        saleCount,
        version: getVersionInfo(),
      },
      message: 'ok',
    });
  } catch (e: unknown) {
    const message = toUserFriendlyMessage(e);
    return NextResponse.json({
      code: 500,
      data: { status: 'error' },
      message,
    }, { status: 500 });
  }
}
