import { db } from '@/lib/db';
import { ValidationError } from '@/lib/errors';

// ============================================================
// 服务方法
// ============================================================

/**
 * 获取所有系统配置（键值对数组）
 */
export async function getAllConfigs() {
  const configs = await db.sysConfig.findMany();
  return configs;
}

/**
 * 更新或创建系统配置
 * @throws {ValidationError} 缺少 key 或 value 时抛出
 */
export async function updateConfig(key: string, value: string) {
  if (!key || value === undefined) {
    throw new ValidationError('缺少 key 或 value');
  }
  const normalizedKey = String(key).trim();
  const normalizedValue = String(value);

  const config = await db.sysConfig.upsert({
    where: { key: normalizedKey },
    update: { value: normalizedValue },
    create: {
      key: normalizedKey,
      value: normalizedValue,
      description: normalizedKey,
    },
  });

  return config;
}
