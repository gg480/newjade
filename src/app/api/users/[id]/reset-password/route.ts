import { NextResponse } from 'next/server';
import { resetUserPassword } from '@/services/user.service';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';
import { logAction } from '@/lib/log';
import {
  validatePassword,
  EXTERNAL_ERROR_MESSAGE,
  logValidationFailure,
} from '@/lib/password-validator';

/**
 * PUT /api/users/:id/reset-password — 管理员重置用户密码
 *
 * 调用 resetUserPassword service（bcrypt 哈希 + 设置 mustChangePwd=true）
 * 前置校验：密码复杂度（8位+大小写+数字+特殊字符），失败信息脱敏
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { code: 400, data: null, message: '无效的用户ID' },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { code: 400, data: null, message: '请提供新密码' },
        { status: 400 },
      );
    }

    // 密码复杂度校验（对外脱敏，内部控制台打印详细原因）
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      logValidationFailure({ userId: id }, validation);
      return NextResponse.json(
        { code: 400, data: null, message: EXTERNAL_ERROR_MESSAGE },
        { status: 400 },
      );
    }

    await resetUserPassword(id, newPassword.trim());

    // 写入审计日志（静默失败，不阻塞主流程）
    try {
      const adminUserId = parseInt(req.headers.get('x-user-id') || '0');
      const adminUser = adminUserId > 0
        ? await db.user.findUnique({ where: { id: adminUserId }, select: { username: true } })
        : null;
      const adminUsername = adminUser?.username || 'unknown';
      await logAction(
        'reset_password',
        'user',
        id,
        JSON.stringify({ operator: adminUsername, operatorId: adminUserId }),
        adminUsername,
      );
    } catch {
      // 审计日志写入失败不阻塞主流程
    }

    return NextResponse.json({
      code: 0,
      data: null,
      message: '密码重置成功',
    });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { code: e.code, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json(
      { code: 500, data: null, message: msg },
      { status: 500 },
    );
  }
}
