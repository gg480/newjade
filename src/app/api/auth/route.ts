import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, validateToken, deleteSession } from '@/lib/auth';

const DEFAULT_PASSWORD = 'admin123';

// In-memory rate limiting: max 5 failed attempts per 15 minutes per IP
const loginAttempts = new Map<string, { count: number; firstAttemptTime: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         'unknown';
}

function isRateLimited(ip: string): boolean {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  const elapsed = Date.now() - record.firstAttemptTime;
  if (elapsed > RATE_LIMIT_WINDOW_MS) {
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

async function getAdminPassword(): Promise<string> {
  try {
    const config = await db.sysConfig.findUnique({ where: { key: 'admin_password' } });
    return config?.value || DEFAULT_PASSWORD;
  } catch {
    return DEFAULT_PASSWORD;
  }
}

// POST /api/auth/login — authenticate with password
export async function POST(req: Request) {
  try {
    // Rate limiting check
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

    const adminPassword = await getAdminPassword();
    if (password !== adminPassword) {
      recordFailedAttempt(clientIp);
      return NextResponse.json({ code: 401, data: null, message: '密码错误' }, { status: 401 });
    }

    // Reset rate limit on successful login
    resetAttempts(clientIp);

    const token = await createSession();
    return NextResponse.json({
      code: 0,
      data: { token, expiresIn: 604800 }, // 7 days in seconds
      message: 'ok',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: e.message }, { status: 500 });
  }
}

// GET /api/auth/check — validate session
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

// DELETE /api/auth/logout — delete session
export async function DELETE(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    await deleteSession(token);
  }

  return NextResponse.json({ code: 0, data: null, message: 'ok' });
}
