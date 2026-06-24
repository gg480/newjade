// 选题管理 API — 列表 + 创建

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermissionOrOpenClaw, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as topicService from '@/services/content-topic.service';
import type { TopicListParams, CreateTopicRequest } from '@/types/promotion';

async function topicsListGet(req: Request) {
  const denied = await guardPermissionOrOpenClaw(req, 'action:content_view');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const params: TopicListParams = {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    status: (searchParams.get('status') as TopicListParams['status']) || undefined,
    source: (searchParams.get('source') as TopicListParams['source']) || undefined,
    topicType: (searchParams.get('topic_type') as TopicListParams['topicType']) || undefined,
    minRating: searchParams.get('min_rating') ? parseInt(searchParams.get('min_rating')!) : undefined,
    maxRating: searchParams.get('max_rating') ? parseInt(searchParams.get('max_rating')!) : undefined,
    keyword: searchParams.get('keyword') || undefined,
  };

  try {
    const result = await topicService.listTopics(params);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

async function topicsCreatePost(req: Request) {
  const denied = await guardPermissionOrOpenClaw(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const body = (await req.json()) as CreateTopicRequest;
    const userId = req.headers.get('x-user-id') || 'system';
    const topic = await topicService.createTopic(body, userId);
    return NextResponse.json({ code: 0, data: topic, message: 'ok' });
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

export const GET = withApiLogging('promotion:topics:GET', topicsListGet);
export const POST = withApiLogging('promotion:topics:POST', topicsCreatePost);
