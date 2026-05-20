import { NextResponse } from 'next/server';
import { listRoles, createRole } from '@/services/role.service';
import { AppError } from '@/lib/errors';

/**
 * GET /api/roles — 角色列表（不分页）
 */
export async function GET() {
  try {
    const roles = await listRoles();
    return NextResponse.json({ code: 0, data: { items: roles }, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * POST /api/roles — 创建角色
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, permissions } = body;

    const role = await createRole({ name, description, permissions });
    return NextResponse.json({ code: 0, data: role, message: '角色创建成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
