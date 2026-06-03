import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db, toUserFriendlyMessage } from '@/lib/db';
import { validateToken } from '@/lib/auth';

/**
 * PUT /api/auth/password — 修改当前用户密码
 *
 * Headers: Authorization: Bearer <token>
 * Request: { oldPassword: string, newPassword: string }
 * Response: { code: 0, data: null, message: '密码修改成功' }
 */
export async function PUT(req: Request) {
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

    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ code: 400, data: null, message: '请输入旧密码和新密码' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ code: 400, data: null, message: '新密码长度不能少于4位' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ code: 404, data: null, message: '用户不存在' }, { status: 404 });
    }

    const isOldPasswordValid = bcrypt.compareSync(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      return NextResponse.json({ code: 401, data: null, message: '旧密码错误' }, { status: 401 });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: newHash, mustChangePwd: false },
    });

    return NextResponse.json({ code: 0, data: null, message: '密码修改成功' });
  } catch (e: unknown) {
    const msg = toUserFriendlyMessage(e);
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
