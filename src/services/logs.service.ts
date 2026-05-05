import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ============================================================
// 类型定义
// ============================================================

/** 操作日志查询参数 */
export interface GetLogsParams {
  page?: number;
  size?: number;
  action?: string | null;
  targetType?: string | null;
  search?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/** 操作日志分页结果 */
export interface PaginatedLogs {
  items: any[];
  pagination: {
    total: number;
    page: number;
    size: number;
    pages: number;
  };
}

/** 清理结果 */
export interface CleanupResult {
  deleted: number;
}

// ============================================================
// 服务方法
// ============================================================

/**
 * 分页查询操作日志
 * 支持按 action / targetType / 详情搜索 / 日期范围筛选
 */
export async function getLogs(params: GetLogsParams): Promise<PaginatedLogs> {
  const page = params.page || 1;
  const size = params.size || 20;
  const { action, targetType, search, startDate, endDate } = params;

  const where: Prisma.OperationLogWhereInput = {};

  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (search) {
    where.detail = { contains: search, mode: Prisma.QueryMode.insensitive };
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const [items, total] = await Promise.all([
    db.operationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    db.operationLog.count({ where }),
  ]);

  return {
    items,
    pagination: { total, page, size, pages: Math.ceil(total / size) },
  };
}

/**
 * 统计指定日期之前的操作日志数量
 */
export async function countOldLogs(beforeDate: Date): Promise<number> {
  const count = await db.operationLog.count({
    where: { createdAt: { lt: beforeDate } },
  });
  return count;
}

/**
 * 清理指定日期之前的操作日志
 * @returns 被删除的记录数
 */
export async function cleanupOldLogs(beforeDate: Date): Promise<CleanupResult> {
  const result = await db.operationLog.deleteMany({
    where: { createdAt: { lt: beforeDate } },
  });
  return { deleted: result.count };
}
