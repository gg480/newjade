import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

// POST /api/items/batch — Batch create items (legacy, supports both batchId FK and batchCode string)
export async function POST(req: Request) {
  const body = await req.json();
  const { materialId, typeId, supplierId, skuPrefix, quantity, batchCode, batchId, costPrice, sellingPrice, counter, weight, size, purchaseDate, tagIds } = body;

  try {
    // Resolve batch FK: prefer batchId (FK), fallback to batchCode lookup
    let resolvedBatchId: number | null = batchId || null;
    let resolvedBatchCode: string | null = batchCode || null;

    if (!resolvedBatchId && resolvedBatchCode) {
      const batch = await db.batch.findUnique({ where: { batchCode: resolvedBatchCode } });
      if (batch) resolvedBatchId = batch.id;
    }
    if (resolvedBatchId && !resolvedBatchCode) {
      const batch = await db.batch.findUnique({ where: { id: resolvedBatchId } });
      if (batch) resolvedBatchCode = batch.batchCode;
    }

    const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
    const prefix = skuPrefix || (material ? material.name.slice(0, 2) : 'XX');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const created = [];
    for (let i = 0; i < quantity; i++) {
      const seq = String(i + 1).padStart(3, '0');
      const skuCode = `${prefix}-${dateStr}-${seq}`;

      const item = await db.item.create({
        data: {
          skuCode,
          batchCode: resolvedBatchCode,
          batchId: resolvedBatchId,
          materialId,
          typeId,
          costPrice: costPrice || null,
          sellingPrice,
          origin: material?.origin,
          counter: counter ? parseInt(counter) : null,
          supplierId,
          purchaseDate,
          status: 'in_stock',
          ...(tagIds?.length ? { tags: { connect: tagIds.map((id: number) => ({ id })) } } : {}),
          ...(weight || size ? { spec: { create: { weight, size } } } : {}),
        },
      });
      created.push(item);
    }

    // Log batch creation
    await logAction('batch_create_items', 'batch', resolvedBatchId, {
      batchCode: resolvedBatchCode,
      quantity: created.length,
    });

    return NextResponse.json({ code: 0, data: { created: created.length, items: created }, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `批量创建失败: ${e.message}` }, { status: 500 });
  }
}
