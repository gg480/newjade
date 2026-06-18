// OpenClaw 回写拆解结果 API — 将分析结果写入选题的 aiMetadata
// 使用 guardOpenClawAPI 守卫

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardOpenClawAPI, safeErrorMessage } from '@/lib/api/permission-guard';
import type { OpenClawAnalyzeRequest } from '@/types/promotion';

async function contentAnalyzePost(req: Request) {
  const denied = guardOpenClawAPI(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as OpenClawAnalyzeRequest;

    if (!body.topicId) {
      return NextResponse.json(
        { code: 400, data: null, message: 'topicId 不能为空' },
        { status: 400 },
      );
    }

    const topic = await db.contentTopic.findUnique({
      where: { id: body.topicId },
    });

    if (!topic) {
      return NextResponse.json(
        { code: 404, data: null, message: '选题不存在' },
        { status: 404 },
      );
    }

    // 将分析结果合并到 aiMetadata，并更新状态为 analyzed
    const existingMetadata = (topic.aiMetadata as Record<string, unknown>) ?? {};
    const updatedMetadata = {
      ...existingMetadata,
      analysis: body.analysisResult,
      analyzedAt: new Date().toISOString(),
    };

    await db.contentTopic.update({
      where: { id: body.topicId },
      data: {
        aiMetadata: updatedMetadata as any,
        status: 'analyzed',
      },
    });

    return NextResponse.json({
      code: 0,
      data: { topicId: body.topicId, status: 'analyzed' },
      message: 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging('content:analyze:POST', contentAnalyzePost);
