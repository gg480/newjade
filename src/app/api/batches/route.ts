import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import * as batchesService from '@/services/batches.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const materialId = searchParams.get('material_id');

  try {
    const data = await batchesService.getBatches({ page, size, materialId });
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '获取失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { batchCode, materialId, typeId, quantity, totalCost, costAllocMethod, supplierId, purchaseDate, notes } = body;

  try {
    const batch = await batchesService.createBatch({
      batchCode: batchCode || null,
      materialId: parseInt(materialId),
      typeId: typeId ? parseInt(typeId) : null,
      quantity: parseInt(quantity),
      totalCost: parseFloat(totalCost),
      costAllocMethod,
      supplierId: supplierId ? parseInt(supplierId) : null,
      purchaseDate,
      notes,
    });
    return NextResponse.json({ code: 0, data: batch, message: 'ok' });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
