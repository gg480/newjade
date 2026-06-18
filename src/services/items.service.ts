import { Prisma } from '@prisma/client';
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
  hasTags?: string;
}

/** 货品材质组件输入（ADR-020 镶嵌型/组合型） */
export interface MaterialComponentInput {
  materialId: number;
  role: string; // main_stone / setting_material / companion_stone / component
  weight?: number | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  sortOrder?: number;
  notes?: string | null;
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
  // ADR-020: 货品类型与材质组件
  compositeType?: string; // single / inlay / composite
  components?: MaterialComponentInput[];
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
  // ADR-020: 货品类型与材质组件
  compositeType?: string;
  components?: MaterialComponentInput[];
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
 * 校验货品材质组件（ADR-020）
 * 镶嵌型(inlay): 必须有 main_stone + setting_material，companion_stone 可选
 * 组合型(composite): 至少 1 个 component
 * 单一型(single): 无组件
 */
function validateComponents(compositeType: string, components?: MaterialComponentInput[]): void {
  if (compositeType === 'single') {
    if (components && components.length > 0) {
      throw new ValidationError('单一型货品不应有材质组件');
    }
    return;
  }

  if (!components || components.length === 0) {
    throw new ValidationError(compositeType === 'inlay' ? '镶嵌型货品必须填写材质组件' : '组合型货品必须填写材质组件');
  }

  if (compositeType === 'inlay') {
    const roles = components.map(c => c.role);
    if (!roles.includes('main_stone')) {
      throw new ValidationError('镶嵌型货品必须包含主石(main_stone)');
    }
    if (!roles.includes('setting_material')) {
      throw new ValidationError('镶嵌型货品必须包含镶材(setting_material)');
    }
    // 校验角色只能是 main_stone / setting_material / companion_stone
    const validRoles = ['main_stone', 'setting_material', 'companion_stone'];
    for (const c of components) {
      if (!validRoles.includes(c.role)) {
        throw new ValidationError(`镶嵌型货品角色无效: ${c.role}，只能是 ${validRoles.join('/')}`);
      }
    }
  } else if (compositeType === 'composite') {
    // 组合型角色只能是 component
    for (const c of components) {
      if (c.role !== 'component') {
        throw new ValidationError(`组合型货品角色无效: ${c.role}，只能是 component`);
      }
    }
  }

  // ADR-020: 所有组件必须指定有效材质（防止直接调 API 写入 materialId=0 脏数据）
  for (const c of components) {
    if (!c.materialId || c.materialId <= 0) {
      throw new ValidationError('材质组件必须指定有效材质');
    }
  }
}

/**
 * 计算镶嵌型货品的动态总售价（ADR-020）
 * 总售价 = 主石售价 + 伴石售价 + 镶材克重 × 贵金属市价
 * 镶材市价从 MetalPrice 表实时查询
 */
async function calculateInlayDynamicPrice(
  components: Array<{ role: string; materialId: number; weight?: number | null; sellingPrice?: number | null }>,
): Promise<{ totalSellingPrice: number; settingMaterialPrice: number; settingMaterialWeight: number | null; settingMaterialName: string | null }> {
  // 主石售价 + 伴石售价
  const mainStone = components.find(c => c.role === 'main_stone');
  const companionStone = components.find(c => c.role === 'companion_stone');
  const settingMaterial = components.find(c => c.role === 'setting_material');

  const mainStonePrice = mainStone?.sellingPrice ?? 0;
  const companionStonePrice = companionStone?.sellingPrice ?? 0;

  // 镶材动态价格：重量 × MetalPrice 市价
  let settingMaterialPrice = 0;
  let settingMaterialName: string | null = null;
  const settingMaterialWeight = settingMaterial?.weight ?? null;

  if (settingMaterial && settingMaterialWeight && settingMaterialWeight > 0) {
    // 查询该材质的最新市价
    const latestPrice = await db.metalPrice.findFirst({
      where: { materialId: settingMaterial.materialId },
      orderBy: { effectiveDate: 'desc' },
    });
    if (latestPrice) {
      settingMaterialPrice = Math.round(settingMaterialWeight * latestPrice.pricePerGram * 100) / 100;
    }
    // 查询材质名称
    const material = await db.dictMaterial.findUnique({
      where: { id: settingMaterial.materialId },
      select: { name: true },
    });
    settingMaterialName = material?.name ?? null;
  }

  const totalSellingPrice = Math.round((mainStonePrice + companionStonePrice + settingMaterialPrice) * 100) / 100;

  return { totalSellingPrice, settingMaterialPrice, settingMaterialWeight, settingMaterialName };
}

/**
 * 生成材质显示名称（ADR-020）
 * 镶嵌型/组合型：三类材质名称用 + 连接，如"翡翠+18K金+钻石"
 */
function buildMaterialDisplayName(
  materialName: string | null | undefined,
  compositeType: string | undefined,
  components: Array<{ role: string; material?: { name: string } | null }> | undefined,
): string {
  if (!compositeType || compositeType === 'single' || !components || components.length === 0) {
    return materialName ?? '';
  }
  // 按角色顺序排列：主石 → 镶材 → 伴石（镶嵌型）或组件顺序（组合型）
  const roleOrder = ['main_stone', 'setting_material', 'companion_stone'];
  const sorted = compositeType === 'inlay'
    ? [...components].sort((a, b) => {
        const ai = roleOrder.indexOf(a.role);
        const bi = roleOrder.indexOf(b.role);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
    : components;
  const names = sorted
    .map(c => c.material?.name)
    .filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join('+') : (materialName ?? '');
}

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

  const baseWhere: Prisma.ItemWhereInput = { isDeleted: false };
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
  const where: Prisma.ItemWhereInput = { ...baseWhere };
  if (status) where.status = status;

  if (params.hasTags === 'true') {
    where.itemTags = { some: {} };
  } else if (params.hasTags === 'false') {
    where.itemTags = { none: {} };
  }

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
  const orderBy: Prisma.ItemOrderByWithRelationInput = {};
  (orderBy as Record<string, string>)[orderByField] = direction;

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
        materialComponents: { include: { material: true }, orderBy: { sortOrder: 'asc' } },
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
  // ADR-020: 镶嵌型需异步查询 MetalPrice 表计算动态售价，故使用 Promise.all
  const itemsWithExtras = await Promise.all(items.map(async item => {
    const effectivePurchaseDate = item.purchaseDate || item.batch?.purchaseDate || null;
    const ageDays = effectivePurchaseDate
      ? Math.floor((today.getTime() - new Date(effectivePurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const estimatedCost = (!item.allocatedCost && item.batchId && item.batch)
      ? Math.round((item.batch.totalCost / item.batch.quantity) * 100) / 100
      : null;

    // ADR-020: 镶嵌型动态售价 + 材质显示名
    // - materialName: 库存列表显示主石材质（Item.materialId 已同步为主石材质）
    // - materialDisplayName: 详情页/标签用，三类材质用 + 连接
    let dynamicSellingPrice = item.sellingPrice;
    let materialDisplayName = item.material?.name ?? null;
    let inlayPriceBreakdown: { settingMaterialPrice: number; settingMaterialWeight: number | null; settingMaterialName: string | null } | null = null;

    if (item.compositeType === 'inlay' && item.materialComponents && item.materialComponents.length > 0) {
      const dynamic = await calculateInlayDynamicPrice(item.materialComponents);
      dynamicSellingPrice = dynamic.totalSellingPrice;
      inlayPriceBreakdown = {
        settingMaterialPrice: dynamic.settingMaterialPrice,
        settingMaterialWeight: dynamic.settingMaterialWeight,
        settingMaterialName: dynamic.settingMaterialName,
      };
    }

    if (item.compositeType && item.compositeType !== 'single') {
      materialDisplayName = buildMaterialDisplayName(
        item.material?.name,
        item.compositeType,
        item.materialComponents,
      );
    }

    return {
      ...item,
      purchaseDate: effectivePurchaseDate,
      // 库存列表用 materialName 显示主石材质（镶嵌型已同步为主石）
      materialName: item.material?.name ?? null,
      materialDisplayName,
      typeName: item.type?.name,
      ageDays,
      coverImage: item.images[0]?.filename || null,
      estimatedCost,
      sellingPrice: dynamicSellingPrice,
      inlayPriceBreakdown,
    };
  }));

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
  const { skuCode, name, batchId, materialId, typeId, costPrice, sellingPrice, floorPrice, origin, counter, certNo, notes, supplierId, purchaseDate, tagIds, spec, compositeType, components } = body;

  // ADR-020: 确定货品类型（默认 single）
  const finalCompositeType = compositeType || 'single';
  validateComponents(finalCompositeType, components);

  // ADR-020: 镶嵌型/组合型价格汇算（组件价格 → Item 价格）
  // 成本价 = 所有组件 costPrice 之和
  // 镶嵌型售价 = 主石+伴石+镶材动态价（按 MetalPrice 实时计算）
  // 组合型售价 = 所有组件 sellingPrice 之和
  let computedCostPrice: number | null = null;
  let computedSellingPrice: number | null = null;
  if (finalCompositeType !== 'single' && components && components.length > 0) {
    const sumCost = components.reduce((sum, c) => sum + (c.costPrice ?? 0), 0);
    computedCostPrice = Math.round(sumCost * 100) / 100;

    if (finalCompositeType === 'inlay') {
      const dynamic = await calculateInlayDynamicPrice(components);
      computedSellingPrice = dynamic.totalSellingPrice;
    } else {
      const sumSelling = components.reduce((sum, c) => sum + (c.sellingPrice ?? 0), 0);
      computedSellingPrice = Math.round(sumSelling * 100) / 100;
    }
  }

  // ADR-020: 镶嵌型/组合型自动同步主材质为 Item.materialId
  // 镶嵌型取主石，组合型取首个有效组件（与前端 compositeMainMaterialId 规则一致）
  let overriddenMaterialId: number | undefined;
  if (finalCompositeType !== 'single' && components && components.length > 0) {
    if (finalCompositeType === 'inlay') {
      const mainStone = components.find(c => c.role === 'main_stone');
      if (mainStone) overriddenMaterialId = mainStone.materialId;
    } else if (finalCompositeType === 'composite') {
      const firstValid = components.find(c => c.materialId > 0);
      if (firstValid) overriddenMaterialId = firstValid.materialId;
    }
  }

  // 通货模式：从批次获取 materialId
  let finalMaterialId = overriddenMaterialId || materialId;
  let batchData: Prisma.BatchGetPayload<{ include: { material: true } }> | null = null;
  if (batchId && !finalMaterialId) {
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
    ? tagIds.map((id) => Number(id)).filter((id: number) => !Number.isNaN(id))
    : [];
  const invalidTagData = await validateTagMaterialCompatibility(normalizedTagIds, finalMaterialId);
  if (invalidTagData) {
    const err = new ValidationError('TAG_MATERIAL_MISMATCH');
    err.tagData = invalidTagData;
    throw err;
  }

  // 高货模式(无batchId)才校验成本价必填
  // ADR-020: 镶嵌型/组合型由组件汇算成本价，跳过前端传入值校验
  if (!batchId && computedCostPrice === null && (costPrice == null || costPrice === '' || isNaN(parseFloat(String(costPrice))))) {
    throw new ValidationError('请输入有效的成本价');
  }

  // SKU：自动生成 或 校验无中文
  if (skuCode && /[^\x00-\x7F]/.test(skuCode)) {
    throw new ValidationError('SKU编码不允许包含中文字符');
  }
  const finalSkuCode = skuCode || await generateSkuCode(finalMaterialId, typeId);

  // 计算成本
  let allocatedCost: number | null = null;
  // ADR-020: 镶嵌型/组合型优先用组件汇算的成本价
  let finalCostPrice: number | null = computedCostPrice != null
    ? computedCostPrice
    : (costPrice != null && costPrice !== '' ? parseFloat(String(costPrice)) : null);
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
        materialId: finalMaterialId ?? undefined,
        typeId: typeId || null,
        costPrice: finalCostPrice,
        allocatedCost,
        // ADR-020: 镶嵌型/组合型优先用组件汇算的售价
        sellingPrice: computedSellingPrice != null
          ? computedSellingPrice
          : (sellingPrice != null ? parseFloat(String(sellingPrice)) : 0),
        floorPrice: floorPrice != null ? parseFloat(String(floorPrice)) : null,
        origin: origin || null,
        counter: counter != null ? parseInt(String(counter)) : null,
        certNo: certNo || null,
        notes: notes || null,
        supplierId: supplierId ? parseInt(String(supplierId)) : null,
        purchaseDate: purchaseDate || null,
        status: 'in_stock',
        compositeType: finalCompositeType,
        ...(normalizedTagIds.length ? {
          tags: { connect: normalizedTagIds.map(id => ({ id })) },
        } : {}),
        ...(specData ? {
          spec: { create: specData },
        } : {}),
        // ADR-020: 材质组件
        ...(components && components.length > 0 ? {
          materialComponents: {
            create: components.map((c, idx) => ({
              materialId: c.materialId,
              role: c.role,
              weight: c.weight ?? null,
              costPrice: c.costPrice ?? null,
              sellingPrice: c.sellingPrice ?? null,
              sortOrder: c.sortOrder ?? idx,
              notes: c.notes ?? null,
            })),
          },
        } : {}),
      },
      include: {
        material: true,
        type: true,
        spec: true,
        tags: true,
        materialComponents: { include: { material: true }, orderBy: { sortOrder: 'asc' } },
      },
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
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    if (e instanceof Error && e.message?.includes('Unique')) {
      throw new ValidationError('SKU编号已存在');
    }
    throw e;
  }
}

/**
 * 批量补全货品数据（标签、器型、柜台、名称、底价、产地、重量）
 * 用于历史数据补全场景
 */
export async function batchCompleteItems(params: {
  ids: number[];
  materialId?: number | string;
  typeId?: number | string;
  name?: string;
  tagIds?: (number | string)[];
  counter?: number | string;
  floorPrice?: number | string;
  origin?: string;
  weight?: number | string;
}) {
  const { ids, materialId, typeId, name, tagIds, counter, floorPrice, origin, weight } = params;
  let success = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const updateData: Record<string, unknown> = {};
      if (materialId != null) updateData.materialId = Number(materialId);
      if (typeId != null) updateData.typeId = Number(typeId);
      if (name != null) updateData.name = name;
      if (counter != null) updateData.counter = Number(counter);
      if (floorPrice != null) updateData.floorPrice = Number(floorPrice);
      if (origin != null) updateData.origin = origin;

      // 更新 tags（替换全部标签）
      if (tagIds && tagIds.length > 0) {
        updateData.tags = {
          set: tagIds.map(id => ({ id: Number(id) })),
        };
      }

      // 更新 item 基本信息
      await db.item.update({
        where: { id },
        data: updateData,
      });

      // 更新规格（重量）
      if (weight != null) {
        await db.itemSpec.upsert({
          where: { itemId: id },
          create: { itemId: id, weight: Number(weight) },
          update: { weight: Number(weight) },
        });
      }

      success++;
    } catch (e) {
      failed++;
    }
  }

  return { success, failed };
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
      materialComponents: { include: { material: true }, orderBy: { sortOrder: 'asc' } },
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

  // ADR-020: 镶嵌型动态售价 + 材质显示名
  // - materialName: 主石材质（Item.materialId 已同步为主石）
  // - materialDisplayName: 详情页/标签用，三类材质用 + 连接
  let dynamicSellingPrice = item.sellingPrice;
  let materialDisplayName = item.material?.name ?? null;
  let inlayPriceBreakdown: { settingMaterialPrice: number; settingMaterialWeight: number | null; settingMaterialName: string | null } | null = null;

  if (item.compositeType === 'inlay' && item.materialComponents && item.materialComponents.length > 0) {
    const dynamic = await calculateInlayDynamicPrice(item.materialComponents);
    dynamicSellingPrice = dynamic.totalSellingPrice;
    inlayPriceBreakdown = {
      settingMaterialPrice: dynamic.settingMaterialPrice,
      settingMaterialWeight: dynamic.settingMaterialWeight,
      settingMaterialName: dynamic.settingMaterialName,
    };
  }

  if (item.compositeType && item.compositeType !== 'single') {
    materialDisplayName = buildMaterialDisplayName(
      item.material?.name,
      item.compositeType,
      item.materialComponents,
    );
  }

  return {
    ...item,
    images: (item.images || []).map((img) => ({
      ...img,
      url: img.filename,
    })),
    purchaseDate: effectivePurchaseDate,
    // 详情页 materialName 显示主石材质（镶嵌型已同步为主石）
    materialName: item.material?.name ?? null,
    materialDisplayName,
    typeName: item.type?.name,
    supplierName,
    ageDays,
    coverImage: item.images.find((i) => i.isCover)?.filename || item.images[0]?.filename || null,
    sellingPrice: dynamicSellingPrice,
    inlayPriceBreakdown,
  };
}

/**
 * 更新货品（价格/规格/状态/柜台等）
 * @throws {NotFoundError} 货品不存在或已删除
 * @throws {ValidationError} 参数校验失败、状态迁移非法
 */
export async function updateItem(id: number, body: UpdateItemInput) {
  const { tagIds, spec, components, ...data } = body;

  // 获取原始记录
  const original = await db.item.findUnique({ where: { id } });
  if (!original || original.isDeleted) {
    throw new NotFoundError('未找到');
  }

  // ADR-020: 校验材质组件
  const finalCompositeType = data.compositeType || original.compositeType;
  validateComponents(finalCompositeType, components);

  // ADR-020: 镶嵌型自动同步主石材质为 Item.materialId
  if (finalCompositeType === 'inlay' && components && components.length > 0) {
    const mainStone = components.find(c => c.role === 'main_stone');
    if (mainStone) data.materialId = mainStone.materialId;
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
      ? tagIds.map((tid) => Number(tid)).filter((tid: number) => !Number.isNaN(tid))
      : [];
    const invalidTagData = await validateTagMaterialCompatibility(normalizedTagIds, effectiveMaterialId);
    if (invalidTagData) {
      const err = new ValidationError('TAG_MATERIAL_MISMATCH');
      err.tagData = invalidTagData;
      throw err;
    }
  }

  // 更新标签
  if (tagIds !== undefined) {
    await db.itemTag.deleteMany({ where: { itemId: id } });
    const normalizedTagIds = Array.isArray(tagIds)
      ? tagIds.map((tid) => Number(tid)).filter((tid: number) => !Number.isNaN(tid))
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

  // ADR-020: 更新材质组件（全量替换）
  if (components !== undefined) {
    await db.itemMaterialComponent.deleteMany({ where: { itemId: id } });
    if (components.length > 0) {
      await db.itemMaterialComponent.createMany({
        data: components.map((c, idx) => ({
          itemId: id,
          materialId: c.materialId,
          role: c.role,
          weight: c.weight ?? null,
          costPrice: c.costPrice ?? null,
          sellingPrice: c.sellingPrice ?? null,
          sortOrder: c.sortOrder ?? idx,
          notes: c.notes ?? null,
        })),
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
    include: {
      material: true,
      type: true,
      spec: true,
      tags: true,
      materialComponents: { include: { material: true }, orderBy: { sortOrder: 'asc' } },
    },
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
  const specCreate: Record<string, unknown> = {};
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

  const created: Array<Prisma.ItemGetPayload<Record<string, never>>> = [];
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
          sellingPrice: parsedSellingPrice ?? 0,
          origin: null,
          counter: parsedCounter,
          supplierId: parsedSupplierId,
          purchaseDate,
          status: 'in_stock',
          ...(tagIds?.length ? { tags: { connect: tagIds.map((id) => ({ id: parseInt(String(id)) })) } } : {}),
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
  } catch (e) {
    if (e instanceof Error && e.message?.includes('Unique')) {
      throw new ValidationError('SKU编号已存在');
    }
    throw e;
  }
}
