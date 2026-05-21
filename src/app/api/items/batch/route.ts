import { NextResponse } from 'next/server';
import * as itemsService from '@/services/items.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

// POST /api/items/batch — Batch create items (legacy, supports both batchId FK and batchCode string)
async function batchCreateItemsPOST(req: Request) {
  const body = await req.json();
  const result = await itemsService.batchCreateItems(body);
  return NextResponse.json({ code: 0, data: result, message: 'ok' });
}

export const POST = withApiLogging('items/batch:POST', batchCreateItemsPOST);
