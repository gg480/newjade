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
