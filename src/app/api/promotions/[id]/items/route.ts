import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { getPromotionItems, addPromotionItems, removePromotionItems } from '@/services/promotions.service';

async function promotionItemsGet(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;

  try {
    const result = await getPromotionItems(parseInt(promotionId));
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    return NextResponse.json({ code: 500, data: null, message: `获取失败: ${message}` }, { status: 500 });
  }
}

async function promotionItemsPost(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;
  const body = await req.json();
  const { itemIds } = body;

  try {
    const result = await addPromotionItems(parseInt(promotionId), itemIds || []);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ code: 400, data: null, message }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: `添加失败: ${message}` }, { status: 500 });
  }
}

async function promotionItemsDelete(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;
  const body = await req.json();
  const { itemIds } = body;

  try {
    const result = await removePromotionItems(parseInt(promotionId), itemIds || []);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotFoundError) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ code: 400, data: null, message }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: `移除失败: ${message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('promotions:items:GET', promotionItemsGet);
export const POST = withApiLogging('promotions:items:POST', promotionItemsPost);
export const DELETE = withApiLogging('promotions:items:DELETE', promotionItemsDelete);
