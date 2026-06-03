import { NextResponse } from 'next/server';
import { readFile, stat, unlink } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { withApiLogging } from '@/lib/api/with-api-logging';

// Serve images from the data directory in production
const IMAGES_ROOT = process.env.NODE_ENV === 'production'
  ? path.join(process.env.DATA_DIR || '/app/data', 'images')
  : path.join(process.cwd(), 'public', 'images');

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ code: 400, data: null, message: '无效文件名' }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext];
  if (!contentType) {
    return NextResponse.json({ code: 400, data: null, message: '不支持的图片格式' }, { status: 400 });
  }

  try {
    const filepath = path.join(IMAGES_ROOT, filename);
    const fileStat = await stat(filepath);

    if (!fileStat.isFile()) {
      return NextResponse.json({ code: 404, data: null, message: '文件不存在' }, { status: 404 });
    }

    const buffer = await readFile(filepath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ code: 404, data: null, message: '文件不存在' }, { status: 404 });
  }
}

/**
 * 删除图片（按 DB 记录 ID）
 * 请求参数：?imageId=N
 */
async function deleteHandler(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { searchParams } = new URL(req.url);
  const imageIdStr = searchParams.get('imageId');

  if (!imageIdStr) {
    return NextResponse.json(
      { code: 400, data: null, message: '请指定图片记录 ID (imageId)' },
      { status: 400 },
    );
  }

  const imageId = parseInt(imageIdStr, 10);
  if (isNaN(imageId) || imageId <= 0) {
    return NextResponse.json(
      { code: 400, data: null, message: '无效的图片记录 ID' },
      { status: 400 },
    );
  }

  // 查找图片记录
  const image = await db.itemImage.findUnique({ where: { id: imageId } });
  if (!image) {
    return NextResponse.json(
      { code: 404, data: null, message: '图片记录不存在' },
      { status: 404 },
    );
  }

  // 删除物理文件
  const physicalFilename = image.filename.split('/').pop();
  if (physicalFilename) {
    const filepath = path.join(IMAGES_ROOT, physicalFilename);
    try {
      await unlink(filepath);
    } catch {
      // 文件不存在则忽略
    }
  }

  // 删除 DB 记录
  await db.itemImage.delete({ where: { id: imageId } });

  // 如果删除的是封面图，自动设置剩余第一张为封面
  if (image.isCover) {
    const firstImage = await db.itemImage.findFirst({
      where: { itemId: image.itemId },
    });
    if (firstImage) {
      await db.itemImage.update({
        where: { id: firstImage.id },
        data: { isCover: true },
      });
    }
  }

  return NextResponse.json({ code: 0, data: null, message: 'ok' });
}

export const DELETE = withApiLogging('images:delete', deleteHandler);
