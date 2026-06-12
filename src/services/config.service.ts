import { db } from '@/lib/db';
import { ValidationError } from '@/lib/errors';
import { configEventBus } from '@/lib/config-events';

// ============================================================
// 服务方法
// ============================================================

/** 默认配置定义：用于自动补全缺失的配置项 */
const DEFAULT_CONFIGS: Array<{ key: string; value: string; description: string; valueType: string; groupName: string }> = [
  { key: 'store_name', value: '翡翠珠宝', description: '店铺名称', valueType: 'string', groupName: 'system' },
  { key: 'warning_days', value: '90', description: '压货预警天数', valueType: 'number', groupName: 'system' },
  { key: 'currency_symbol', value: '¥', description: '默认货币符号', valueType: 'string', groupName: 'system' },
  { key: 'profit_warning_threshold', value: '30', description: '利润预警阈值(%)', valueType: 'number', groupName: 'system' },
  { key: 'default_profit_rate', value: '40', description: '默认利润率(%)', valueType: 'number', groupName: 'pricing' },
  { key: 'operating_cost_rate', value: '0.05', description: '经营成本率', valueType: 'number', groupName: 'system' },
  { key: 'markup_rate', value: '0.30', description: '零售价上浮比例', valueType: 'number', groupName: 'pricing' },
  { key: 'aging_threshold_days', value: '90', description: '压货预警天数(旧)', valueType: 'number', groupName: 'system' },
  { key: 'default_alloc_method', value: 'equal', description: '默认分摊算法', valueType: 'string', groupName: 'system' },
  { key: 'feature_checkout_enabled', value: 'true', description: '是否启用收银台模式', valueType: 'string', groupName: 'system' },
];

/**
 * 获取所有系统配置（键值对数组）
 * 自动补全缺失的默认配置项
 */
export async function getAllConfigs() {
  const configs = await db.sysConfig.findMany();
  const existingKeys = new Set(configs.map(c => c.key));

  // 自动补全缺失的默认配置项
  const missingDefaults = DEFAULT_CONFIGS.filter(d => !existingKeys.has(d.key));
  for (const d of missingDefaults) {
    const created = await db.sysConfig.create({
      data: { key: d.key, value: d.value, description: d.description, valueType: d.valueType, groupName: d.groupName },
    });
    configs.push(created);
  }

  return configs;
}

/**
 * 配置元数据映射（与 DEFAULT_CONFIGS 对齐）
 * 用于运行时类型校验和范围校验
 */
const CONFIG_META: Record<string, { valueType: string; min?: number; max?: number }> = {
  operating_cost_rate: { valueType: 'number', min: 0, max: 1 },
  markup_rate: { valueType: 'number', min: 0, max: 5 },
  aging_threshold_days: { valueType: 'number', min: 1, max: 3650 },
  warning_days: { valueType: 'number', min: 1, max: 3650 },
  profit_warning_threshold: { valueType: 'number', min: 0, max: 100 },
  default_profit_rate: { valueType: 'number', min: 0, max: 1000 },
  store_name: { valueType: 'string' },
  currency_symbol: { valueType: 'string' },
  default_alloc_method: { valueType: 'string' },
  tanshu_api_key: { valueType: 'string' },
  feature_checkout_enabled: { valueType: 'string' },
};

/**
 * 校验配置值是否符合类型和范围约束
 * @throws {ValidationError} 校验失败时抛出
 */
function validateConfigValue(key: string, value: string): void {
  const meta = CONFIG_META[key];
  if (!meta) return; // 未知配置项不做校验

  if (meta.valueType === 'number') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new ValidationError(`配置 "${key}" 需要数字类型`);
    }
    if (meta.min !== undefined && num < meta.min) {
      throw new ValidationError(`配置 "${key}" 不能小于 ${meta.min}`);
    }
    if (meta.max !== undefined && num > meta.max) {
      throw new ValidationError(`配置 "${key}" 不能大于 ${meta.max}`);
    }
  }
}

/**
 * 更新或创建系统配置
 * @throws {ValidationError} 缺少 key 或 value，或类型校验不通过时抛出
 */
export async function updateConfig(key: string, value: string) {
  if (!key || value === undefined) {
    throw new ValidationError('缺少 key 或 value');
  }
  const normalizedKey = String(key).trim();
  const normalizedValue = String(value);

  // 类型校验
  validateConfigValue(normalizedKey, normalizedValue);

  // 查询旧值，用于事件通知
  const oldConfig = await db.sysConfig.findUnique({ where: { key: normalizedKey } });
  const oldValue = oldConfig?.value;

  const config = await db.sysConfig.upsert({
    where: { key: normalizedKey },
    update: { value: normalizedValue },
    create: {
      key: normalizedKey,
      value: normalizedValue,
      description: normalizedKey,
    },
  });

  // 通知配置变更（仅在值实际变化时触发）
  if (oldValue !== normalizedValue) {
    configEventBus.emit(normalizedKey, normalizedValue, oldValue);
  }

  return config;
}
