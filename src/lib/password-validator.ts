/**
 * 密码复杂度校验工具
 *
 * 校验顺序（时序安全）：
 *   ① 新旧密码同值检查（如提供旧密码）
 *   ② 复杂度规则检查
 *   ③ bcrypt 比对（由调用方执行，本模块不处理）
 *
 * 错误信息脱敏：对外只返回"密码不符合安全策略要求"，内部控制台打印详细原因。
 */

/** 密码复杂度策略 */
export interface PasswordPolicy {
  /** 最小长度，默认 8 */
  minLength: number;
  /** 要求至少一个大写字母 */
  requireUppercase: boolean;
  /** 要求至少一个小写字母 */
  requireLowercase: boolean;
  /** 要求至少一个数字 */
  requireDigit: boolean;
  /** 要求至少一个特殊字符 */
  requireSpecialChar: boolean;
  /** 密码不得包含用户名 */
  notAllowUsername: boolean;
}

/** 校验结果 */
export interface PasswordValidationResult {
  valid: boolean;
  /** 内部详细错误原因（不对外暴露） */
  errors: string[];
}

/** 默认安全策略 —— 硬编码兜底，不依赖外部配置 */
export const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecialChar: true,
  notAllowUsername: true,
};

/** 特殊字符集合 */
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

/**
 * 校验密码是否符合复杂度策略
 *
 * @param password 待校验的密码（明文）
 * @param policy 密码策略，不传则使用 DEFAULT_POLICY
 * @param username 用户名（用于 notAllowUsername 检查）
 * @returns 校验结果 — valid 表示通过，errors 列出所有不满足的规则（内部使用）
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_POLICY,
  username?: string,
): PasswordValidationResult {
  const errors: string[] = [];
  const effectivePolicy = policy;

  // 长度检查
  if (password.length < effectivePolicy.minLength) {
    errors.push(`密码长度不足，至少需要 ${effectivePolicy.minLength} 位`);
  }

  // 大写字母检查
  if (effectivePolicy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码需要至少包含一个大写字母');
  }

  // 小写字母检查
  if (effectivePolicy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码需要至少包含一个小写字母');
  }

  // 数字检查
  if (effectivePolicy.requireDigit && !/[0-9]/.test(password)) {
    errors.push('密码需要至少包含一个数字');
  }

  // 特殊字符检查
  if (effectivePolicy.requireSpecialChar && !SPECIAL_CHARS.test(password)) {
    errors.push('密码需要至少包含一个特殊字符');
  }

  // 用户名检查
  if (
    effectivePolicy.notAllowUsername &&
    username &&
    username.length > 0 &&
    password.toLowerCase().includes(username.toLowerCase())
  ) {
    errors.push('密码不能包含用户名');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 检查新旧密码是否相同
 *
 * @returns true 表示新旧密码相同（应拒绝），false 表示不同（可继续）
 */
export function isSameAsOldPassword(
  newPassword: string,
  oldPassword: string,
): boolean {
  return newPassword === oldPassword;
}

/**
 * 统一的密码校验入口 —— 合并新旧密码检查 + 复杂度检查
 *
 * 时序安全：先检查新旧密码是否相同 → 再检查复杂度规则
 * bcrypt 比对由调用方自行执行（本模块不涉及哈希操作）。
 *
 * @param newPassword 新密码（明文）
 * @param oldPassword 旧密码（明文，可选）
 * @param policy 密码策略，不传则使用默认策略
 * @param username 用户名（用于 notAllowUsername 检查）
 * @returns 校验结果
 */
export function validateNewPassword(
  newPassword: string,
  oldPassword?: string,
  policy: PasswordPolicy = DEFAULT_POLICY,
  username?: string,
): PasswordValidationResult {
  const errors: string[] = [];

  // ① 新旧密码同值检查（时序安全优先）
  if (oldPassword !== undefined && isSameAsOldPassword(newPassword, oldPassword)) {
    errors.push('新密码不能与旧密码相同');
  }

  // ② 复杂度规则检查
  const complexityResult = validatePassword(newPassword, policy, username);
  errors.push(...complexityResult.errors);

  return { valid: errors.length === 0, errors };
}

/**
 * 对外统一错误信息 —— 脱敏处理
 *
 * 外部 API 返回给客户端时，只用此通用消息，不暴露内部细节。
 * 详细原因通过 console.log 在服务端输出。
 */
export const EXTERNAL_ERROR_MESSAGE = '密码不符合安全策略要求';

/**
 * 预留：从 SysConfig 读取 password_policy JSON 并合并到默认策略
 *
 * 本次仅定义签名和返回值。S11-06 集成时实现实际 DB 查询。
 *
 * @returns 合并后的策略（SysConfig 值覆盖默认值）
 */
export async function getPasswordPolicyFromConfig(): Promise<PasswordPolicy> {
  // TODO: S11-06 集成 — 从 SysConfig 读取 password_policy JSON
  // const configService = await import('./config-service');
  // const config = await configService.getConfigValue('password_policy');
  // if (config) {
  //   const parsed = JSON.parse(config) as Partial<PasswordPolicy>;
  //   return { ...DEFAULT_POLICY, ...parsed };
  // }
  return { ...DEFAULT_POLICY };
}

/**
 * 在服务端打印校验失败的详细原因（仅非生产环境或始终打印，按需调整）
 *
 * @param context 上下文信息，如 { userId, ip }
 * @param result 校验结果
 */
export function logValidationFailure(
  context: Record<string, unknown>,
  result: PasswordValidationResult,
): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[PasswordValidator] Validation failed', {
      ...context,
      reasons: result.errors,
    });
  }
}
