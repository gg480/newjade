import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const materialId = searchParams.get('material_id');
  const typeId = searchParams.get('type_id');
  const status = searchParams.get('status');
  const batchId = searchParams.get('batch_id');
  const counter = searchParams.get('counter');
  const keyword = searchParams.get('keyword');
  const searchField = searchParams.get('search_field');
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  const where: any = { isDeleted: false };
  if (materialId) where.materialId = parseInt(materialId);
  if (typeId) where.typeId = parseInt(typeId);
  if (status) where.status = status;
  if (batchId) where.batchId = parseInt(batchId);
  if (counter) where.counter = parseInt(counter);
  if (keyword) {
    if (searchField === 'sku') {
      where.skuCode = { contains: keyword };
    } else if (searchField === 'name') {
      where.name = { contains: keyword };
    } else if (searchField === 'material') {
      where.material = { name: { contains: keyword } };
    } else if (searchField === 'type') {
      where.type = { name: { contains: keyword } };
    } else {
      where.OR = [
        { skuCode: { contains: keyword } },
        { name: { contains: keyword } },
        { certNo: { contains: keyword } },
        { notes: { contains: keyword } },
      ];
    }
  }

  // Build order by clause
  const validSortFields = ['created_at', 'selling_price', 'cost_price', 'purchase_date', 'sku_code', 'name'];
  const field = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const direction = sortOrder === 'asc' ? 'asc' : 'desc';

  // Map field names to Prisma field names
  const fieldMap: Record<string, string> = {
    created_at: 'createdAt',
    selling_price: 'sellingPrice',
    cost_price: 'costPrice',
    purchase_date: 'purchaseDate',
    sku_code: 'skuCode',
    name: 'name',
  };
  const orderByField = fieldMap[field] || 'createdAt';
  const orderBy: any = {};
  orderBy[orderByField] = direction;

  const total = await db.item.count({ where });
  const items = await db.item.findMany({
    where,
    include: {
      material: true,
      type: true,
      spec: true,
      tags: true,
      images: { where: { isCover: true }, take: 1 },
      batch: { select: { purchaseDate: true, batchCode: true, totalCost: true, quantity: true } },
    },
    orderBy,
    skip: (page - 1) * size,
    take: size,
  });

  const today = new Date();
  const itemsWithExtras = items.map(item => {
    // For batch items, inherit purchaseDate from batch
    const effectivePurchaseDate = item.purchaseDate || item.batch?.purchaseDate || null;
    const ageDays = effectivePurchaseDate
      ? Math.floor((today.getTime() - new Date(effectivePurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    // For batch items without allocated cost, show estimated cost
    const estimatedCost = (!item.allocatedCost && item.batchId && item.batch)
      ? Math.round((item.batch.totalCost / item.batch.quantity) * 100) / 100
      : null;
    return {
      ...item,
      purchaseDate: effectivePurchaseDate,
      materialName: item.material?.name,
      typeName: item.type?.name,
      ageDays,
      coverImage: item.images[0]?.filename || null,
      estimatedCost,
    };
  });

  return NextResponse.json({
    code: 0,
    data: {
      items: itemsWithExtras,
      pagination: { total, page, size, pages: Math.ceil(total / size) },
    },
    message: 'ok',
  });
}

// Auto-generate SKU code
async function generateSkuCode(materialId: number): Promise<string> {
  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  const prefix = material ? material.name.slice(0, 2) : 'XX';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefixFull = `${prefix}-${dateStr}-`;

  // Find the latest SKU with this prefix
  const lastItem = await db.item.findFirst({
    where: { skuCode: { startsWith: prefixFull } },
    orderBy: { skuCode: 'desc' },
  });

  let seq = 1;
  if (lastItem) {
    const parts = lastItem.skuCode.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefixFull}${String(seq).padStart(3, '0')}`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { skuCode, name, batchId, materialId, typeId, costPrice, sellingPrice, floorPrice, origin, counter, certNo, notes, supplierId, purchaseDate, tagIds, spec } = body;

  try {
    // For batch items, get materialId from batch if not provided
    let finalMaterialId = materialId;
    let batchData: any = null;
    if (batchId && !materialId) {
      batchData = await db.batch.findUnique({ where: { id: batchId }, include: { material: true } });
      if (batchData) finalMaterialId = batchData.materialId;
    }

    // Auto-generate SKU if not provided
    const finalSkuCode = skuCode || await generateSkuCode(finalMaterialId);

    // For batch items, allocatedCost will be set after allocation; for high-value items, allocatedCost = costPrice
    const allocatedCost = !batchId && costPrice ? costPrice : null;

    // Convert spec fields to proper types
    const specData: any = spec ? { ...spec } : null;
    if (specData) {
      if (specData.weight != null && specData.weight !== '') specData.weight = parseFloat(specData.weight);
      else delete specData.weight;
      if (specData.metalWeight != null && specData.metalWeight !== '') specData.metalWeight = parseFloat(specData.metalWeight);
      else delete specData.metalWeight;
      if (specData.beadCount != null && specData.beadCount !== '') specData.beadCount = parseInt(specData.beadCount);
      else delete specData.beadCount;
    }

    const item = await db.item.create({
      data: {
        skuCode: finalSkuCode,
        name,
        batchCode: batchId ? (await db.batch.findUnique({ where: { id: batchId } }))?.batchCode : null,
        batchId: batchId || null,
        materialId: finalMaterialId,
        typeId: typeId || null,
        costPrice: costPrice ?? null,
        allocatedCost,
        sellingPrice,
        floorPrice: floorPrice ?? null,
        origin: origin || null,
        counter: counter ? parseInt(counter) : null,
        certNo: certNo || null,
        notes: notes || null,
        supplierId: supplierId || null,
        purchaseDate: purchaseDate || null,
        status: 'in_stock',
        ...(tagIds?.length ? {
          tags: { connect: tagIds.map((id: number) => ({ id })) },
        } : {}),
        ...(specData && Object.keys(specData).length > 0 ? {
          spec: { create: specData },
        } : {}),
      },
      include: { material: true, type: true, spec: true, tags: true },
    });

    // Log create_item
    await logAction('create_item', 'item', item.id, {
      skuCode: item.skuCode,
      name: item.name,
      materialId: finalMaterialId,
      costPrice: costPrice ?? null,
      sellingPrice,
    });

    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      return NextResponse.json({ code: 400, data: null, message: 'SKU编号已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: `创建失败: ${e.message}` }, { status: 500 });
  }
}
