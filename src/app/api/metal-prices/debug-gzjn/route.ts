import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api/with-api-logging';

/**
 * GET /api/metal-prices/debug-gzjn
 * 调试端点：直接返回 gzjn168.com 的原始 HTML 前 5000 字符
 * 仅开发环境可用
 */
async function debugGzjnGET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { code: 403, data: null, message: '仅开发环境可用' },
      { status: 403 }
    );
  }

  const url = 'http://gzjn168.com/phone.html';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: `fetch失败: ${(err as Error).message}`,
    });
  }

  const html = await response.text();
  
  return NextResponse.json({
    ok: true,
    status: response.status,
    length: html.length,
    has_tr: html.includes('<tr'),
    has_td: html.includes('<td'),
    has_table: html.includes('<table'),
    has_li: html.includes('<li'),
    has_div: html.includes('<div'),
    has_strong: html.includes('<strong'),
    has_b: html.includes('<b>'),
    first_1000: html.substring(0, 1000),
  });
}

export const GET = withApiLogging('metal-prices:debug-gzjn:GET', debugGzjnGET);
