import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { createSession, validateToken, deleteSession } from '@/lib/auth';

const DEFAULT_PASSWORD = 'admin123';

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

async function ensureAdminUser(passwordHash: string): Promise<void> {
  await db.user.upsert({
    where: { username: 'admin' },
    create: { username: 'admin', passwordHash, mustChangePwd: false },
    update: { passwordHash },
  });
}

async function getAdminPasswordHash(): Promise<string | null> {
  const user = await db.user.findUnique({ where: { username: 'admin' } });
  if (user?.passwordHash) return user.passwordHash;

  const config = await db.sysConfig.findUnique({ where: { key: 'admin_password' } });
  if (config?.value) {
    const hash = bcrypt.hashSync(config.value, 10);
    await ensureAdminUser(hash);
    return hash;
  }

  return null;
}

// POST /api/auth — login with password
export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { code: 429, data: null, message: '登录尝试过多，请15分钟后再试' },
        { status: 429 }
      );
    }

    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ code: 400, data: null, message: '请输入密码' }, { status: 400 });
    }

    const passwordHash = await getAdminPasswordHash();
    let isValid = false;

    if (passwordHash) {
      isValid = bcrypt.compareSync(password, passwordHash);
    } else {
      isValid = password === DEFAULT_PASSWORD;
      if (isValid) {
        const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
        await ensureAdminUser(hash);
      }
    }

    if (!isValid) {
      recordFailedAttempt(clientIp);
      return NextResponse.json({ code: 401, data: null, message: '密码错误' }, { status: 401 });
    }

    resetAttempts(clientIp);

    const token = await createSession();
    return NextResponse.json({
      code: 0,
      data: { token, expiresIn: 604800 },
      message: 'ok',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

// PUT /api/auth — change password (requires authentication)
export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !await validateToken(token)) {
      return NextResponse.json(
        { code: 401, data: null, message: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    const { oldPassword, newPassword } = await req.json();
    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { code: 400, data: null, message: '请输入旧密码和新密码' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { code: 400, data: null, message: '新密码长度不能少于4位' },
        { status: 400 }
      );
    }

    const passwordHash = await getAdminPasswordHash();
    if (!passwordHash) {
      return NextResponse.json(
        { code: 500, data: null, message: '系统未初始化密码，请先通过默认密码登录' },
        { status: 500 }
      );
    }

    const isOldPasswordValid = bcrypt.compareSync(oldPassword, passwordHash);
    if (!isOldPasswordValid) {
      return NextResponse.json(
        { code: 401, data: null, message: '旧密码错误' },
        { status: 401 }
      );
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await db.user.update({
      where: { username: 'admin' },
      data: { passwordHash: newHash, mustChangePwd: false },
    });

    return NextResponse.json({ code: 0, data: null, message: '密码修改成功' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

// GET /api/auth — validate session
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token || !await validateToken(token)) {
    return NextResponse.json({ code: 401, data: null, message: '未登录或会话已过期' }, { status: 401 });
  }

  return NextResponse.json({
    code: 0,
    data: { authenticated: true, user: 'admin' },
    message: 'ok',
  });
}

// DELETE /api/auth — logout / delete session
export async function DELETE(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    await deleteSession(token);
  }

  return NextResponse.json({ code: 0, data: null, message: 'ok' });
}
