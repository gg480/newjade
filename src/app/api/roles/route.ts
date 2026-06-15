import { NextResponse } from 'next/server';
import { listRoles, createRole } from '@/services/role.service';
import { AppError } from '@/lib/errors';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';

/**
 * GET /api/roles — 角色列表（不分页）
 */
export async function GET(req: Request) {
  const denied = await guardPermission(req, 'action:role_manage');
  if (denied) return denied;
  try {
    const roles = await listRoles();
    return NextResponse.json({ code: 0, data: { items: roles }, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = safeErrorMessage(e);
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * POST /api/roles — 创建角色（需要 action:role_manage 权限）
 */
export async function POST(req: Request) {
  const denied = await guardPermission(req, 'action:role_manage');
  if (denied) return denied;

  try {
    const body = await req.json();
    const { name, description, permissions } = body;

    const role = await createRole({ name, description, permissions });
    return NextResponse.json({ code: 0, data: role, message: '角色创建成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = safeErrorMessage(e);
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
