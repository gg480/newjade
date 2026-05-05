import { db } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

// ──────────────────────────────────────────────
// Tags (DictTag)
// ──────────────────────────────────────────────

export interface ListTagsParams {
  groupName?: string;
  materialId?: number;
  includeInactive?: boolean;
}

/**
 * 查询标签列表，支持按 groupName/materialId 筛选
 */
export async function listTags(params: ListTagsParams = {}) {
  const { groupName, materialId, includeInactive } = params;
  const where: Record<string, unknown> = {};

  if (groupName) where.groupName = groupName;
  if (!includeInactive) where.isActive = true;
  if (materialId && !Number.isNaN(materialId)) {
    where.OR = [
      { isGlobal: true },
      { tagMaterials: { some: { materialId } } },
    ];
  }

  return db.dictTag.findMany({
    where,
    orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
  });
}

export interface CreateTagInput {
  name: string;
  groupName?: string;
}

/**
 * 创建标签
 * @throws {ConflictError} 标签名称已存在时抛出
 */
export async function createTag(data: CreateTagInput) {
  try {
    return await db.dictTag.create({ data: { name: data.name, groupName: data.groupName } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Unique')) {
      throw new ConflictError('标签名称已存在');
    }
    throw e;
  }
}

/**
 * 按 ID 查询标签
 * @throws {NotFoundError}
 */
export async function getTagById(id: number) {
  const item = await db.dictTag.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('标签不存在');
  return item;
}

/**
 * 更新标签
 * @throws {NotFoundError} 标签不存在时抛出（由 Prisma 自动处理）
 */
export async function updateTag(id: number, data: Record<string, unknown>) {
  try {
    return await db.dictTag.update({ where: { id }, data });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('标签不存在');
    }
    if (e instanceof Error && e.message.includes('Unique')) {
      throw new ConflictError('标签名称已存在');
    }
    throw e;
  }
}

/**
 * 删除标签（软删除）
 */
