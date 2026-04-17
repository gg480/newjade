import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

// POST /api/items/batch — Batch create items (legacy, supports both batchId FK and batchCode string)
export async function POST(req: Request) {
  const body = await req.json();
  const { materialId, typeId, supplierId, skuPrefix, quantity, batchCode, batchId, costPrice, sellingPrice, counter, weight, size, purchaseDate, tagIds } = body;

  // Build spec data with proper types
  const specCreate: any = {};
  if (weight != null && weight !== '') specCreate.weight = parseFloat(weight);
  if (size != null && size !== '') specCreate.size = String(size);

  try {
    // Resolve batch FK: prefer batchId (FK), fallback to batchCode lookup
    let resolvedBatchId: number | null = batchId ? parseInt(batchId) : null;
    let resolvedBatchCode: string | null = batchCode || null;

    if (!resolvedBatchId && resolvedBatchCode) {
      const batch = await db.batch.findUnique({ where: { batchCode: resolvedBatchCode } });
      if (batch) resolvedBatchId = batch.id;
    }
    if (resolvedBatchId && !resolvedBatchCode) {
      const batch = await db.batch.findUnique({ where: { id: resolvedBatchId } });
      if (batch) resolvedBatchCode = batch.batchCode;
    }

    const mCode = String(parsedMaterialId).padStart(2, '0');
    const tCode = parsedTypeId ? String(parsedTypeId).padStart(2, '0') : '00';
    const dateStr = String(new Date().getMonth() + 1).padStart(2, '0') + String(new Date().getDate()).padStart(2, '0');
    const parsedQuantity = parseInt(quantity);
    const parsedMaterialId = parseInt(materialId);
    const parsedTypeId = typeId ? parseInt(typeId) : null;
    const parsedCostPrice = costPrice != null && costPrice !== '' ? parseFloat(costPrice) : null;
    const parsedSellingPrice = sellingPrice != null ? parseFloat(sellingPrice) : null;
    const parsedCounter = counter != null ? parseInt(counter) : null;
    const parsedSupplierId = supplierId ? parseInt(supplierId) : null;

    if (!materialId || isNaN(parsedMaterialId)) {
      return NextResponse.json({ code: 400, data: null, message: '请选择材质' }, { status: 400 });
    }
    if (!typeId || isNaN(parsedTypeId!)) {
      return NextResponse.json({ code: 400, data: null, message: '请选择器型' }, { status: 400 });
    }
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json({ code: 400, data: null, message: '请输入有效的数量' }, { status: 400 });
    }

    // 计算成本价：有批次则分摊，否则要求传入
    let finalCostPrice = parsedCostPrice;
    let allocatedCost: number | null = null;
    if (resolvedBatchId) {
      const batch = await db.batch.findUnique({ where: { id: resolvedBatchId } });
      if (batch && batch.totalCost && batch.quantity > 0) {
        allocatedCost = parseFloat((batch.totalCost / batch.quantity).toFixed(2));
        if (finalCostPrice === null) finalCostPrice = allocatedCost;
      }
    }
    if (finalCostPrice === null || isNaN(finalCostPrice)) {
      return NextResponse.json({ code: 400, data: null, message: '请输入有效的成本价（或选择批次自动分摊）' }, { status: 400 });
    }

    const created = [];
    for (let i = 0; i < parsedQuantity; i++) {
      const seq = String(i + 1).padStart(3, '0');
      const skuCode = `${mCode}${tCode}-${dateStr}-${seq}`;

      const item = await db.item.create({
        data: {
          skuCode,
          batchCode: resolvedBatchCode,
          batchId: resolvedBatchId,
          materialId: parsedMaterialId,
          typeId: parsedTypeId,
          costPrice: finalCostPrice,
          allocatedCost,
          sellingPrice: parsedSellingPrice,
          origin: null,
          counter: parsedCounter,
          supplierId: parsedSupplierId,
          purchaseDate,
          status: 'in_stock',
          ...(tagIds?.length ? { tags: { connect: tagIds.map((id: any) => ({ id: parseInt(id) })) } } : {}),
          ...(Object.keys(specCreate).length > 0 ? { spec: { create: specCreate } } : {}),
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
