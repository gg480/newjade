import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth';

export const runtime = 'nodejs';

// 无需鉴权的公共路径（健康检查、系统配置读取等）
const PUBLIC_PATHS = ['/api/health', '/api/config'];

export async function middleware(request: NextRequest) {
  const existing =
    request.headers.get('x-request-id') ||
    request.headers.get('X-Request-Id') ||
    '';
  const id = existing.trim() || crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', id);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    // POST /api/auth 是登录接口，不需要鉴权
    if (pathname === '/api/auth' && request.method === 'POST') {
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      res.headers.set('X-Request-Id', id);
      return res;
    }

    // 公共路径不需要鉴权
    if (!PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token || !await validateToken(token)) {
        return NextResponse.json(
          { code: 401, data: null, message: '未登录或会话已过期' },
          { status: 401 }
        );
      }
    }
  }

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set('X-Request-Id', id);
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
