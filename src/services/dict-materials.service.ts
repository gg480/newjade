import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';

/**
 * 材质创建参数
 */
interface CreateMaterialInput {
  name: string;
  category?: string;
  subType?: string | null;
  origin?: string;
  costPerGram?: number;
  sortOrder?: number;
}

/**
 * 材质更新参数
 */
interface UpdateMaterialInput {
  name?: string;
  category?: string;
  subType?: string | null;
  origin?: string;
  costPerGram?: number;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * 查询材质列表
 * 默认仅返回启用的材质，按 sortOrder 升序
 * @param includeInactive - 是否包含已禁用的材质
 * @returns 材质列表
 */
export async function listMaterials(includeInactive = false) {
  return db.dictMaterial.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * 按 ID 查询单个材质
 * @param id - 材质 ID
 * @returns 材质记录
 * @throws {NotFoundError} 材质不存在时抛出
 */
export async function getMaterial(id: number) {
  const item = await db.dictMaterial.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('材质不存在');
  return item;
}

/**
 * 创建材质
 * name 去首尾空格，subType 为空字符串时存 null
 * @param data - 材质数据
 * @returns 创建的材质记录
 * @throws {ConflictError} 材质名称+子类已存在时抛出
 */
export async function createMaterial(data: CreateMaterialInput) {
  try {
    return await db.dictMaterial.create({
      data: {
        name: data.name?.trim(),
        category: data.category,
        subType: data.subType?.trim() || null,
        origin: data.origin,
        costPerGram: data.costPerGram,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Unique')) {
      throw new ConflictError('材质名称+子类已存在');
    }
    throw e;
  }
}

/**
 * 更新材质
 * name 去首尾空格，subType 为空字符串时存 null
 * @param id - 材质 ID
 * @param data - 要更新的字段
 * @returns 更新后的材质记录
 * @throws {ConflictError} 唯一约束冲突时抛出
 */
export async function updateMaterial(id: number, data: UpdateMaterialInput) {
  try {
    const cleaned = {
      ...data,
      name: typeof data.name === 'string' ? data.name.trim() : data.name,
      subType: typeof data.subType === 'string' ? (data.subType.trim() || null) : data.subType,
    };
    return await db.dictMaterial.update({ where: { id }, data: cleaned });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Unique')) {
      throw new ConflictError('材质名称+子类已存在');
    }
    throw e;
  }
}

/**
 * 删除材质（软删除）
 * - 有关联商品或批次时：只停用，返回提示
 * - 无关联数据时：直接停用
 * @param id - 材质 ID
 * @returns `{ softDeleted: true, message?: string }`
 */
export async function deleteMaterial(id: number) {
  const itemCount = await db.item.count({
    where: { materialId: id, isDeleted: false },
  });
  const batchCount = await db.batch.count({ where: { materialId: id } });

  if (itemCount > 0 || batchCount > 0) {
    await db.dictMaterial.update({ where: { id }, data: { isActive: false } });
    return { softDeleted: true, message: '已停用（有关联数据，无法删除）' };
  }

  await db.dictMaterial.update({ where: { id }, data: { isActive: false } });
  return { softDeleted: true };
}
