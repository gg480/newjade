import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { ValidationError } from '@/lib/errors';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { guardPermission } from '@/lib/api/permission-guard';
import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_TYPES, detectImageMime } from '@/lib/file-utils';

const IMAGES_ROOT = process.env.NODE_ENV === 'production'
  ? path.join(process.env.DATA_DIR || '/app/data', 'images')
  : path.join(process.cwd(), 'public', 'images');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function uploadHandler(req: Request) {
  // RBAC permission check — images upload requires item_batch_ops
  const denied = await guardPermission(req, 'action:item_batch_ops');
  if (denied) return denied;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const itemIdRaw = formData.get('itemId');

  if (!file) {
    return NextResponse.json(
      { code: 400, data: null, message: '请选择图片文件' },
      { status: 400 },
    );
  }

  // Validate client-reported MIME type (first line of defense)
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { code: 400, data: null, message: '仅支持 JPG/JPEG/PNG/WEBP 格式' },
      { status: 400 },
    );
  }

  // Validate file extension via path.extname (reliable)
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { code: 400, data: null, message: '仅支持 JPG/JPEG/PNG/WEBP 格式' },
      { status: 400 },
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { code: 400, data: null, message: '图片大小不能超过10MB' },
      { status: 400 },
    );
  }

  // 解析 itemId（可选）
  let itemId: number | null = null;
  if (itemIdRaw) {
    itemId = parseInt(itemIdRaw as string, 10);
    if (isNaN(itemId) || itemId <= 0) {
      return NextResponse.json(
        { code: 400, data: null, message: '无效的货品ID' },
        { status: 400 },
      );
    }
  }

  // UUID 命名
  const uuid = crypto.randomUUID();
  const filename = `${uuid}${ext}`;

  // 确保目标目录存在
  await mkdir(IMAGES_ROOT, { recursive: true });
  const filepath = path.join(IMAGES_ROOT, filename);

  // 保存文件（先验证魔数）
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 12) {
    return NextResponse.json(
      { code: 400, data: null, message: '无效的图片文件' },
      { status: 400 },
    );
  }
  const detectedMime = detectImageMime(new Uint8Array(buffer));
  if (!detectedMime) {
    return NextResponse.json(
      { code: 400, data: null, message: '文件内容不是有效的图片格式' },
      { status: 400 },
    );
  }
  await writeFile(filepath, buffer);

  // 构建访问 URL
  const url = `/api/images/${filename}`;

  // 可选：写入 ItemImage 记录
  let imageRecord: { id: number; url: string; thumbnailUrl: string | null } | null = null;
  if (itemId) {
    const existingCount = await db.itemImage.count({ where: { itemId } });
    const record = await db.itemImage.create({
      data: {
        itemId,
        filename: url,
        isCover: existingCount === 0,
      },
    });
    imageRecord = { id: record.id, url, thumbnailUrl: null };
  }

  return NextResponse.json({
    code: 0,
    data: {
      id: imageRecord?.id ?? 0,
      url,
      thumbnailUrl: null,
    },
    message: 'ok',
  });
}

export const POST = withApiLogging('images:upload', uploadHandler);
