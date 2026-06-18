// 内容文案详情 API — 详情 + 更新

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as draftService from '@/services/content-draft.service';
import type { UpdateDraftRequest } from '@/types/promotion';

async function contentDetailGet(req: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, 'action:content_view');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const draft = await draftService.getDraft(id);
    return NextResponse.json({ code: 0, data: draft, message: 'ok' });
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

async function contentUpdatePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = (await req.json()) as UpdateDraftRequest;
    const draft = await draftService.updateDraft(id, body);
    return NextResponse.json({ code: 0, data: draft, message: 'ok' });
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

export const GET = withApiLogging('promotion:content:GET', contentDetailGet);
export const PATCH = withApiLogging('promotion:content:PATCH', contentUpdatePatch);
