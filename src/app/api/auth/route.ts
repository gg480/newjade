/**
 * 向后兼容的 auth 路由
 *
 * 新端点已迁移到独立子路由：
 *   POST /api/auth/login   → src/app/api/auth/login/route.ts
 *   GET  /api/auth/me      → src/app/api/auth/me/route.ts
 *   POST /api/auth/logout  → src/app/api/auth/logout/route.ts
 *   PUT  /api/auth/password → src/app/api/auth/password/route.ts
 *
 * 本文件保留支持旧版前端发送的请求：
 *   POST /api/auth — 旧版单密码登录（仅接受 { password } 但不推荐）
 *   PUT  /api/auth — 旧版密码修改
 *   GET  /api/auth — 旧版 session 检查
 *   DELETE /api/auth — 旧版登出
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { createSession, validateToken, deleteSession } from '@/lib/auth';

const DEFAULT_PASSWORD = 'admin123';

// In-memory rate limiting
const loginAttempts = new Map<string, { count: number; firstAttemptTime: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         'unknown';
}

function isRateLimited(ip: string): boolean {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const record = loginAttempts.get(ip);
  const now = Date.now();
  if (!record || (now - record.firstAttemptTime) > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttemptTime: now });
  } else {
    record.count += 1;
  }
}

function resetAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// POST /api/auth — 旧版兼容：支持 { password } 单密码登录（优先匹配 admin 用户）
// 也支持 { username, password } 新格式
export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { code: 429, data: null, message: '登录尝试过多，请15分钟后再试' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { password, username } = body;

    // 新格式：username + password
    if (username && password) {
      const user = await db.user.findUnique({
        where: { username: username.trim() },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        recordFailedAttempt(clientIp);
        return NextResponse.json({ code: 401, data: null, message: '用户名或密码错误' }, { status: 401 });
      }

      const isValid = bcrypt.compareSync(password, user.passwordHash);
      if (!isValid) {
        recordFailedAttempt(clientIp);
        return NextResponse.json({ code: 401, data: null, message: '用户名或密码错误' }, { status: 401 });
      }

      resetAttempts(clientIp);
      const token = await createSession(user.id);

      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const permissions: string[] = user.role ? JSON.parse(user.role.permissions) : [];

      return NextResponse.json({
        code: 0,
        data: {
          token,
          expiresIn: 604800,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? '',
            roleName: user.role?.name ?? '',
            permissions,
            mustChangePwd: user.mustChangePwd,
          },
        },
        message: 'ok',
      });
    }

    // 旧格式：只有 password（向后兼容）
    if (!password) {
      return NextResponse.json({ code: 400, data: null, message: '请输入密码' }, { status: 400 });
    }

    // 查找 admin 用户
    let user = await db.user.findUnique({
      where: { username: 'admin' },
      include: { role: true },
    });

    // 如果数据库无密码hash，回退默认密码
    let isValid = false;
    if (user) {
      isValid = bcrypt.compareSync(password, user.passwordHash);
    } else {
      isValid = password === DEFAULT_PASSWORD;
      if (isValid) {
        const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
        user = await db.user.create({
          data: { username: 'admin', passwordHash: hash, mustChangePwd: false, displayName: '系统管理员' },
          include: { role: true },
        });
      }
    }

    if (!isValid || !user) {
      recordFailedAttempt(clientIp);
      return NextResponse.json({ code: 401, data: null, message: '密码错误' }, { status: 401 });
    }

    resetAttempts(clientIp);
    const token = await createSession(user.id);

    const permissions: string[] = user.role ? JSON.parse(user.role.permissions) : [];

    return NextResponse.json({
      code: 0,
      data: {
        token,
        expiresIn: 604800,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName ?? '',
          roleName: user.role?.name ?? '',
          permissions,
          mustChangePwd: user.mustChangePwd,
        },
      },
      message: 'ok',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

// PUT /api/auth — 旧版密码修改（保持兼容）
export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ code: 401, data: null, message: '未登录' }, { status: 401 });
    }

    const session = await validateToken(token);
    if (!session.valid || !session.userId) {
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
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

// GET /api/auth — 旧版 session 验证
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ code: 401, data: null, message: '未登录' }, { status: 401 });
    }

    const session = await validateToken(token);
    if (!session.valid) {
      return NextResponse.json({ code: 401, data: null, message: '会话已过期或无效' }, { status: 401 });
    }

    return NextResponse.json({
      code: 0,
      data: { authenticated: true, userId: session.userId },
      message: 'ok',
    });
  } catch {
    return NextResponse.json({ code: 500, data: null, message: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/auth — 旧版登出
export async function DELETE(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    await deleteSession(token);
  }

  return NextResponse.json({ code: 0, data: null, message: 'ok' });
}
