import { NextResponse } from 'next/server';
import * as dictsService from '@/services/dicts.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupName = searchParams.get('group_name') || undefined;
  const materialIdParam = searchParams.get('material_id');
  const materialId = materialIdParam ? parseInt(materialIdParam, 10) : undefined;
  const includeInactive = searchParams.get('include_inactive') === 'true';

  try {
    const items = await dictsService.listTags({ groupName, materialId, includeInactive });
    return NextResponse.json({ code: 0, data: items, message: 'ok' });
  } catch (e) {
    console.error('标签查询失败:', e);
    return NextResponse.json({ code: 500, data: null, message: '标签查询失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, groupName } = body;

  try {
    const item = await dictsService.createTag({ name, groupName });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === '标签名称已存在') {
      return NextResponse.json({ code: 400, data: null, message: '标签名称已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
