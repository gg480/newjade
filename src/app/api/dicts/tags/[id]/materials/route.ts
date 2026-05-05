import { NextResponse } from 'next/server';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { updateTagMaterials } from '@/services/dicts-tags.service';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tagId = parseInt(id, 10);
  if (Number.isNaN(tagId)) {
    return NextResponse.json({ code: 400, data: null, message: '标签ID无效' }, { status: 400 });
  }

  const body = await req.json();

  try {
    const result = await updateTagMaterials(tagId, {
      isGlobal: Boolean(body?.isGlobal),
      materialIds: Array.isArray(body?.materialIds) ? body.materialIds : [],
    });

    return NextResponse.json({ code: 0, message: 'ok', data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '标签不存在' }, { status: 404 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({
        code: 400,
        message: 'NON_GLOBAL_TAG_REQUIRES_MATERIALS',
        data: { tagId },
      }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message }, { status: 500 });
  }
}
