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

// 内容安全策略 — 按环境区分
// 注意：Next.js 16 中 middleware 注入 nonce 给 RSC inline scripts 的机制已失效
// （middleware.ts 已废弃，不自动读取 x-nonce header 注入到 <script> 标签）
// 因此生产环境直接用 'unsafe-inline'，放弃 nonce 方案
const CSP_DIRECTIVES_PRODUCTION = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: mediastream:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  "script-src-attr 'unsafe-inline'",
].join('; ');

const CSP_DIRECTIVES_DEV = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: mediastream:",
  "font-src 'self' data:",
  "connect-src 'self' https://fastly.jsdelivr.net https://cdn.jsdelivr.net",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  "script-src-attr 'unsafe-inline'",
].join('; ');

/** 为响应添加安全响应头 */
function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content-Security-Policy — 按环境区分
  const csp = process.env.NODE_ENV === 'production' ? CSP_DIRECTIVES_PRODUCTION : CSP_DIRECTIVES_DEV;
  res.headers.set('Content-Security-Policy', csp);
  // Strict-Transport-Security — 仅在生产环境启用（防止本地开发被缓存）
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Permissions-Policy — 限制敏感 API 权限
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), fullscreen=(self), display-capture=(self)');
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================
  // 非 API 路由（页面/静态资源）：仅添加安全响应头，不执行鉴权
  // ============================================================
  if (!pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    return addSecurityHeaders(res);
  }

  // ============================================================
  // 1. 全局限流（必须在公开路径判断之前，保护所有端点包括登录接口）
  //    本地 IP（127.0.0.1 / ::1）跳过限流，方便 E2E 测试
  // ============================================================
  // 使用 request.ip（Next.js 提供的实际 TCP 连接 IP），运行时存在但类型定义缺失
  const ip = (request as NextRequest & { ip?: string }).ip || '127.0.0.1';

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
  matcher: [
    // Match all routes except Next.js internal assets and favicon
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
