import { db } from '@/lib/db';
import { logAction } from '@/lib/log';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { validateTagMaterialCompatibility } from '@/lib/tag-utils';

// ============================================================
// 类型定义
// ============================================================

/** 货品列表查询参数 */
export interface GetItemsParams {
  page?: number;
  size?: number;
  materialId?: string | null;
  typeId?: string | null;
  status?: string | null;
  batchId?: string | null;
  counter?: string | null;
  keyword?: string | null;
  searchField?: string | null;
  sortBy?: string;
  sortOrder?: string;
}

/** 创建货品参数 */
export interface CreateItemInput {
  skuCode?: string | null;
  name?: string | null;
  batchId?: number | null;
  materialId?: number | null;
  typeId?: number | null;
  costPrice?: number | string | null;
  sellingPrice?: number | string | null;
  floorPrice?: number | string | null;
  origin?: string | null;
  counter?: number | string | null;
  certNo?: string | null;
  notes?: string | null;
  supplierId?: number | string | null;
  purchaseDate?: string | null;
  tagIds?: (number | string)[];
  spec?: Record<string, unknown> | null;
}

/** 更新货品参数 */
export interface UpdateItemInput {
  tagIds?: (number | string)[];
  spec?: Record<string, unknown> | null;
  status?: string;
  materialId?: number | string;
  typeId?: number | string;
  costPrice?: number | string;
  sellingPrice?: number | string;
  floorPrice?: number | string;
  counter?: number | string;
  supplierId?: number | string;
  batchId?: number | string;
  origin?: string;
  certNo?: string;
  notes?: string;
  purchaseDate?: string;
  name?: string;
  skuCode?: string;
}

/** 批量创建货品参数 */
export interface BatchCreateInput {
  materialId: number;
  typeId?: number | null;
  supplierId?: number | null;
  skuPrefix?: string | null;
  quantity: number;
  batchCode?: string | null;
  batchId?: number | null;
  costPrice?: number | string | null;
  sellingPrice?: number | string | null;
  counter?: number | string | null;
  weight?: number | string | null;
  size?: string | null;
  purchaseDate?: string | null;
  tagIds?: (number | string)[];
}

// ============================================================
// 内部辅助函数
// ============================================================

/**
 * 自动生成 SKU 编码（纯 ASCII 格式，条码兼容）
 * 格式：{材质ID2位}{器型ID2位}-{MMDD}-{序号3位}，如 0601-0417-001
 */
