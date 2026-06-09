/**
 * 滑动窗口速率限制器
 *
 * 算法：滑动窗口（记录每次请求时间戳到数组，check() 时清理过期条目）
 * 优于固定窗口——无窗口边界双倍流量问题
 *
 * 特性：
 * - 封禁升级：同一 key 1小时内触发3次限流 → 自动封禁1小时
 * - 防内存泄漏：每60秒自动清理过期条目
 */

// ============================================================
// 类型定义
// ============================================================

/** 限流器配置 */
export interface RateLimiterConfig {
  /** 时间窗口（毫秒），如 15 * 60 * 1000 = 15分钟 */
  windowMs: number;
  /** 窗口内最大请求次数 */
  maxAttempts: number;
  /** 限流维度（仅标记用，实际 key 由调用方构造） */
  keyType?: 'ip' | 'userId';
}

/** 限流检查结果 */
export interface RateLimiterResult {
  /** 是否允许本次请求 */
  allowed: boolean;
  /** 窗口内剩余可用次数 */
  remaining: number;
  /** 窗口重置时间，Unix 毫秒时间戳（最早过期条目的时间 + windowMs） */
  resetAt: number;
}

// ============================================================
// 封禁升级常量
// ============================================================

/** 触发封禁的限流次数阈值 */
const BLOCK_TRIGGER_COUNT = 3;

/** 封禁触发观察窗口（1小时） */
const BLOCK_WINDOW_MS = 60 * 60 * 1000;

/** 封禁时长（1小时） */
const BLOCK_DURATION_MS = 60 * 60 * 1000;

/** 定期清理间隔（60秒） */
const CLEANUP_INTERVAL_MS = 60_000;

// ============================================================
// 滑动窗口限流器
// ============================================================

export class SlidingWindowLimiter {
  /** 请求时间戳记录：key → 时间戳数组 */
  private attempts = new Map<string, number[]>();

  /** 封禁名单：key → 封禁到期时间戳(ms) */
  private blockList = new Map<string, number>();

  /** 封禁触发记录：key → 触发时间戳数组（用于判断是否达到 BLOCK_TRIGGER_COUNT） */
  private blockTriggers = new Map<string, number[]>();

  /** 定期清理计时器 ID */
  private cleanupTimerId: ReturnType<typeof setInterval> | null = null;

  constructor(private config: RateLimiterConfig) {
    // 启动定期清理，防止长期运行内存泄漏
    this.cleanupTimerId = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    // Node.js 环境下允许进程退出时自动清理计时器
    if (typeof this.cleanupTimerId === 'object' && 'unref' in this.cleanupTimerId) {
      (this.cleanupTimerId as NodeJS.Timeout).unref();
    }
  }

  // ============================================================
  // 公开方法
  // ============================================================

  /**
   * 检查指定 key 的请求是否允许
   *
   * @param key - 限流标识（如 IP 地址或 userId）
   * @returns 限流结果，含 allowed/remaining/resetAt
   */
  check(key: string): RateLimiterResult {
    const now = Date.now();

    // 1. 检查是否在被封禁状态
    const blockEnd = this.blockList.get(key);
    if (blockEnd !== undefined && now < blockEnd) {
      return { allowed: false, remaining: 0, resetAt: blockEnd };
    }
    // 封禁已过期，清除记录
    if (blockEnd !== undefined) {
      this.blockList.delete(key);
    }

    // 2. 滑动窗口清理：移除窗口外的过期时间戳
    const windowStart = now - this.config.windowMs;
    let timestamps = this.attempts.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    // 3. 判断是否超出限制
    if (timestamps.length >= this.config.maxAttempts) {
      // 记录本次触发（用于封禁升级判断）
      this.recordBlockTrigger(key);
      // resetAt = 最早条目过期时间
      const resetAt = timestamps[0] + this.config.windowMs;
      return { allowed: false, remaining: 0, resetAt };
    }

    // 4. 记录本次请求时间戳
    timestamps.push(now);
    this.attempts.set(key, timestamps);

    // resetAt = 最早条目过期时间
    const resetAt = timestamps[0] + this.config.windowMs;
    return {
      allowed: true,
      remaining: this.config.maxAttempts - timestamps.length,
      resetAt,
    };
  }

  /**
   * 重置指定 key 的计数（如登录成功后调用）
   *
   * @param key - 限流标识
   */
  reset(key: string): void {
    this.attempts.delete(key);
    this.blockTriggers.delete(key);
    // 登录成功也解除封禁
    this.blockList.delete(key);
  }

  /**
   * 清理所有过期条目
   * 由内部计时器每60秒自动调用，也可手动调用
   */
  cleanup(): void {
    const now = Date.now();

    // 清理过期的时间戳记录
    for (const [key, timestamps] of this.attempts) {
      const windowStart = now - this.config.windowMs;
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, active);
      }
    }

    // 清理过期的封禁记录
    for (const [key, blockEnd] of this.blockList) {
      if (now >= blockEnd) {
        this.blockList.delete(key);
      }
    }

    // 清理过期的封禁触发记录
    for (const [key, triggers] of this.blockTriggers) {
      const windowStart = now - BLOCK_WINDOW_MS;
      const active = triggers.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.blockTriggers.delete(key);
      } else {
        this.blockTriggers.set(key, active);
      }
    }
  }

  /**
   * 销毁限流器，停止内部清理计时器
   * 调用后此实例不应再使用
   */
  destroy(): void {
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }
    this.attempts.clear();
    this.blockList.clear();
    this.blockTriggers.clear();
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /**
   * 记录一次限流触发，用于封禁升级判断
   * 同一 key 在 BLOCK_WINDOW_MS 内触发 BLOCK_TRIGGER_COUNT 次 → 自动封禁
   */
  private recordBlockTrigger(key: string): void {
    const now = Date.now();
    const windowStart = now - BLOCK_WINDOW_MS;

    // 滑动窗口清理过期的触发记录
    let triggers = this.blockTriggers.get(key) || [];
    triggers = triggers.filter((t) => t > windowStart);

    // 记录本次触发
    triggers.push(now);

    // 判断是否达到封禁阈值
    if (triggers.length >= BLOCK_TRIGGER_COUNT) {
      // 封禁该 key
      this.blockList.set(key, now + BLOCK_DURATION_MS);
      // 封禁后清除触发记录，避免重复封禁
      this.blockTriggers.delete(key);

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[RateLimiter] ${key} 在 ${BLOCK_WINDOW_MS / 60000}分钟内触发 ${triggers.length} 次限流，已封禁 ${BLOCK_DURATION_MS / 60000} 分钟`
        );
      }
    } else {
      this.blockTriggers.set(key, triggers);
    }
  }
}

// ============================================================
// 预配置实例
// ============================================================

/** 全局限流器：500次/分钟/IP，用于 middleware 全局限流 */
export const globalLimiter = new SlidingWindowLimiter({
  windowMs: 60_000,
  maxAttempts: 500,
  keyType: 'ip',
});

/**
 * 工厂函数：创建一个新的滑动窗口限流器实例
 */
export function createLimiter(config: RateLimiterConfig): SlidingWindowLimiter {
  return new SlidingWindowLimiter(config);
}
