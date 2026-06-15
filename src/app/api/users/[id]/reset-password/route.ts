import { NextResponse } from 'next/server';
import { resetUserPassword } from '@/services/user.service';
import { AppError } from '@/lib/errors';
import { createLimiter } from '@/lib/rate-limiter';
import { logAction } from '@/lib/log';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';

/**
 * PUT /api/users/:id/reset-password — 管理员重置用户密码
 *
 * 校验顺序：
 *   ① 参数校验 → ② 速率限制 → ③ 调用 service 层
 *
 * 与旧版 PATCH /api/users/:id?action=reset-password 功能一致，
 * 新增独立路由供前端统一调用。
 */

// 重置密码限流：每 IP 30分钟最多5次
const resetPasswordLimiter = createLimiter({
  windowMs: 30 * 60 * 1000,
  maxAttempts: 5,
  keyType: 'ip',
});

/** 获取请求来源 IP */
function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  // 权限检查：只有拥有 user_manage 权限的用户才能重置他人密码
  const denied = await guardPermission(req, 'action:user_manage');
  if (denied) return denied;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的用户ID' }, { status: 400 });
    }

    // ① 参数校验
    const body = await req.json();
    if (!body.newPassword || typeof body.newPassword !== 'string' || body.newPassword.trim().length === 0) {
      return NextResponse.json({ code: 400, data: null, message: '请输入新密码' }, { status: 400 });
    }

    // ② 速率限制检查
    const ip = getClientIP(req);
    const limitResult = resetPasswordLimiter.check(ip);
    if (!limitResult.allowed) {
      return NextResponse.json(
        { code: 429, data: null, message: '请求过于频繁，请稍后再试' },
        { status: 429 },
      );
    }

    // ③ 调用 service 层（含密码复杂度校验 + bcrypt 哈希 + 更新数据库）
    await resetUserPassword(id, body.newPassword.trim());

    // ④ 写入审计日志（静默失败，不阻塞主流程）
    const operator = req.headers.get('x-user-name') || 'unknown';
    await logAction(
      'reset_password',
      'user',
      id,
      JSON.stringify({ operator, targetUserId: id }),
      operator,
    );

    return NextResponse.json({ code: 0, data: null, message: '密码重置成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = safeErrorMessage(e);
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
