import { NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';
import { guardPermission } from '@/lib/api/permission-guard';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('include_inactive') === 'true';
  const materialId = searchParams.get('material_id');
  try {
    const items = await dictsService.listTypes({
      includeInactive,
      materialId: materialId ? Number(materialId) : undefined,
    });
    return NextResponse.json({ code: 0, data: items, message: 'ok' });
  } catch (e) {
    console.error('器型查询失败:', e);
    return NextResponse.json({ code: 500, data: null, message: '查询失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await guardPermission(req, 'action:dict_manage');
  if (denied) return denied;
  const body = await req.json();
  const { name, specFields, sortOrder } = body;
  try {
    const item = await dictsService.createType({ name, specFields, sortOrder });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === '器型名称已存在') {
      return NextResponse.json({ code: 400, data: null, message: '器型名称已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