async function generateSkuCode(materialId: number, typeId?: number): Promise<string> {
  const mCode = String(materialId).padStart(2, '0');
  const tCode = typeId ? String(typeId).padStart(2, '0') : '00';
  const today = new Date();
  const dateStr = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const prefixFull = `${mCode}${tCode}-${dateStr}-`;

  // 查找该前缀下最新 SKU
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

/**
 * 批次成本分摊：当批次下货品数量与批次 quantity 一致时自动触发
 * 支持 equal / by_weight / by_price 三种分摊方式
 */
async function allocateBatchCostsIfReady(batchId: number): Promise<void> {
  const batch = await db.batch.findUnique({ where: { id: batchId } });
  if (!batch) return;

  const items = await db.item.findMany({
    where: { batchId, isDeleted: false },
    include: { spec: true },
    orderBy: { id: 'asc' },
  });

  if (items.length !== batch.quantity || items.length === 0) {
    return;
  }

  let allocatedCosts: number[] = [];

  if (batch.costAllocMethod === 'equal') {
    const perItem = Math.floor((batch.totalCost / batch.quantity) * 100) / 100;
    const remainder = Math.round((batch.totalCost - perItem * batch.quantity) * 100) / 100;
    allocatedCosts = items.map((_, i) => (i === items.length - 1 ? perItem + remainder : perItem));
  } else if (batch.costAllocMethod === 'by_weight') {
    const weights = items.map(item => item.spec?.weight || 0);
    if (weights.some(w => w <= 0)) return;
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return;
    let sumAllocated = 0;
    allocatedCosts = items.map((item, i) => {
      const w = item.spec?.weight || 0;
      const cost = i === items.length - 1
        ? Math.round((batch.totalCost - sumAllocated) * 100) / 100
        : Math.round((w / totalWeight) * batch.totalCost * 100) / 100;
      sumAllocated += cost;
      return cost;
    });
  } else if (batch.costAllocMethod === 'by_price') {
    const prices = items.map(item => item.sellingPrice || 0);
    const totalSelling = prices.reduce((a, b) => a + b, 0);
    if (totalSelling === 0) return;
    let sumAllocated = 0;
    allocatedCosts = items.map((item, i) => {
      const currentSelling = item.sellingPrice || 0;
      const cost = i === items.length - 1
        ? Math.round((batch.totalCost - sumAllocated) * 100) / 100
        : Math.round((currentSelling / totalSelling) * batch.totalCost * 100) / 100;
      sumAllocated += cost;
      return cost;
    });
  } else {
    return;
  }

  const configs = await db.sysConfig.findMany();
  const configMap = Object.fromEntries(configs.map(c => [c.key, parseFloat(c.value)]));
  const operatingCostRate = configMap['operating_cost_rate'] || 0.05;
  const markupRate = configMap['markup_rate'] || 0.30;

  for (let i = 0; i < items.length; i++) {
    const allocatedCost = allocatedCosts[i];
    const floorPrice = Math.round(allocatedCost * (1 + operatingCostRate) * 100) / 100;
    await db.item.update({
      where: { id: items[i].id },
      data: {
        allocatedCost,
        floorPrice,
        // 人工输入售价保持不变
      },
    });
  }
}

/** 规格字段类型转换辅助 */
function normalizeSpecData(spec: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!spec) return null;
  const specData: Record<string, unknown> = { ...spec };
  // Float 字段
  if (specData.weight != null && specData.weight !== '') specData.weight = parseFloat(specData.weight as string);
  else delete specData.weight;
  if (specData.metalWeight != null && specData.metalWeight !== '') specData.metalWeight = parseFloat(specData.metalWeight as string);
  else delete specData.metalWeight;
  // Int 字段
  if (specData.beadCount != null && specData.beadCount !== '') specData.beadCount = parseInt(specData.beadCount as string);
  else delete specData.beadCount;
  // String 字段
  for (const key of ['braceletSize', 'ringSize', 'beadDiameter', 'size']) {
    if (specData[key] != null && specData[key] !== '') {
      specData[key] = String(specData[key]);
    } else {
      delete specData[key];
    }
  }
  return Object.keys(specData).length > 0 ? specData : null;
}

/** 状态迁移校验 */
function isValidStatusTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed: Record<string, Set<string>> = {
    in_stock: new Set(['sold', 'returned']),
    sold: new Set(['returned']),
    returned: new Set(['in_stock']),
  };
  return allowed[from]?.has(to) ?? false;
}

// ============================================================
// 服务方法
// ============================================================

/**
 * 查询货品列表（多条件筛选 + 分页 + 排序 + 汇总统计）
 */
