import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth';

export const runtime = 'nodejs';

// 无需认证即可访问的公开路径
// 注意：旧版 /api/auth 也保留公开（其内部 PUT/DELETE 有独立鉴权验证）
// 注意：/api/config 需要认证（含 tanshu_api_key 等敏感配置）
// 登录页预加载 store_name 走前端硬编码兜底 '兴盛艺珠宝'
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth',
  '/api/health',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    return res;
  }

  // 提取 token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      { code: 401, data: null, message: '缺少认证令牌' },
      { status: 401 }
    );
  }

  // 验证 token
  const session = await validateToken(token);
  if (!session.valid || !session.userId) {
    return NextResponse.json(
      { code: 401, data: null, message: '会话已过期或无效' },
      { status: 401 }
    );
  }

  // 将用户信息注入请求头
  requestHeaders.set('x-user-id', String(session.userId));

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set('X-Request-Id', id);
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
