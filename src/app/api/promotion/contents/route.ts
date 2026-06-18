// 内容文案管理 API — 列表 + 创建

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as draftService from '@/services/content-draft.service';
import type { DraftListParams, CreateDraftRequest } from '@/types/promotion';

async function contentsListGet(req: Request) {
  const denied = await guardPermission(req, 'action:content_view');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const params: DraftListParams = {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    status: (searchParams.get('status') as DraftListParams['status']) || undefined,
    topicId: searchParams.get('topic_id') || undefined,
    contentMode: (searchParams.get('content_mode') as DraftListParams['contentMode']) || undefined,
    keyword: searchParams.get('keyword') || undefined,
  };

  try {
    const result = await draftService.listDrafts(params);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

async function contentsCreatePost(req: Request) {
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const body = (await req.json()) as CreateDraftRequest;
    const userId = req.headers.get('x-user-id') || 'system';
    const draft = await draftService.createDraft(body, userId);
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

export const GET = withApiLogging('promotion:contents:GET', contentsListGet);
export const POST = withApiLogging('promotion:contents:POST', contentsCreatePost);
