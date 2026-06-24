import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { validateToken, validateOpenClawKey, isOpenClawKey } from '@/lib/auth';
import { globalLimiter } from '@/lib/rate-limiter';

export const runtime = 'nodejs';

// 无需认证即可访问的公开路径
// 注意：旧版 /api/auth 也保留公开（其内部 PUT/DELETE 有独立鉴权验证）
// 注意：/api/config 需要认证（含 tanshu_api_key 等敏感配置）
// 登录页预加载 store_name 走前端硬编码兜底 '兴盛艺珠宝'
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth',
  '/api/health',
  // '/api/remote/',  // [灰度] 远程指令 API — 待重新设计后启用
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

// 需要限制请求体大小的认证相关路径（仅 POST/PUT/PATCH）
const AUTH_BODY_LIMIT_PATHS = ['/api/auth/', '/api/users'];
const MAX_AUTH_BODY_SIZE = 10 * 1024; // 10KB

/** 为响应添加安全响应头 */
function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================
  // 1. 全局限流（必须在公开路径判断之前，保护所有端点包括登录接口）
  //    本地 IP（127.0.0.1 / ::1）跳过限流，方便 E2E 测试
  // ============================================================
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  if (ip !== '127.0.0.1' && ip !== '::1' && !ip.startsWith('::ffff:127.')) {
    const limitResult = globalLimiter.check(ip);
    if (!limitResult.allowed) {
      return addSecurityHeaders(NextResponse.json(
        { code: 429, data: null, message: '请求过于频繁' },
        { status: 429 }
      ));
    }
  }

  // ============================================================
  // 2. 请求体大小限制（仅 auth 相关路径的写操作）
  // ============================================================
  const isAuthBodyPath = AUTH_BODY_LIMIT_PATHS.some(p => pathname.startsWith(p));
  const isWriteMethod = ['POST', 'PUT', 'PATCH'].includes(request.method);
  if (isAuthBodyPath && isWriteMethod) {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_AUTH_BODY_SIZE) {
      return addSecurityHeaders(NextResponse.json(
        { code: 413, data: null, message: '请求体过大' },
        { status: 413 }
      ));
    }
  }

  // 始终设置 request-id
  const existing =
    request.headers.get('x-request-id') ||
    request.headers.get('X-Request-Id') ||
    '';
  const id = existing.trim() || crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', id);

  // 公开路径跳过鉴权
  if (isPublicPath(pathname)) {
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    res.headers.set('X-Request-Id', id);
    return addSecurityHeaders(res);
  }

  // 提取 token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return addSecurityHeaders(NextResponse.json(
      { code: 401, data: null, message: '缺少认证令牌' },
      { status: 401 }
    ));
  }

  // 双 Token 认证：OpenClaw API Key（oc_ 前缀）走独立验证路径
  if (isOpenClawKey(token)) {
    const valid = await validateOpenClawKey(token);
    if (!valid) {
      return addSecurityHeaders(NextResponse.json(
        { code: 401, data: null, message: 'OpenClaw API Key 无效' },
        { status: 401 }
      ));
    }
    // OpenClaw 调用：注入系统级标识，userId=0 表示非人类用户
    requestHeaders.set('x-user-id', '0');
    requestHeaders.set('x-auth-type', 'openclaw');

    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    res.headers.set('X-Request-Id', id);
    return addSecurityHeaders(res);
  }

  // 验证用户会话 token
  const session = await validateToken(token);
  if (!session.valid || !session.userId) {
    return addSecurityHeaders(NextResponse.json(
      { code: 401, data: null, message: '会话已过期或无效' },
      { status: 401 }
    ));
  }

  // 将用户信息注入请求头
  requestHeaders.set('x-user-id', String(session.userId));
  requestHeaders.set('x-auth-type', 'session');

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set('X-Request-Id', id);
  return addSecurityHeaders(res);
}

export const config = {
  matcher: '/api/:path*',
};
