import { db } from '@/lib/db';

/**
 * Log an operation to the operation_log table.
 * This is a fire-and-forget helper — errors are silently ignored to avoid disrupting business logic.
 */
export async function logAction(
  action: string,
  targetType: string,
  targetId?: number | null,
  detail?: Record<string, unknown> | string | null,
  operator = 'admin',
) {
  try {
    await db.operationLog.create({
      data: {
        action,
        targetType,
        targetId: targetId ?? null,
        detail: detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : null,
        operator,
      },
    });
  } catch {
    // Silently ignore — logging should never break business operations
  }
}

/**
 * 根据请求头 x-user-id 反查操作者用户名
 * @returns 用户名，未认证时返回 'anonymous'
 */
export async function resolveOperator(req: Request): Promise<string> {
  const userId = parseInt(req.headers.get('x-user-id') || '0');
  if (!userId) return 'anonymous';
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    return user?.username ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}
