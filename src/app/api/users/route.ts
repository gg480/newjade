import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listUsers, createUser } from '@/services/user.service';
import { AppError } from '@/lib/errors';

/**
 * GET /api/users — 用户列表（分页）
 * 需要 action:user_manage 权限（middleware 鉴权 + route 二次验证）
 */
export async function GET(req: Request) {
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
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * POST /api/users — 创建用户
 * 需要 action:user_manage 权限
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, displayName, roleId } = body;

    const user = await createUser({ username, password, displayName: displayName || '', roleId });
    return NextResponse.json({ code: 0, data: user, message: '用户创建成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
