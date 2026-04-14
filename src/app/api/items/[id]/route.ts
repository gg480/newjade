import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.item.findUnique({
    where: { id: parseInt(id) },
    include: {
      material: true,
      type: true,
      batch: { include: { material: true, supplier: true } },
      supplier: true,
      spec: true,
      tags: true,
      images: true,
      saleRecords: { include: { customer: true } },
    },
  });
  if (!item || item.isDeleted) {
    return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });
  }

  const today = new Date();
  // For batch items, inherit purchaseDate from batch
  const effectivePurchaseDate = item.purchaseDate || item.batch?.purchaseDate || null;
  const ageDays = effectivePurchaseDate
    ? Math.floor((today.getTime() - new Date(effectivePurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  // For batch items, inherit supplier from batch
  const supplierName = item.supplier?.name || item.batch?.supplier?.name || null;

  return NextResponse.json({
    code: 0,
    data: {
      ...item,
      purchaseDate: effectivePurchaseDate,
      materialName: item.material?.name,
      typeName: item.type?.name,
      supplierName,
      ageDays,
      coverImage: item.images.find(i => i.isCover)?.filename || item.images[0]?.filename || null,
    },
    message: 'ok',
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { tagIds, spec, ...data } = body;

  try {
    // Get original item for logging
    const original = await db.item.findUnique({ where: { id: parseInt(id) } });

    // Update tags if provided
    if (tagIds !== undefined) {
      await db.itemTag.deleteMany({ where: { itemId: parseInt(id) } });
      if (tagIds.length > 0) {
        await db.itemTag.createMany({ data: tagIds.map((tid: number) => ({ itemId: parseInt(id), tagId: tid })) });
      }
    }

    // Update spec if provided
    if (spec) {
      await db.itemSpec.upsert({
        where: { itemId: parseInt(id) },
        update: spec,
        create: { itemId: parseInt(id), ...spec },
      });
    }

    const item = await db.item.update({
      where: { id: parseInt(id) },
      data,
      include: { material: true, type: true, spec: true, tags: true },
    });

    // Log edit_item with changed fields
    if (original) {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const trackedFields = ['skuCode', 'name', 'materialId', 'typeId', 'costPrice', 'allocatedCost', 'sellingPrice', 'floorPrice', 'status', 'counter', 'origin', 'certNo', 'notes', 'supplierId', 'purchaseDate'];
      for (const field of trackedFields) {
        const oldVal = (original as any)[field];
        const newVal = (item as any)[field];
        if (oldVal !== newVal) {
          changes[field] = { from: oldVal, to: newVal };
        }
      }
      if (Object.keys(changes).length > 0) {
        await logAction('edit_item', 'item', item.id, changes);
      }
    }

    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `更新失败: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hardDelete = searchParams.get('hard') === 'true';
  try {
    const item = await db.item.findUnique({ where: { id: parseInt(id) } });
    if (!item) {
      return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });
    }
    if (hardDelete) {
      await db.item.delete({ where: { id: parseInt(id) } });
    } else {
      await db.item.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    }

    // Log delete_item
    if (item) {
      await logAction('delete_item', 'item', item.id, {
        skuCode: item.skuCode,
        name: item.name,
        status: item.status,
        hardDelete,
      });
    }

    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `删除失败: ${e.message}` }, { status: 500 });
  }
}
