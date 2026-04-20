import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to:
 * 1. Prevent iframe embedding (anti-clickjacking)
 * 2. Add security headers
 * 3. Add CORS headers for standalone deployment
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Prevent iframe embedding (anti-clickjacking)
  response.headers.set('X-Frame-Options', 'DENY');

  // Content Security Policy - standalone deployment
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
    ].join('; ')
  );

  // Additional security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=()');

  return response;
}

export const config = {
  // Apply to all routes except static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)',
  ],
};
