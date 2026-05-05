import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import * as itemsService from '@/services/items.service';
import { AppError, ValidationError } from '@/lib/errors';

async function itemsListGet(req: Request) {
  const { searchParams } = new URL(req.url);

  try {
    const result = await itemsService.getItems({
      page: parseInt(searchParams.get('page') || '1'),
      size: parseInt(searchParams.get('size') || '20'),
      materialId: searchParams.get('material_id'),
      typeId: searchParams.get('type_id'),
      status: searchParams.get('status'),
      batchId: searchParams.get('batch_id'),
      counter: searchParams.get('counter'),
      keyword: searchParams.get('keyword'),
      searchField: searchParams.get('search_field'),
      sortBy: searchParams.get('sort_by') || 'created_at',
      sortOrder: searchParams.get('sort_order') || 'desc',
    });

    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.statusCode, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: `查询失败: ${e.message}` }, { status: 500 });
  }
}

async function itemsCreatePost(req: Request) {
  const body = await req.json();

  try {
    const item = await itemsService.createItem(body);
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e instanceof ValidationError && (e as any).tagData) {
      return NextResponse.json(
        { code: 400, data: (e as any).tagData, message: 'TAG_MATERIAL_MISMATCH' },
        { status: 400 },
      );
    }
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.statusCode, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: `创建失败: ${e.message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('items:GET', itemsListGet);
export const POST = withApiLogging('items:POST', itemsCreatePost);
