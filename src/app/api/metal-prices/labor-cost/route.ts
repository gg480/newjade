import { NextResponse } from 'next/server';
import { updateLaborCostPerGram } from '@/services/metal-prices.service';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { AppError, ValidationError } from '@/lib/errors';

/**
 * PUT /api/metal-prices/labor-cost
 * 更新材质的工费单价
 * body: { materialId: number, laborCostPerGram: number }
 */
async function laborCostPUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.materialId !== 'number' || typeof body.laborCostPerGram !== 'number') {
      throw new ValidationError('请提供有效的 materialId 和 laborCostPerGram');
    }
    if (body.laborCostPerGram < 0) {
      throw new ValidationError('工费单价不能为负数');
    }

    await updateLaborCostPerGram(body.materialId, body.laborCostPerGram);
    return NextResponse.json({ code: 0, data: null, message: '工费单价已更新' });
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

export const PUT = withApiLogging('metal-prices:labor-cost:PUT', laborCostPUT);
