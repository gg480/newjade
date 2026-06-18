// 选题详情 API

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermission, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as topicService from '@/services/content-topic.service';

async function topicDetailGet(req: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, 'action:content_view');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const topic = await topicService.getTopic(id);
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

export const GET = withApiLogging('promotion:topic:GET', topicDetailGet);
