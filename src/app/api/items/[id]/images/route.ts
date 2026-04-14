import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Upload image for an item
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = parseInt(id);

  try {
    const item = await db.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ code: 404, data: null, message: '货品不存在' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请选择图片' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ code: 400, data: null, message: '仅支持 JPG/PNG/GIF/WEBP 格式' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ code: 400, data: null, message: '图片大小不能超过5MB' }, { status: 400 });
    }

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `item_${itemId}_${Date.now()}.${ext}`;
    const imagesDir = path.join(process.cwd(), 'public', 'images');

    // Ensure directory exists
    await mkdir(imagesDir, { recursive: true });

    const filepath = path.join(imagesDir, filename);
    await writeFile(filepath, buffer);

    // Check if this is the first image (make it cover)
    const existingImages = await db.itemImage.count({ where: { itemId } });

    const imageRecord = await db.itemImage.create({
      data: {
        itemId,
        filename: `/images/${filename}`,
        isCover: existingImages === 0,
      },
    });

    return NextResponse.json({ code: 0, data: imageRecord, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `上传失败: ${e.message}` }, { status: 500 });
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
    const image = await db.itemImage.findUnique({ where: { id: parseInt(imageId) } });
    if (!image || image.itemId !== itemId) {
      return NextResponse.json({ code: 404, data: null, message: '图片不存在' }, { status: 404 });
    }

    await db.itemImage.delete({ where: { id: parseInt(imageId) } });

    // If deleted image was cover, set first remaining as cover
    if (image.isCover) {
      const firstImage = await db.itemImage.findFirst({ where: { itemId } });
      if (firstImage) {
        await db.itemImage.update({ where: { id: firstImage.id }, data: { isCover: true } });
      }
    }

    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
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
    // Unset all covers
    await db.itemImage.updateMany({ where: { itemId, isCover: true }, data: { isCover: false } });
    // Set new cover
    await db.itemImage.update({ where: { id: imageId }, data: { isCover: true } });

    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '设置失败' }, { status: 500 });
  }
}
