import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

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
