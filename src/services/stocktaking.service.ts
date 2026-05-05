import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ============================================================
// 类型定义
// ============================================================

export interface StocktakingListQuery {
  page?: number;
  size?: number;
  status?: string;
  type?: string;
}

export interface CreateStocktakingInput {
  type: string;
  startDate: string;
  notes?: string;
  itemIds: number[];
}

export interface UpdateStocktakingInput {
  status?: string;
  endDate?: string;
  notes?: string;
}

export interface StocktakingDetailUpdate {
  detailId: number;
  actualQty: number;
  notes?: string;
}

export interface StocktakingWithDetails {
  id: number;
  type: string;
  status: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: Date;
  details: any[];
}

// ============================================================
// 盘点计划 CRUD
// ============================================================

/**
 * 获取盘点计划列表（分页）
 * 等同于 GET /api/stocktaking
 */
export async function listStocktakings(query: StocktakingListQuery): Promise<{
  stocktakings: any[];
  total: number;
  page: number;
  size: number;
}> {
  const page = query.page || 1;
  const size = query.size || 10;

  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;

  const [stocktakings, total] = await Promise.all([
    db.stocktaking.findMany({
      where,
      include: {
        details: {
          include: {
            item: {
              include: {
                material: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    db.stocktaking.count({ where }),
  ]);

  return { stocktakings, total, page, size };
}

/**
 * 创建盘点计划
 * 自动生成盘点明细（每个 itemId 一条）
 * 等同于 POST /api/stocktaking
 */
export async function createStocktaking(input: CreateStocktakingInput) {
  const { type, startDate, notes, itemIds = [] } = input;

  const stocktaking = await db.stocktaking.create({
    data: {
      type,
      startDate,
      notes,
      details: {
        create: itemIds.map((itemId: number) => ({
          itemId,
          systemQty: 1,
          actualQty: 0,
          variance: -1,
        })),
      },
    },
    include: {
      details: {
        include: {
          item: {
            include: {
              material: true,
              type: true,
            },
          },
        },
      },
    },
  });

  return stocktaking;
}

/**
 * 获取单个盘点计划详情
 * @throws {NotFoundError} 计划不存在
 * 等同于 GET /api/stocktaking/:id
 */
export async function getStocktakingById(id: number) {
  const stocktaking = await db.stocktaking.findUnique({
    where: { id },
    include: {
      details: {
        include: {
          item: {
            include: {
              material: true,
              type: true,
              batch: true,
            },
          },
        },
      },
    },
  });

  if (!stocktaking) throw new NotFoundError('盘点计划不存在');

  return stocktaking;
}

/**
 * 更新盘点计划
 * @throws {NotFoundError} 计划不存在
 * 等同于 PUT /api/stocktaking/:id
 */
export async function updateStocktaking(id: number, input: UpdateStocktakingInput) {
  const stocktaking = await db.stocktaking.update({
    where: { id },
    data: {
      status: input.status,
      endDate: input.endDate,
      notes: input.notes,
    },
    include: {
      details: {
        include: {
          item: {
            include: {
              material: true,
              type: true,
            },
          },
        },
      },
    },
  });

  return stocktaking;
}

/**
 * 删除盘点计划
 * 等同于 DELETE /api/stocktaking/:id
 */
export async function deleteStocktaking(id: number): Promise<void> {
  await db.stocktaking.delete({ where: { id } });
}

// ============================================================
// 盘点明细
// ============================================================

/**
 * 批量更新盘点明细（录入实盘数量）
 * 每个 detail 计算 variance = actualQty - systemQty
 * 等同于 POST /api/stocktaking/:id/details
 */
export async function updateStocktakingDetails(stocktakingId: number, details: StocktakingDetailUpdate[]) {
  if (!Array.isArray(details)) {
    throw new ValidationError('details必须是数组');
  }

  const updatedDetails = await Promise.all(
    details.map(async (detail) => {
      const { detailId, actualQty, notes } = detail;
      return await db.stocktakingDetail.update({
        where: { id: detailId },
        data: {
          actualQty,
          variance: actualQty - (detail as any).systemQty || 1,
          notes,
        },
      });
    }),
  );

  const stocktaking = await db.stocktaking.findUnique({
    where: { id: stocktakingId },
    include: {
      details: {
        include: {
          item: {
            include: {
              material: true,
              type: true,
            },
          },
        },
      },
    },
  });

  return stocktaking;
}
