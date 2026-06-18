// OpenClaw 回写文案 API — 幂等（topicId + title 检查）
// 使用 guardOpenClawAPI 守卫

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardOpenClawAPI, safeErrorMessage } from '@/lib/api/permission-guard';
import type { OpenClawCreateDraftRequest } from '@/types/promotion';

async function contentContentsPost(req: Request) {
  const denied = guardOpenClawAPI(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as OpenClawCreateDraftRequest;

    if (!body.title?.trim()) {
      return NextResponse.json(
        { code: 400, data: null, message: '标题不能为空' },
        { status: 400 },
      );
    }
    if (!body.body?.trim()) {
      return NextResponse.json(
        { code: 400, data: null, message: '正文不能为空' },
        { status: 400 },
      );
    }

    // 幂等：如果 topicId + title 已存在，返回已有文案
    if (body.topicId) {
      const existing = await db.contentDraft.findFirst({
        where: { topicId: body.topicId, title: body.title },
      });
      if (existing) {
        return NextResponse.json({
          code: 0,
          data: { id: existing.id, duplicated: true },
          message: '文案已存在（topicId+title 去重）',
        });
      }
    }

    const draft = await db.contentDraft.create({
      data: {
        topicId: body.topicId || null,
        title: body.title.trim(),
        body: body.body,
        tags: body.tags || [],
        coverImage: body.coverImage || null,
        images: body.images || [],
        contentMode: body.contentMode || '种草',
        status: 'pending_review', // OpenClaw 回写的文案默认待审核
        aiModel: body.aiModel || null,
        aiPrompt: body.aiPrompt || null,
        createdBy: 'openclaw',
        items: body.itemIds?.length
          ? { create: body.itemIds.map(itemId => ({ itemId })) }
          : undefined,
      },
    });

    return NextResponse.json({
      code: 0,
      data: { id: draft.id, duplicated: false },
      message: 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging('content:contents:POST', contentContentsPost);
