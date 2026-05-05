import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { listPromotions, createPromotion, updatePromotion, deletePromotion } from '@/services/promotions.service';

async function promotionsListGet(req: Request) {
  const { searchParams } = new URL(req.url);

  try {
    const result = await listPromotions({
      page: parseInt(searchParams.get('page') || '1'),
      size: parseInt(searchParams.get('size') || '20'),
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      keyword: searchParams.get('keyword') || undefined,
    });

    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message: `获取失败: ${message}` }, { status: 500 });
  }
}

async function promotionsCreatePost(req: Request) {
  const body = await req.json();

  try {
    const promotion = await createPromotion(body);
    return NextResponse.json({ code: 0, data: promotion, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof ValidationError) {
      return NextResponse.json({ code: 400, data: null, message }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: `创建失败: ${message}` }, { status: 500 });
  }
}

async function promotionsUpdatePut(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ code: 400, data: null, message: '缺少促销ID' }, { status: 400 });
  }

  const body = await req.json();

  try {
    const promotion = await updatePromotion(parseInt(id), body);
    return NextResponse.json({ code: 0, data: promotion, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ code: 400, data: null, message }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: `更新失败: ${message}` }, { status: 500 });
  }
}

async function promotionsDeleteDelete(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ code: 400, data: null, message: '缺少促销ID' }, { status: 400 });
  }

  try {
    await deletePromotion(parseInt(id));
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    return NextResponse.json({ code: 500, data: null, message: `删除失败: ${message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('promotions:GET', promotionsListGet);
export const POST = withApiLogging('promotions:POST', promotionsCreatePost);
export const PUT = withApiLogging('promotions:PUT', promotionsUpdatePut);
export const DELETE = withApiLogging('promotions:DELETE', promotionsDeleteDelete);
