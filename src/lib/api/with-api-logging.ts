// API logging wrapper - minimal implementation
// Wraps API route handlers with logging support

import { NextResponse } from 'next/server';

type RouteHandler = (req: Request) => Promise<NextResponse>;

export function withApiLogging(label: string, handler: RouteHandler): RouteHandler {
  return async (req: Request) => {
    const start = Date.now();
    try {
      const result = await handler(req);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[API] ${label} ${req.method} ${req.url} - ${result.status} (${duration}ms)`);
      }
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[API] ${label} ${req.method} ${req.url} - ERROR (${duration}ms)`, error);
      return NextResponse.json(
        { code: 500, data: null, message: '服务器内部错误' },
        { status: 500 }
      );
    }
  };
}
