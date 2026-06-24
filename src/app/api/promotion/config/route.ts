// AI 配置管理 API — 读写 OpenClaw 和百度 API Key
// 使用 guardPermission 守卫（仅管理员可访问）

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import type { AIConfig, UpdateAIConfigRequest } from '@/types/promotion';

/** AI 配置项 key 列表 */
const CONFIG_KEYS = ['openclaw_api_key', 'openclaw_base_url', 'baidu_api_key'] as const;

/** 从 SysConfig 读取 AI 配置 */
async function readAIConfig(): Promise<AIConfig> {
  const configs = await db.sysConfig.findMany({
    where: { key: { in: [...CONFIG_KEYS] } },
  });

  const configMap = new Map(configs.map(c => [c.key, c.value]));

  return {
    openclawApiKey: configMap.get('openclaw_api_key') || '',
    openclawBaseUrl: configMap.get('openclaw_base_url') || 'http://localhost:3000',
    baiduApiKey: configMap.get('baidu_api_key') || '',
  };
}

/** 获取 AI 配置 */
async function configGet(req: Request) {
  // 只有管理员能查看/修改 API Key
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const config = await readAIConfig();
    // 读取最近执行时间
    const executionConfig = await db.sysConfig.findUnique({
      where: { key: 'openclaw_last_execution' },
    });
    // API Key 脱敏：只返回是否已配置，不返回完整值
    return NextResponse.json({
      code: 0,
      data: {
        ...config,
        // 脱敏：已配置时返回掩码，未配置时返回空字符串
        openclawApiKey: config.openclawApiKey
          ? `${config.openclawApiKey.slice(0, 6)}${'•'.repeat(20)}`
          : '',
        baiduApiKey: config.baiduApiKey
          ? `${config.baiduApiKey.slice(0, 4)}${'•'.repeat(20)}`
          : '',
        openclawApiKeyConfigured: !!config.openclawApiKey,
        baiduApiKeyConfigured: !!config.baiduApiKey,
        // OpenClaw 最近执行时间（OpenClaw 回写）
        lastExecutionTime: executionConfig?.value || null,
      },
      message: 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

/** 更新 AI 配置 */
async function configPut(req: Request) {
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const body = (await req.json()) as UpdateAIConfigRequest;

    // 逐个更新配置项（只更新提供的字段）
    const updates: Array<{ key: string; value: string }> = [];
    if (body.openclawApiKey !== undefined) {
      updates.push({ key: 'openclaw_api_key', value: body.openclawApiKey });
    }
    if (body.openclawBaseUrl !== undefined) {
      updates.push({ key: 'openclaw_base_url', value: body.openclawBaseUrl });
    }
    if (body.baiduApiKey !== undefined) {
      updates.push({ key: 'baidu_api_key', value: body.baiduApiKey });
    }

    for (const update of updates) {
      await db.sysConfig.upsert({
        where: { key: update.key },
        update: { value: update.value },
        create: {
          key: update.key,
          value: update.value,
          description: update.key === 'openclaw_api_key'
            ? 'OpenClaw API Key'
            : update.key === 'openclaw_base_url'
              ? 'OpenClaw 服务地址'
              : '百度 API Key',
          valueType: 'string',
          groupName: 'content',
        },
      });
    }

    const config = await readAIConfig();
    // 读取最近执行时间
    const executionConfig = await db.sysConfig.findUnique({
      where: { key: 'openclaw_last_execution' },
    });
    return NextResponse.json({
      code: 0,
      data: {
        ...config,
        openclawApiKey: config.openclawApiKey
          ? `${config.openclawApiKey.slice(0, 6)}${'•'.repeat(20)}`
          : '',
        baiduApiKey: config.baiduApiKey
          ? `${config.baiduApiKey.slice(0, 4)}${'•'.repeat(20)}`
          : '',
        openclawApiKeyConfigured: !!config.openclawApiKey,
        baiduApiKeyConfigured: !!config.baiduApiKey,
        lastExecutionTime: executionConfig?.value || null,
      },
      message: 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('promotion:config:GET', configGet);
export const PUT = withApiLogging('promotion:config:PUT', configPut);
