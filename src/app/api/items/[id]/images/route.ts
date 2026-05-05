import { NextResponse } from 'next/server';
import { uploadItemImage, deleteItemImage, setCoverImage } from '@/services/items-extra.service';
import { NotFoundError, ValidationError } from '@/lib/errors';

// Upload image for an item
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = parseInt(id);

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请选择图片' }, { status: 400 });
    }

    const imageRecord = await uploadItemImage(itemId, file);
    return NextResponse.json({ code: 0, data: imageRecord, message: 'ok' });
  } catch (e: unknown) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: e.message }, { status: 404 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ code: 400, data: null, message: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : '上传失败';
    return NextResponse.json({ code: 500, data: null, message: `上传失败: ${message}` }, { status: 500 });
  }
}

// Delete an image
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = parseInt(id);
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get('image_id');

  if (!imageId) {
    return NextResponse.json({ code: 400, data: null, message: '请指定图片ID' }, { status: 400 });
  }

  try {
    await deleteItemImage(itemId, parseInt(imageId));
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: unknown) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: e.message }, { status: 404 });
    }
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}

// Set cover image
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = parseInt(id);
  const body = await req.json();
  const { imageId } = body;

  if (!imageId) {
    return NextResponse.json({ code: 400, data: null, message: '请指定图片ID' }, { status: 400 });
  }

  try {
    await setCoverImage(itemId, imageId);
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: unknown) {
    return NextResponse.json({ code: 500, data: null, message: '设置失败' }, { status: 500 });
  }
}
