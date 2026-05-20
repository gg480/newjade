import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { updateLastLogin } from '@/services/user.service';
import { parsePermissions } from '@/lib/auth';

// In-memory rate limiting: max 5 failed attempts per 15 minutes per IP
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

/**
 * POST /api/auth/login — 用户名+密码登录
 *
 * Request: { username: string, password: string }
 * Response: { code: 0, data: { token, expiresIn, user: { id, username, displayName, roleName, permissions, mustChangePwd } } }
 */
export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { code: 429, data: null, message: '登录尝试过多，请15分钟后再试' },
        { status: 429 }
      );
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ code: 400, data: null, message: '请输入用户名和密码' }, { status: 400 });
    }

    // 查找用户（支持用户名或旧密码模式）
    const user = await db.user.findUnique({
      where: { username: username.trim() },
      include: { role: true },
    });

    if (!user) {
      recordFailedAttempt(clientIp);
      return NextResponse.json({ code: 401, data: null, message: '用户名或密码错误' }, { status: 401 });
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      return NextResponse.json({ code: 401, data: null, message: '账户已被禁用' }, { status: 401 });
    }

    // 验证密码
    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      recordFailedAttempt(clientIp);
      return NextResponse.json({ code: 401, data: null, message: '用户名或密码错误' }, { status: 401 });
    }

    resetAttempts(clientIp);

    // 创建 session
    const token = await createSession(user.id);

    // 更新最后登录时间
    await updateLastLogin(user.id);

    // 解析权限
    const permissions = user.role ? parsePermissions(user.role.permissions) : [];

    return NextResponse.json({
      code: 0,
      data: {
        token,
        expiresIn: 604800, // 7天
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
