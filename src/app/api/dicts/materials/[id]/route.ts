import { NextResponse } from 'next/server';
import { ConflictError, NotFoundError } from '@/lib/errors';
import * as materialService from '@/services/dict-materials.service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const item = await materialService.getMaterial(parseInt(id));
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json(
        { code: e.code, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    return NextResponse.json(
      { code: 500, data: null, message: '查询失败' },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  try {
    const item = await materialService.updateMaterial(parseInt(id), body);
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json(
        { code: e.code, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    return NextResponse.json(
      { code: 500, data: null, message: '更新失败' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const result = await materialService.deleteMaterial(parseInt(id));
    return NextResponse.json({
      code: 0,
      data: null,
      message: result.message || 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: '删除失败' },
      { status: 500 },
    );
  }
}
