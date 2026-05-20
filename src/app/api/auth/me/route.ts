import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateToken } from '@/lib/auth';
import { parsePermissions } from '@/lib/auth';

/**
 * GET /api/auth/me — 获取当前用户信息（含权限列表）
 *
 * Headers: Authorization: Bearer <token>
 * Response: { code: 0, data: { id, username, displayName, roleId, roleName, permissions, mustChangePwd } }
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ code: 401, data: null, message: '未登录' }, { status: 401 });
    }

    const session = await validateToken(token);
    if (!session || !session.valid || !session.userId) {
      return NextResponse.json({ code: 401, data: null, message: '会话已过期或无效' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ code: 401, data: null, message: '用户不存在或已被禁用' }, { status: 401 });
    }

    const permissions = user.role ? parsePermissions(user.role.permissions) : [];

    return NextResponse.json({
      code: 0,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName ?? '',
        roleId: user.roleId ?? 0,
        roleName: user.role?.name ?? '',
        permissions,
        mustChangePwd: user.mustChangePwd,
      },
      message: 'ok',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
