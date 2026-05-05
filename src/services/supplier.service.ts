import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── 供应商进货统计类型 ─────────────────────────────────────

/** 单个供应商进货汇总 */
export interface SupplierStatItem {
  supplierId: number;
  supplierName: string;
  batchCount: number;
  totalAmount: number;
  totalCount: number;
  avgPrice: number;
}

/** 供应商进货统计完整响应 */
export interface SupplierStatsResponse {
  stats: SupplierStatItem[];
  total: {
    totalAmount: number;
    totalCount: number;
    avgPrice: number;
  };
}

/** 供应商进货明细查询参数 */
export interface SupplierPurchasesParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

/**
 * 查询供应商列表
 * 支持按名称或联系人模糊搜索，仅返回启用的供应商
 * @param keyword - 搜索关键词（匹配 name 或 contact）
 * @returns 供应商列表（按名称升序）
 */
export async function listSuppliers(keyword?: string) {
  const where: Prisma.SupplierWhereInput = { isActive: true };

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { contact: { contains: keyword } },
    ];
  }

  return db.supplier.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

/**
 * 按 ID 查询单个供应商
 * @param id - 供应商 ID
 * @returns 供应商记录
 * @throws {NotFoundError} 供应商不存在时抛出
 */
export async function getSupplier(id: number) {
  const item = await db.supplier.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('供应商不存在');
  return item;
}

/**
 * 创建供应商
 * @param data - 供应商数据
 * @returns 创建成功的供应商记录
 */
export async function createSupplier(data: {
  name: string;
  contact?: string;
  phone?: string;
  notes?: string;
}) {
  return db.supplier.create({ data });
}

/**
 * 更新供应商
 * @param id - 供应商 ID
 * @param data - 要更新的字段
 * @returns 更新后的供应商记录
 */
export async function updateSupplier(
  id: number,
  data: {
    name?: string;
    contact?: string;
    phone?: string;
    notes?: string;
    isActive?: boolean;
  },
) {
  return db.supplier.update({ where: { id }, data });
}

/**
 * 删除供应商（软删除）
 * - 有关联商品或批次时：返回错误，不允许删除
 * - 无关联数据时：软删除（设置 isActive = false）
 * @param id - 供应商 ID
 * @returns `{ softDeleted: true }`
 * @throws {Error} 有关联数据时抛出，附带关联数量信息
 */
export async function deleteSupplier(id: number) {
  const itemCount = await db.item.count({ where: { supplierId: id } });
  if (itemCount > 0) {
    throw new Error(
      `该供应商下有 ${itemCount} 件关联商品，无法删除。请先转移或删除相关商品。`,
    );
  }

  const batchCount = await db.batch.count({ where: { supplierId: id } });
  if (batchCount > 0) {
    throw new Error(
      `该供应商下有 ${batchCount} 个关联批次，无法删除。请先转移或删除相关批次。`,
    );
  }

  await db.supplier.update({ where: { id }, data: { isActive: false } });
  return { softDeleted: true };
}

// ─── 供应商进货统计 ─────────────────────────────────────────

/**
 * 按供应商统计进货汇总数据
 * 通过 Batch 表按 supplierId 分组，聚合 totalCost 和 quantity
 * @returns 每个供应商的进货汇总 + 全局总计
 */
export async function getSupplierStats(): Promise<SupplierStatsResponse> {
  // 使用 Prisma groupBy 按供应商聚合批次数据
  const groups = await db.batch.groupBy({
    by: ['supplierId'],
    _count: { id: true },
    _sum: { totalCost: true, quantity: true },
    where: { supplierId: { not: null } },
  });

  // 获取所有供应商的名称映射
  const supplierIds = groups
    .filter((g) => g.supplierId !== null)
    .map((g) => g.supplierId as number);

  const suppliers = await db.supplier.findMany({
    where: { id: { in: supplierIds }, isActive: true },
    select: { id: true, name: true },
  });

  const nameMap = new Map(suppliers.map((s) => [s.id, s.name]));

  const stats: SupplierStatItem[] = groups
    .filter((g) => g.supplierId !== null && nameMap.has(g.supplierId))
    .map((g) => {
      const amount = g._sum.totalCost ?? 0;
      const count = g._sum.quantity ?? 0;
      return {
        supplierId: g.supplierId as number,
        supplierName: nameMap.get(g.supplierId as number) ?? '未知',
        batchCount: g._count.id,
        totalAmount: Math.round(amount * 100) / 100,
        totalCount: count,
        avgPrice: count > 0 ? Math.round((amount / count) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount); // 按进货金额降序

  // 全局总计
  const totalAmount = stats.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCount = stats.reduce((sum, s) => sum + s.totalCount, 0);

  return {
    stats,
    total: {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalCount,
      avgPrice:
        totalCount > 0
          ? Math.round((totalAmount / totalCount) * 100) / 100
          : 0,
    },
  };
}

/**
 * 按供应商查询进货批次明细（分页 + 日期筛选）
 * @param supplierId - 供应商 ID
 * @param params - 筛选参数（日期范围、分页）
 * @returns 分页的批次列表
 */
export async function getSupplierPurchases(
  supplierId: number,
  params: SupplierPurchasesParams = {},
) {
  const page = Math.max(1, params.page ?? 1);
  const size = Math.min(100, Math.max(1, params.size ?? 20));
  const skip = (page - 1) * size;

  // 构建日期筛选条件
  const dateFilter: Prisma.BatchWhereInput = {};
  if (params.startDate) {
    dateFilter.createdAt = {
      ...(dateFilter.createdAt as Prisma.DateTimeFilter | undefined),
      gte: new Date(params.startDate),
    };
  }
  if (params.endDate) {
    // endDate 是自然日，需要包含当天 23:59:59
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.createdAt = {
      ...(dateFilter.createdAt as Prisma.DateTimeFilter | undefined),
      lte: end,
    };
  }

  const where: Prisma.BatchWhereInput = {
    supplierId,
    ...dateFilter,
  };

  const [items, total] = await Promise.all([
    db.batch.findMany({
      where,
      include: {
        material: { select: { name: true } },
        type: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    }),
    db.batch.count({ where }),
  ]);

  // 格式化明细数据
  const formatted = items.map((b) => ({
    id: b.id,
    batchCode: b.batchCode,
    materialName: b.material?.name ?? '未知',
    typeName: b.type?.name ?? '—',
    quantity: b.quantity,
    totalCost: b.totalCost,
    costAllocMethod: b.costAllocMethod,
    purchaseDate: b.purchaseDate,
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
  }));

  return {
    items: formatted,
    pagination: {
      total,
      page,
      size,
      pages: Math.ceil(total / size),
    },
  };
}
