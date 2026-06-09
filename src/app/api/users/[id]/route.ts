import { NextResponse } from 'next/server';
import { getUser, updateUser, deleteUser, updateUserRole, resetUserPassword } from '@/services/user.service';
import { AppError } from '@/lib/errors';
import { createLimiter } from '@/lib/rate-limiter';

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

/**
 * GET /api/users/:id — 用户详情
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的用户ID' }, { status: 400 });
    }

    const user = await getUser(id);
    return NextResponse.json({ code: 0, data: user, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * PUT /api/users/:id — 编辑用户（displayName/roleId/isActive）
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的用户ID' }, { status: 400 });
    }

    const body = await req.json();
    const { displayName, roleId, isActive } = body;

    const user = await updateUser(id, { displayName, roleId, isActive });
    return NextResponse.json({ code: 0, data: user, message: '用户更新成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/users/:id — 禁用/启用用户（切换 isActive）
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的用户ID' }, { status: 400 });
    }

    // 从请求头获取当前用户 ID（由 middleware 注入）
    const currentUserId = parseInt(req.headers.get('x-user-id') || '0');

    await deleteUser(id, currentUserId);
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/users/:id — 扩展方法路由
 * action=role：修改角色
 * action=reset-password：重置密码
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的用户ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'role') {
      const body = await req.json();
      await updateUserRole(id, body.roleId);
      return NextResponse.json({ code: 0, data: null, message: '角色修改成功' });
    }

    if (action === 'reset-password') {
      // 速率限制检查
      const ip = getClientIP(req);
      const limitResult = resetPasswordLimiter.check(ip);
      if (!limitResult.allowed) {
        return NextResponse.json(
          { code: 429, data: null, message: '请求过于频繁，请稍后再试' },
          { status: 429 },
        );
      }

      const body = await req.json();
      await resetUserPassword(id, body.newPassword);
      return NextResponse.json({ code: 0, data: null, message: '密码重置成功' });
    }

    return NextResponse.json({ code: 400, data: null, message: '未知操作' }, { status: 400 });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
