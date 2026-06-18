// 内容文案违禁词检测 API

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as draftService from '@/services/content-draft.service';

async function contentCheckPost(req: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const result = await draftService.checkViolations(id);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { code: e.statusCode, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging('promotion:content:check:POST', contentCheckPost);
