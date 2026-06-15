import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db, toUserFriendlyMessage } from '@/lib/db';
import { validateToken } from '@/lib/auth';
import { validatePassword, EXTERNAL_ERROR_MESSAGE } from '@/lib/password-validator';
import { SlidingWindowLimiter } from '@/lib/rate-limiter';
import { logAction } from '@/lib/log';

/**
 * PUT /api/auth/password — 修改当前用户密码
 *
 * Headers: Authorization: Bearer <token>
 * Request: { oldPassword: string, newPassword: string }
 * Response: { code: 0, data: null, message: '密码修改成功' }
 *
 * 校验顺序（时序安全）：
 *   ① 认证检查 → ② 参数非空 → ③ 新旧密码相同检查 → ④ 复杂度校验
 *   → ⑤ 速率限制 → ⑥ 查找用户 → ⑦ bcrypt 比对 → ⑧ 更新数据库
 */

// 密码修改限流：同一用户 15 分钟内最多 10 次
const passwordChangeLimiter = new SlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  keyType: 'userId',
});

export async function PUT(req: Request) {
  try {
    // ① 认证检查
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ code: 401, data: null, message: '未登录' }, { status: 401 });
    }

    const session = await validateToken(token);
    if (!session || !session.valid || !session.userId) {
      return NextResponse.json({ code: 401, data: null, message: '会话已过期或无效' }, { status: 401 });
    }

    // ② 参数非空检查
    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ code: 400, data: null, message: '请输入旧密码和新密码' }, { status: 400 });
    }

    // ③ 新旧密码相同检查（时序安全：在 bcrypt.compare 之前）
    if (oldPassword === newPassword) {
      return NextResponse.json({ code: 400, data: null, message: '新密码不能与旧密码相同' }, { status: 400 });
    }

    // ④ 密码复杂度校验
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      // 服务端打印详细原因，对外只返回脱敏消息
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PasswordValidator] Validation failed for user', session.userId, {
          reasons: validation.errors,
        });
      }
      return NextResponse.json(
        { code: 400, data: null, message: EXTERNAL_ERROR_MESSAGE },
        { status: 400 },
      );
    }

    // ⑤ 速率限制检查（按 userId）
    const rateLimitKey = String(session.userId);
    const rateLimitResult = passwordChangeLimiter.check(rateLimitKey);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { code: 429, data: null, message: '请求过于频繁，请稍后再试' },
        { status: 429 },
      );
    }

    // ⑥ 查找用户
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ code: 404, data: null, message: '用户不存在' }, { status: 404 });
    }

    // ⑦ 旧密码比对
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      return NextResponse.json({ code: 401, data: null, message: '旧密码错误' }, { status: 401 });
    }

    // ⑧ 更新数据库
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: newHash, mustChangePwd: false },
    });

    // 成功后重置限流计数
    passwordChangeLimiter.reset(rateLimitKey);

    // 写入审计日志（静默失败，不阻塞主流程）
    await logAction(
      'change_password',
      'user',
      session.userId,
      JSON.stringify({ operator: user.username, operatorId: session.userId }),
      user.username,
    );

    return NextResponse.json({ code: 0, data: null, message: '密码修改成功' });
  } catch (e: unknown) {
    const msg = toUserFriendlyMessage(e);
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
