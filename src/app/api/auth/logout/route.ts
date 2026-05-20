import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

/**
 * POST /api/auth/logout — 登出，删除 session
 *
 * Headers: Authorization: Bearer <token>
 * Response: { code: 0, data: null, message: 'ok' }
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      await deleteSession(token);
    }

    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