export async function deleteTag(id: number) {
  try {
    return await db.dictTag.update({ where: { id }, data: { isActive: false } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('标签不存在');
    }
    throw e;
  }
}

// ──────────────────────────────────────────────
// Types (DictType)
// ──────────────────────────────────────────────

export interface ListTypesParams {
  includeInactive?: boolean;
}

/**
 * 查询器型列表
 */
export async function listTypes(params: ListTypesParams = {}) {
  const { includeInactive } = params;
  return db.dictType.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export interface CreateTypeInput {
  name: string;
  specFields?: string;
  sortOrder?: number;
}

/**
 * 创建器型
 * @throws {ConflictError} 器型名称已存在时抛出
 */
export async function createType(data: CreateTypeInput) {
  try {
    return await db.dictType.create({
      data: { name: data.name, specFields: data.specFields, sortOrder: data.sortOrder ?? 0 },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Unique')) {
      throw new ConflictError('器型名称已存在');
    }
    throw e;
  }
}

/**
 * 按 ID 查询器型
 * @throws {NotFoundError}
 */
export async function getTypeById(id: number) {
  const item = await db.dictType.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('器型不存在');
  return item;
}

/**
 * 更新器型
 */
export async function updateType(id: number, data: Record<string, unknown>) {
  try {
    return await db.dictType.update({ where: { id }, data });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('器型不存在');
    }
    if (e instanceof Error && e.message.includes('Unique')) {
      throw new ConflictError('器型名称已存在');
    }
    throw e;
  }
}

/**
 * 删除器型（有关联货品时软删除，否则直接软删除）
 */
export async function deleteType(id: number) {
  const itemCount = await db.item.count({ where: { typeId: id, isDeleted: false } });

  if (itemCount > 0) {
    await db.dictType.update({ where: { id }, data: { isActive: false } });
    return { softDeleted: true, message: '已停用（有关联货品）' };
  }

  await db.dictType.update({ where: { id }, data: { isActive: false } });
  return { softDeleted: true };
}

// ──────────────────────────────────────────────
// Price Ranges (PriceRange)
// ──────────────────────────────────────────────

export interface ListPriceRangesParams {
  includeInactive?: boolean;
}

/**
 * 查询价格带列表
 */
export async function listPriceRanges(params: ListPriceRangesParams = {}) {
  const { includeInactive } = params;
  return db.priceRange.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export interface CreatePriceRangeInput {
  name: string;
  minPrice?: number;
  maxPrice?: number;
  sortOrder?: number;
}

/**
 * 创建价格带
 */
export async function createPriceRange(data: CreatePriceRangeInput) {
  return db.priceRange.create({
    data: {
      name: data.name,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

/**
 * 按 ID 查询价格带
 * @throws {NotFoundError}
 */
export async function getPriceRangeById(id: number) {
  const item = await db.priceRange.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('价格带不存在');
  return item;
}

/**
 * 更新价格带
 */
export async function updatePriceRange(id: number, data: Record<string, unknown>) {
  try {
    return await db.priceRange.update({ where: { id }, data });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('价格带不存在');
    }
    throw e;
  }
}

/**
 * 删除价格带（物理删除）
 */
export async function deletePriceRange(id: number) {
  try {
    await db.priceRange.delete({ where: { id } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('价格带不存在');
    }
    throw e;
  }
}

// ──────────────────────────────────────────────
// Customer Segments (CustomerSegment)
// ──────────────────────────────────────────────

export interface ListCustomerSegmentsParams {
  includeInactive?: boolean;
}

/**
 * 查询客户分组列表
 */
export async function listCustomerSegments(params: ListCustomerSegmentsParams = {}) {
  const { includeInactive } = params;
  return db.customerSegment.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { id: 'asc' },
  });
}

export interface CreateCustomerSegmentInput {
  name: string;
  discountRate?: number;
  description?: string;
}

/**
 * 创建客户分组
 */
export async function createCustomerSegment(data: CreateCustomerSegmentInput) {
  return db.customerSegment.create({
    data: {
      name: data.name,
      discountRate: data.discountRate ?? undefined,
      description: data.description ?? undefined,
    },
  });
}

/**
 * 按 ID 查询客户分组
 * @throws {NotFoundError}
 */
export async function getCustomerSegmentById(id: number) {
  const item = await db.customerSegment.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('客户分类不存在');
  return item;
}

/**
 * 更新客户分组
 */
export async function updateCustomerSegment(id: number, data: Record<string, unknown>) {
  try {
    return await db.customerSegment.update({ where: { id }, data });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('客户分类不存在');
    }
    throw e;
  }
}

/**
 * 删除客户分组（软删除）
 */
export async function deleteCustomerSegment(id: number) {
  try {
    return await db.customerSegment.update({ where: { id }, data: { isActive: false } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('客户分类不存在');
    }
    throw e;
  }
}

// ──────────────────────────────────────────────
// Product Categories (ProductCategory)
// ──────────────────────────────────────────────

export interface ListProductCategoriesParams {
  includeChildren?: boolean;
}

/**
 * 查询商品分类列表
 */
export async function listProductCategories(params: ListProductCategoriesParams = {}) {
  const { includeChildren } = params;
  return db.productCategory.findMany({
    where: { isActive: true },
    include: includeChildren ? { children: true } : undefined,
    orderBy: { sortOrder: 'asc' },
  });
}

export interface CreateProductCategoryInput {
  name: string;
  parentId?: number;
  sortOrder?: number;
}

/**
 * 创建商品分类（自动计算 path 和 level）
 */
export async function createProductCategory(data: CreateProductCategoryInput) {
  const { name, parentId, sortOrder } = data;

  let path = name;
  let level = 1;

  if (parentId) {
    const parent = await db.productCategory.findUnique({ where: { id: parentId } });
    if (parent) {
      path = `${parent.path}/${name}`;
      level = parent.level + 1;
    }
  }

  return db.productCategory.create({
    data: { name, parentId, level, path, sortOrder: sortOrder || 0 },
  });
}

/**
 * 按 ID 查询商品分类详情（含子分类）
 * @throws {NotFoundError}
 */
export async function getProductCategoryById(id: number) {
  const item = await db.productCategory.findUnique({
    where: { id },
    include: { children: true },
  });
  if (!item) throw new NotFoundError('商品分类不存在');
  return item;
}

/**
 * 更新商品分类（自动重新计算 path 和 level）
 */
export async function updateProductCategory(id: number, data: Record<string, unknown>) {
  const { name, parentId, sortOrder, isActive } = data as {
    name?: string;
    parentId?: number;
    sortOrder?: number;
    isActive?: boolean;
  };

  let path = name;
  let level = 1;

  if (parentId) {
    const parent = await db.productCategory.findUnique({ where: { id: parentId } });
    if (parent) {
      path = `${parent.path}/${name}`;
      level = parent.level + 1;
    }
  }

  try {
    return await db.productCategory.update({
      where: { id },
      data: { name, parentId, level, path, sortOrder, isActive },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('商品分类不存在');
    }
    throw e;
  }
}

/**
 * 删除商品分类（检查是否有子分类，有则拒绝）
 * @throws {ValidationError} 有子分类时抛出
 * @throws {NotFoundError} 分类不存在时抛出
 */
export async function deleteProductCategory(id: number) {
  // 检查是否有子分类
  const childrenCount = await db.productCategory.count({
    where: { parentId: id },
  });

  if (childrenCount > 0) {
    throw new ValidationError('该分类下有子分类，无法删除');
  }

  try {
    await db.productCategory.delete({ where: { id } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('NotFound')) {
      throw new NotFoundError('商品分类不存在');
    }
    throw e;
  }
}
