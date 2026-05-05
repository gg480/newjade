import { NextResponse } from 'next/server';
import { ConflictError } from '@/lib/errors';
import * as materialService from '@/services/dict-materials.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('include_inactive') === 'true';
  const items = await materialService.listMaterials(includeInactive);

  return NextResponse.json({ code: 0, data: items, message: 'ok' });
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const item = await materialService.createMaterial(body);
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json(
        { code: e.code, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    return NextResponse.json(
      { code: 500, data: null, message: '创建失败' },
      { status: 500 },
    );
  }
}
