import { NextResponse } from 'next/server';
import { listUsers, createUser } from '@/services/user.service';
import { AppError } from '@/lib/errors';
import { createLimiter } from '@/lib/rate-limiter';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';

// 创建用户限流：每 IP 30分钟最多5次
const createUserLimiter = createLimiter({
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
 * GET /api/users — 用户列表（分页）
 * 需要 action:user_manage 权限
 */
export async function GET(req: Request) {
  const denied = await guardPermission(req, 'action:user_manage');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const keyword = searchParams.get('keyword') || undefined;
    const roleId = searchParams.get('roleId') ? parseInt(searchParams.get('roleId')!) : undefined;
    const isActive = searchParams.get('isActive') !== null
      ? searchParams.get('isActive') === 'true'
      : undefined;

    const result = await listUsers({ page, limit, keyword, roleId, isActive });
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = safeErrorMessage(e);
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * POST /api/users — 创建用户
 * 需要 action:user_manage 权限
 */
export async function POST(req: Request) {
  const denied = await guardPermission(req, 'action:user_manage');
  if (denied) return denied;

  try {
    // 速率限制检查
    const ip = getClientIP(req);
    const limitResult = createUserLimiter.check(ip);
    if (!limitResult.allowed) {
      return NextResponse.json(
        { code: 429, data: null, message: '请求过于频繁，请稍后再试' },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { username, password, displayName, roleId } = body;

    const user = await createUser({ username, password, displayName: displayName || '', roleId });
    return NextResponse.json({ code: 0, data: user, message: '用户创建成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = safeErrorMessage(e);
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
