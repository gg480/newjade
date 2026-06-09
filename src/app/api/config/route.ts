import { NextResponse } from 'next/server';
import * as configService from '@/services/config.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { db } from '@/lib/db';
import { logAction } from '@/lib/log';

// 敏感配置键：审计日志中值脱敏为 ****
const SENSITIVE_KEYS = ['tanshu_api_key'];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.includes(key);
}

/** 根据 x-user-id 反查用户名，未认证时返回 'anonymous' */
async function resolveOperator(req: Request): Promise<string> {
  const userId = parseInt(req.headers.get('x-user-id') || '0');
  if (!userId) return 'anonymous';
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    return user?.username ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

async function configGET() {
  const configs = await configService.getAllConfigs();
  return NextResponse.json({ code: 0, data: configs, message: 'ok' });
}

async function configPUT(req: Request) {
  const { key, value } = await req.json();

  // 更新前查旧值（用于审计日志）
  const oldConfig = await db.sysConfig.findUnique({ where: { key } });

  const config = await configService.updateConfig(key, value);

  // 写入配置变更审计日志（静默失败，不阻塞主流程）
  await logAction('update_config', 'config', null, JSON.stringify({
    key,
    oldValue: isSensitiveKey(key) ? '****' : (oldConfig?.value ?? null),
    newValue: isSensitiveKey(key) ? '****' : value,
  }), await resolveOperator(req));

  return NextResponse.json({ code: 0, data: config, message: 'ok' });
}

export const GET = withApiLogging('config:GET', configGET);
export const PUT = withApiLogging('config:PUT', configPUT);
