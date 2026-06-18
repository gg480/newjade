// 选题评分 API

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as topicService from '@/services/content-topic.service';
import type { RateTopicRequest } from '@/types/promotion';

async function topicRatePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, 'action:content_manage');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = (await req.json()) as RateTopicRequest;
    const ratedBy = req.headers.get('x-user-id') || 'system';
    const topic = await topicService.rateTopic(id, body, ratedBy);
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

export const PATCH = withApiLogging('promotion:topic:rate:PATCH', topicRatePatch);