export async function getItems(params: GetItemsParams) {
  const page = params.page || 1;
  const size = params.size || 20;
  const materialId = params.materialId;
  const typeId = params.typeId;
  const status = params.status;
  const batchId = params.batchId;
  const counter = params.counter;
  const keyword = params.keyword;
  const searchField = params.searchField;
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';

  const baseWhere: any = { isDeleted: false };
  if (materialId) baseWhere.materialId = parseInt(materialId);
  if (typeId) baseWhere.typeId = parseInt(typeId);
  if (batchId) baseWhere.batchId = parseInt(batchId);
  if (counter) baseWhere.counter = parseInt(counter);
  if (keyword) {
    if (searchField === 'sku') {
      baseWhere.skuCode = { contains: keyword };
    } else if (searchField === 'name') {
      baseWhere.name = { contains: keyword };
    } else if (searchField === 'material') {
      baseWhere.material = { name: { contains: keyword } };
    } else if (searchField === 'type') {
      baseWhere.type = { name: { contains: keyword } };
    } else {
      baseWhere.OR = [
        { skuCode: { contains: keyword } },
        { name: { contains: keyword } },
        { certNo: { contains: keyword } },
        { notes: { contains: keyword } },
      ];
    }
  }
  const where: any = { ...baseWhere };
  if (status) where.status = status;

  // 构建排序
  const validSortFields = ['created_at', 'selling_price', 'cost_price', 'purchase_date', 'sku_code', 'name'];
  const field = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const direction = sortOrder === 'asc' ? 'asc' : 'desc';

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

  const [total, items, summaryRows] = await Promise.all([
    db.item.count({ where }),
    db.item.findMany({
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
    }),
    db.item.findMany({
      where: baseWhere,
      select: {
        status: true,
        sellingPrice: true,
        costPrice: true,
        allocatedCost: true,
        batchId: true,
        batch: { select: { totalCost: true, quantity: true } },
      },
    }),
  ]);

  const today = new Date();
  const itemsWithExtras = items.map(item => {
    const effectivePurchaseDate = item.purchaseDate || item.batch?.purchaseDate || null;
    const ageDays = effectivePurchaseDate
      ? Math.floor((today.getTime() - new Date(effectivePurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
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

  const summary = summaryRows.reduce((acc, row) => {
    if (row.status === 'in_stock') acc.statusCounts.in_stock += 1;
    else if (row.status === 'sold') acc.statusCounts.sold += 1;
    else if (row.status === 'returned') acc.statusCounts.returned += 1;

    const estimatedCost = (!row.allocatedCost && row.batchId && row.batch && row.batch.quantity > 0)
      ? row.batch.totalCost / row.batch.quantity
      : null;
    const rowCost = row.allocatedCost ?? estimatedCost ?? row.costPrice ?? 0;
    acc.totalCost += rowCost;
    acc.totalMarketValue += row.sellingPrice ?? 0;
    return acc;
  }, {
    statusCounts: { in_stock: 0, sold: 0, returned: 0 },
    totalCost: 0,
    totalMarketValue: 0,
  });

  return {
    items: itemsWithExtras,
    pagination: { total, page, size, pages: Math.ceil(total / size) },
    summary,
  };
}

/**
 * 创建单个货品（高货模式/通货模式分流）
 * @throws {ValidationError} 参数校验失败
 */
export async function createItem(body: CreateItemInput) {
  const { skuCode, name, batchId, materialId, typeId, costPrice, sellingPrice, floorPrice, origin, counter, certNo, notes, supplierId, purchaseDate, tagIds, spec } = body;

  // 通货模式：从批次获取 materialId
  let finalMaterialId = materialId;
  let batchData: any = null;
  if (batchId && !materialId) {
    batchData = await db.batch.findUnique({ where: { id: batchId }, include: { material: true } });
    if (batchData) finalMaterialId = batchData.materialId;
  }

  // 校验必填字段
  if (!finalMaterialId) {
    throw new ValidationError('请选择材质');
  }
  if (!typeId) {
    throw new ValidationError('请选择器型');
  }

  // 校验标签-材质兼容性
  const normalizedTagIds = Array.isArray(tagIds)
    ? tagIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !Number.isNaN(id))
    : [];
  const invalidTagData = await validateTagMaterialCompatibility(normalizedTagIds, finalMaterialId);
  if (invalidTagData) {
    const err = new ValidationError('TAG_MATERIAL_MISMATCH');
    (err as any).tagData = invalidTagData;
    throw err;
  }

  // 高货模式(无batchId)才校验成本价必填
  if (!batchId && (costPrice == null || costPrice === '' || isNaN(parseFloat(String(costPrice))))) {
    throw new ValidationError('请输入有效的成本价');
  }

  // SKU：自动生成 或 校验无中文
  if (skuCode && /[^\x00-\x7F]/.test(skuCode)) {
    throw new ValidationError('SKU编码不允许包含中文字符');
  }
  const finalSkuCode = skuCode || await generateSkuCode(finalMaterialId, typeId);

  // 计算成本
  let allocatedCost: number | null = null;
  let finalCostPrice: number | null = costPrice != null && costPrice !== '' ? parseFloat(String(costPrice)) : null;
  if (batchId) {
    // 通货模式：从批次分摊成本
    if (!batchData) {
      batchData = await db.batch.findUnique({ where: { id: batchId }, include: { material: true } });
    }
    if (batchData && batchData.totalCost && batchData.quantity > 0) {
      allocatedCost = parseFloat((batchData.totalCost / batchData.quantity).toFixed(2));
      if (finalCostPrice === null) finalCostPrice = allocatedCost;
    }
  } else {
    // 高货模式
    allocatedCost = finalCostPrice;
  }

  // 转换规格字段类型
  const specData = normalizeSpecData(spec);

  try {
    const item = await db.item.create({
      data: {
        skuCode: finalSkuCode,
        name,
        batchCode: batchId ? (await db.batch.findUnique({ where: { id: batchId } }))?.batchCode : null,
        batchId: batchId || null,
        materialId: finalMaterialId || null,
        typeId: typeId || null,
        costPrice: finalCostPrice,
        allocatedCost,
        sellingPrice: sellingPrice != null ? parseFloat(String(sellingPrice)) : null,
        floorPrice: floorPrice != null ? parseFloat(String(floorPrice)) : null,
        origin: origin || null,
        counter: counter != null ? parseInt(String(counter)) : null,
        certNo: certNo || null,
        notes: notes || null,
        supplierId: supplierId ? parseInt(String(supplierId)) : null,
        purchaseDate: purchaseDate || null,
        status: 'in_stock',
        ...(normalizedTagIds.length ? {
          tags: { connect: normalizedTagIds.map(id => ({ id })) },
        } : {}),
        ...(specData ? {
          spec: { create: specData },
        } : {}),
      },
      include: { material: true, type: true, spec: true, tags: true },
    });

    // 操作日志
    await logAction('create_item', 'item', item.id, {
      skuCode: item.skuCode,
      name: item.name,
      materialId: finalMaterialId,
      costPrice: costPrice ?? null,
      sellingPrice,
    });

    // 自动触发批次分摊
    if (item.batchId) {
      await allocateBatchCostsIfReady(item.batchId);
    }

    return item;
  } catch (e: any) {
    if (e instanceof ValidationError) throw e;
    if (e.message?.includes('Unique')) {
      throw new ValidationError('SKU编号已存在');
    }
    throw e;
  }
}

/**
 * 查询单件货品详情（含材质/器型/批次/供应商/规格/标签/图片/销售记录等关联数据）
 * @throws {NotFoundError} 货品不存在或已删除
 */
export async function getItemById(id: number) {
  const item = await db.item.findUnique({
    where: { id },
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
    throw new NotFoundError('未找到');
  }

  const today = new Date();
  const effectivePurchaseDate = item.purchaseDate || item.batch?.purchaseDate || null;
  const ageDays = effectivePurchaseDate
    ? Math.floor((today.getTime() - new Date(effectivePurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const supplierName = item.supplier?.name || item.batch?.supplier?.name || null;

  return {
    ...item,
    images: (item.images || []).map((img: any) => ({
      ...img,
      url: img.filename,
    })),
    purchaseDate: effectivePurchaseDate,
    materialName: item.material?.name,
    typeName: item.type?.name,
    supplierName,
    ageDays,
    coverImage: item.images.find((i: any) => i.isCover)?.filename || item.images[0]?.filename || null,
  };
}

/**
 * 更新货品（价格/规格/状态/柜台等）
 * @throws {NotFoundError} 货品不存在或已删除
 * @throws {ValidationError} 参数校验失败、状态迁移非法
 */
export async function updateItem(id: number, body: UpdateItemInput) {
  const { tagIds, spec, ...data } = body;

  // 获取原始记录
  const original = await db.item.findUnique({ where: { id } });
  if (!original || original.isDeleted) {
    throw new NotFoundError('未找到');
  }

  // 状态迁移校验
  if (data.status !== undefined && !isValidStatusTransition(original.status, String(data.status))) {
    throw new ValidationError(`不允许的状态迁移: ${original.status} -> ${data.status}`);
  }

  // 标签-材质兼容性校验
  const parsedMaterialId = data.materialId != null ? parseInt(String(data.materialId), 10) : null;
  const effectiveMaterialId = parsedMaterialId != null && !Number.isNaN(parsedMaterialId)
    ? parsedMaterialId
    : original.materialId;
  if (tagIds !== undefined) {
    const normalizedTagIds = Array.isArray(tagIds)
      ? tagIds.map((tid: any) => parseInt(tid, 10)).filter((tid: number) => !Number.isNaN(tid))
      : [];
    const invalidTagData = await validateTagMaterialCompatibility(normalizedTagIds, effectiveMaterialId);
    if (invalidTagData) {
      const err = new ValidationError('TAG_MATERIAL_MISMATCH');
      (err as any).tagData = invalidTagData;
      throw err;
    }
  }

  // 更新标签
  if (tagIds !== undefined) {
    await db.itemTag.deleteMany({ where: { itemId: id } });
    const normalizedTagIds = Array.isArray(tagIds)
      ? tagIds.map((tid: any) => parseInt(tid, 10)).filter((tid: number) => !Number.isNaN(tid))
      : [];
    if (normalizedTagIds.length > 0) {
      await db.itemTag.createMany({ data: normalizedTagIds.map((tid: number) => ({ itemId: id, tagId: tid })) });
    }
  }

  // 更新规格
  if (spec) {
    const specData = normalizeSpecData(spec);
    if (specData) {
      await db.itemSpec.upsert({
        where: { itemId: id },
        update: specData,
        create: { itemId: id, ...specData },
      });
    }
  }

  const item = await db.item.update({
    where: { id },
    data: {
      ...data,
      counter: data.counter != null ? parseInt(String(data.counter)) : undefined,
      costPrice: data.costPrice != null ? parseFloat(String(data.costPrice)) : undefined,
      sellingPrice: data.sellingPrice != null ? parseFloat(String(data.sellingPrice)) : undefined,
      floorPrice: data.floorPrice != null ? parseFloat(String(data.floorPrice)) : undefined,
      materialId: data.materialId != null ? parseInt(String(data.materialId)) : undefined,
      typeId: data.typeId != null ? parseInt(String(data.typeId)) : undefined,
      supplierId: data.supplierId != null ? parseInt(String(data.supplierId)) : undefined,
      batchId: data.batchId != null ? parseInt(String(data.batchId)) : undefined,
    },
    include: { material: true, type: true, spec: true, tags: true },
  });

  // 操作日志：记录变更字段
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

  return item;
}

/**
 * 删除货品（软删除或物理删除）
 * @throws {NotFoundError} 货品不存在
 */
export async function deleteItem(id: number, hardDelete = false) {
  const item = await db.item.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundError('未找到');
  }

  if (hardDelete) {
    await db.item.delete({ where: { id } });
  } else {
    await db.item.update({ where: { id }, data: { isDeleted: true } });
  }

  // 操作日志
  await logAction('delete_item', 'item', item.id, {
    skuCode: item.skuCode,
    name: item.name,
    status: item.status,
    hardDelete,
  });
}

/**
 * 批量创建货品（支持批次关联、自动 SKU 生成）
 * @throws {ValidationError} 参数校验失败
 */
export async function batchCreateItems(body: BatchCreateInput) {
  const { materialId, typeId, supplierId, skuPrefix, quantity, batchCode, batchId, costPrice, sellingPrice, counter, weight, size, purchaseDate, tagIds } = body;

  // 构建规格数据
  const specCreate: any = {};
  if (weight != null && weight !== '') specCreate.weight = parseFloat(String(weight));
  if (size != null && size !== '') specCreate.size = String(size);

  // 解析批次关联
  let resolvedBatchId: number | null = batchId ? parseInt(String(batchId)) : null;
  let resolvedBatchCode: string | null = batchCode || null;

  if (!resolvedBatchId && resolvedBatchCode) {
    const batch = await db.batch.findUnique({ where: { batchCode: resolvedBatchCode } });
    if (batch) resolvedBatchId = batch.id;
  }
  if (resolvedBatchId && !resolvedBatchCode) {
    const batch = await db.batch.findUnique({ where: { id: resolvedBatchId } });
    if (batch) resolvedBatchCode = batch.batchCode;
  }

  // 解析参数（先声明后使用）
  const parsedMaterialId = parseInt(String(materialId));
  const parsedTypeId = typeId ? parseInt(String(typeId)) : null;
  const parsedQuantity = parseInt(String(quantity));
  const parsedCostPrice = costPrice != null && costPrice !== '' ? parseFloat(String(costPrice)) : null;
  const parsedSellingPrice = sellingPrice != null ? parseFloat(String(sellingPrice)) : null;
  const parsedCounter = counter != null ? parseInt(String(counter)) : null;
  const parsedSupplierId = supplierId ? parseInt(String(supplierId)) : null;

  if (!materialId || isNaN(parsedMaterialId)) {
    throw new ValidationError('请选择材质');
  }
  if (!typeId || isNaN(parsedTypeId!)) {
    throw new ValidationError('请选择器型');
  }
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    throw new ValidationError('请输入有效的数量');
  }

  // SKU 前缀
  const mCode = String(parsedMaterialId).padStart(2, '0');
  const tCode = parsedTypeId ? String(parsedTypeId).padStart(2, '0') : '00';
  const dateStr = String(new Date().getMonth() + 1).padStart(2, '0') + String(new Date().getDate()).padStart(2, '0');

  // 计算成本价
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
    throw new ValidationError('请输入有效的成本价（或选择批次自动分摊）');
  }

  const created: any[] = [];
  try {
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
          ...(tagIds?.length ? { tags: { connect: tagIds.map((id: any) => ({ id: parseInt(String(id)) })) } } : {}),
          ...(Object.keys(specCreate).length > 0 ? { spec: { create: specCreate } } : {}),
        },
      });
      created.push(item);
    }

    // 操作日志
    await logAction('batch_create_items', 'batch', resolvedBatchId, {
      batchCode: resolvedBatchCode,
      quantity: created.length,
    });

    return { created: created.length, items: created };
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      throw new ValidationError('SKU编号已存在');
    }
    throw e;
  }
}
