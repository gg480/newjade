import { NextResponse } from 'next/server';
import { getRole, updateRole, deleteRole } from '@/services/role.service';
import { AppError } from '@/lib/errors';

/**
 * GET /api/roles/:id — 角色详情
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的角色ID' }, { status: 400 });
    }

    const role = await getRole(id);
    return NextResponse.json({ code: 0, data: role, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * PUT /api/roles/:id — 编辑角色
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的角色ID' }, { status: 400 });
    }

    const body = await req.json();
    const { name, description, permissions } = body;

    const role = await updateRole(id, { name, description, permissions });
    return NextResponse.json({ code: 0, data: role, message: '角色更新成功' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/roles/:id — 删除角色
 * 系统角色不可删除，有关联用户的角色不可删除
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的角色ID' }, { status: 400 });
    }

    await deleteRole(id);
    return NextResponse.json({ code: 0, data: null, message: '角色已删除' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : '服务器错误';
    return NextResponse.json({ code: 500, data: null, message: msg }, { status: 500 });
  }
}
