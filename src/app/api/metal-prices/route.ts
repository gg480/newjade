import { NextResponse } from 'next/server';
import { getCurrentPrices, createPriceRecord, deletePriceRecord } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { guardPermission } from '@/lib/api/permission-guard';
import { logAction, resolveOperator } from '@/lib/log';
import { ValidationError, AppError } from '@/lib/errors';

async function metalPricesGET() {
  const data = await getCurrentPrices();
  return NextResponse.json({ code: 0, data, message: 'ok' });
}

async function metalPricesPOST(req: Request) {
  const denied = await guardPermission(req, 'action:metal_price_manage');
  if (denied) return denied;
  const body = await req.json();
  const materialId = parseInt(body.materialId);
  const pricePerGram = parseFloat(body.pricePerGram);

  const record = await createPriceRecord({ materialId, pricePerGram });
  await logAction('create_price', 'metal_price', record.id, {
    materialId, pricePerGram, effectiveDate: record.effectiveDate,
  }, await resolveOperator(req));
  return NextResponse.json({ code: 0, data: record, message: 'ok' });
}

async function metalPricesDELETE(req: Request) {
  const denied = await guardPermission(req, 'action:metal_price_manage');
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '0');
    if (!id || isNaN(id)) {
      throw new ValidationError('请提供有效的价格记录ID');
    }

    await deletePriceRecord(id);
    return NextResponse.json({ code: 0, data: null, message: '价格记录已删除' });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, data: null, message: err.message },
        { status: err.statusCode }
      );
    }
    throw err;
  }
}

export const GET = withApiLogging('metal-prices:GET', metalPricesGET);
export const POST = withApiLogging('metal-prices:POST', metalPricesPOST);
export const DELETE = withApiLogging('metal-prices:DELETE', metalPricesDELETE);
