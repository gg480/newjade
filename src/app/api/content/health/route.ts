// 健康检查端点 — OpenClaw 轮询检查 ERP 可用性
// 使用 guardOpenClawAPI 守卫

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardOpenClawAPI } from '@/lib/api/permission-guard';

async function contentHealthGet(req: Request) {
  const denied = guardOpenClawAPI(req);
  if (denied) return denied;

  // 检查 OpenClaw 是否已启用（配置了 API Key）
  let openclawEnabled = false;
  try {
    const config = await db.sysConfig.findUnique({
      where: { key: 'openclaw_api_key' },
    });
    openclawEnabled = !!(config && config.value);
  } catch {
    // 数据库错误时降级为 disabled
  }

  return NextResponse.json({
    code: 0,
    data: {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      openclawEnabled,
      version: '1.0.0',
    },
    message: 'ok',
  });
}

export const GET = withApiLogging('content:health:GET', contentHealthGet);
