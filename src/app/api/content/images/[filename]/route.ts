// 图片代理端点 — OpenClaw 通过此端点获取商品图片二进制流
// 使用 guardOpenClawAPI 守卫，防止未授权访问

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardOpenClawAPI } from '@/lib/api/permission-guard';
import { readFile } from 'fs/promises';
import path from 'path';

const IMAGES_ROOT = process.env.NODE_ENV === 'production'
  ? path.join(process.env.DATA_DIR || '/app/data', 'images')
  : path.join(process.cwd(), 'public', 'images');

// 允许的图片扩展名（防止路径遍历攻击）
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

async function contentImageGet(req: Request, context: { params: Promise<{ filename: string }> }) {
  const denied = guardOpenClawAPI(req);
  if (denied) return denied;

  const { filename } = await context.params;

  // 安全校验：只允许字母数字、下划线、连字符、点
  if (!/^[\w\-.]+$/.test(filename)) {
    return NextResponse.json(
      { code: 400, data: null, message: '无效的文件名' },
      { status: 400 },
    );
  }

  // 检查扩展名
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { code: 400, data: null, message: '不支持的图片格式' },
      { status: 400 },
    );
  }

  const filePath = path.join(IMAGES_ROOT, filename);

  // 防止路径遍历：确保解析后的路径在 IMAGES_ROOT 内
  if (!filePath.startsWith(IMAGES_ROOT)) {
    return NextResponse.json(
      { code: 400, data: null, message: '无效的文件路径' },
      { status: 400 },
    );
  }

  try {
    const buffer = await readFile(filePath);

    // 根据扩展名设置 Content-Type
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentTypeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    // 文件不存在时返回 404
    return NextResponse.json(
      { code: 404, data: null, message: '图片不存在' },
      { status: 404 },
    );
  }
}

export const GET = withApiLogging('content:image:GET', contentImageGet);
