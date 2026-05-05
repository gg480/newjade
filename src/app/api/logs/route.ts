import { NextResponse } from 'next/server';
import * as logsService from '@/services/logs.service';

// Operation logs API endpoint

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const action = searchParams.get('action');
  const targetType = searchParams.get('target_type');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const search = searchParams.get('search');

  const result = await logsService.getLogs({
    page,
    size,
    action,
    targetType,
    startDate,
    endDate,
    search,
  });

  return NextResponse.json({
    code: 0,
    data: result,
    message: 'ok',
  });
}
