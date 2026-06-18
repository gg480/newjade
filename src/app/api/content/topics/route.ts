// OpenClaw 回写选题 API — 幂等（sourceUrl 去重）
// 使用 guardOpenClawAPI 守卫，只允许 OpenClaw 调用

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardOpenClawAPI, safeErrorMessage } from '@/lib/api/permission-guard';
import type { OpenClawCreateTopicRequest } from '@/types/promotion';

async function contentTopicsPost(req: Request) {
  const denied = guardOpenClawAPI(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as OpenClawCreateTopicRequest;

    if (!body.title?.trim()) {
      return NextResponse.json(
        { code: 400, data: null, message: '标题不能为空' },
        { status: 400 },
      );
    }

    // 幂等：如果 sourceUrl 已存在，返回已有选题
    if (body.sourceUrl) {
      const existing = await db.contentTopic.findFirst({
        where: { sourceUrl: body.sourceUrl },
      });
      if (existing) {
        return NextResponse.json({
          code: 0,
          data: { id: existing.id, duplicated: true },
          message: '选题已存在（sourceUrl 去重）',
        });
      }
    }

    const topic = await db.contentTopic.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        topicType: body.topicType || 'product',
        status: 'analyzed', // OpenClaw 回写的选题默认已分析
        source: 'ai',
        sourceUrl: body.sourceUrl || null,
        keywords: body.keywords || [],
        aiMetadata: (body.aiMetadata ?? undefined) as any,
        createdBy: 'openclaw',
        items: body.itemIds?.length
          ? { create: body.itemIds.map(itemId => ({ itemId })) }
          : undefined,
      },
    });

    return NextResponse.json({
      code: 0,
      data: { id: topic.id, duplicated: false },
      message: 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging('content:topics:POST', contentTopicsPost);
