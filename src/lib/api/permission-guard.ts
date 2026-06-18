// RBAC 权限守卫 — 为 API 路由提供统一的权限检查
// 使用方式：在 route handler 开头调用 guardPermission(req, 'action:xxx')
//   若返回非 null → 直接 return 该响应（表示拒绝）
//   若返回 null → 继续执行后续逻辑
//
// 双 Token 认证支持：
//   - x-auth-type: session → 用户会话，走 RBAC 权限检查
//   - x-auth-type: openclaw → OpenClaw 系统调用，走 guardOpenClawAPI 守卫

import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/auth';

/**
 * 检查当前请求用户是否拥有指定权限
 * OpenClaw 调用（x-auth-type: openclaw）会被拒绝，只能通过 guardOpenClawAPI 访问白名单端点
 * @returns null 表示允许通过，NextResponse 表示拒绝（直接 return 即可）
 */
export async function guardPermission(
  req: Request,
  permission: string,
): Promise<NextResponse | null> {
  const authType = req.headers.get('x-auth-type');

  // OpenClaw 系统调用不能访问用户权限端点
  if (authType === 'openclaw') {
    return NextResponse.json(
      { code: 403, data: null, message: 'OpenClaw API Key 无权访问此端点' },
      { status: 403 },
    );
  }

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
 * OpenClaw API 守卫 — 只允许 OpenClaw API Key 调用
 * 用于 OpenClaw 专用回写端点（如 POST /api/content/topics）
 * @returns null 表示允许通过，NextResponse 表示拒绝
 */
export function guardOpenClawAPI(req: Request): NextResponse | null {
  const authType = req.headers.get('x-auth-type');

  if (authType !== 'openclaw') {
    return NextResponse.json(
      { code: 403, data: null, message: '此端点仅限 OpenClaw API Key 调用' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * 混合守卫 — 允许用户会话或 OpenClaw API Key 调用
 * 用于两端共享端点（如 /api/promotion/metrics 反馈录入）
 * - OpenClaw 调用：直接放行
 * - 用户调用：检查指定权限
 * @returns null 表示允许通过，NextResponse 表示拒绝
 */
export async function guardPermissionOrOpenClaw(
  req: Request,
  permission: string,
): Promise<NextResponse | null> {
  const authType = req.headers.get('x-auth-type');

  // OpenClaw 调用直接放行
  if (authType === 'openclaw') {
    return null;
  }

  // 用户调用走权限检查
  return guardPermission(req, permission);
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
