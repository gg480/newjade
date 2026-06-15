// RBAC 权限守卫 — 为 API 路由提供统一的权限检查
// 使用方式：在 route handler 开头调用 guardPermission(req, 'action:xxx')
//   若返回非 null → 直接 return 该响应（表示拒绝）
//   若返回 null → 继续执行后续逻辑

import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/auth';

/**
 * 检查当前请求用户是否拥有指定权限
 * @returns null 表示允许通过，NextResponse 表示拒绝（直接 return 即可）
 */
export async function guardPermission(
  req: Request,
  permission: string,
): Promise<NextResponse | null> {
  const userId = parseInt(req.headers.get('x-user-id') || '0');
  if (!userId) {
    return NextResponse.json(
      { code: 401, data: null, message: '未认证' },
      { status: 401 },
    );
  }

  const permitted = await hasPermission(userId, permission);
  if (!permitted) {
    return NextResponse.json(
      { code: 403, data: null, message: '无权限执行此操作' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * 安全错误消息：生产环境脱敏，开发环境保留详细信息
 */
export function safeErrorMessage(e: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    return '服务器内部错误';
  }
  return e instanceof Error ? e.message : String(e);
}
