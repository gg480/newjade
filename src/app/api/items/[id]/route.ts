import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import * as itemsService from '@/services/items.service';
import { AppError, ValidationError } from '@/lib/errors';

type ItemParams = { params: Promise<{ id: string }> };

async function itemByIdGet(req: Request, { params }: ItemParams) {
  const { id } = await params;

  try {
    const item = await itemsService.getItemById(parseInt(id));
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.statusCode, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: `查询失败: ${e.message}` }, { status: 500 });
  }
}

async function itemByIdPut(req: Request, { params }: ItemParams) {
  const { id } = await params;
  const body = await req.json();

  try {
    const item = await itemsService.updateItem(parseInt(id), body);
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
    return NextResponse.json({ code: 500, data: null, message: `更新失败: ${e.message}` }, { status: 500 });
  }
}

async function itemByIdDelete(req: Request, { params }: ItemParams) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hardDelete = searchParams.get('hard') === 'true';

  try {
    await itemsService.deleteItem(parseInt(id), hardDelete);
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.statusCode, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: `删除失败: ${e.message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('items/[id]:GET', itemByIdGet);
export const PUT = withApiLogging('items/[id]:PUT', itemByIdPut);
export const DELETE = withApiLogging('items/[id]:DELETE', itemByIdDelete);
