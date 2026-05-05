import { db } from '@/lib/db';
import { logAction } from '@/lib/log';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/errors';

// ============================================================
// 类别码映射（与前端保持一致）
// ============================================================
const CATEGORY_ABBR: Record<string, string> = {
  '玉': 'J',
  '贵金属': 'M',
  '水晶': 'C',
  '文玩': 'A',
  '其他': 'O',
};

// ============================================================
// 类型定义
// ============================================================

/** 批次列表查询参数 */
export interface GetBatchesParams {
  page?: number;
  size?: number;
  /** 材质筛选（可选） */
  materialId?: string | null;
}

/** 创建批次参数 */
export interface CreateBatchInput {
  batchCode?: string | null;
  materialId: number;
  typeId?: number | null;
  quantity: number;
  totalCost: number;
  costAllocMethod?: string;
  supplierId?: number | null;
  purchaseDate?: string | null;
  notes?: string | null;
}

/** 更新批次参数 */
export interface UpdateBatchInput {
  batchCode?: string;
  materialId?: number;
  typeId?: number | null;
  quantity?: number;
  totalCost?: number;
  costAllocMethod?: string;
  supplierId?: number | null;
  purchaseDate?: string | null;
  notes?: string | null;
}

// ============================================================
// 内部辅助函数
// ============================================================

/**
 * 自动生成批次编码
 * 格式：B{类别码}{月日4位}{序号3位}，如 BJ0417001
 */
async function generateBatchCode(materialId: number): Promise<string> {
  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  const category = material?.category || '其他';
  const abbr = CATEGORY_ABBR[category] || 'X';
  const today = new Date();
  const dateStr = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const prefix = `B${abbr}${dateStr}`;

  // 查找相同前缀下最新的批次编码
  const lastBatch = await db.batch.findFirst({
    where: { batchCode: { startsWith: prefix } },
    orderBy: { batchCode: 'desc' },
  });

  let seq = 1;
  if (lastBatch) {
    const lastSeq = parseInt(lastBatch.batchCode.slice(-3), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * 计算批次统计信息（已售数、回款、利润、回本率、状态等）
 * 回本率 = 已回款 / 总成本
 * 状态：
 *   new       — 全部未售
 *   selling   — 部分售出或数量不符
 *   cleared   — 全部售罄
 *   paid_back — 回本率 >= 100%
 */
async function getBatchStats(batchId: number, batch: { totalCost: number; quantity: number }) {
  const items = await db.item.findMany({
    where: { batchId, isDeleted: false },
    include: { saleRecords: true },
  });

  const itemsCount = items.length;
  const soldItems = items.filter(i => i.status === 'sold');
  const soldCount = soldItems.length;

  const revenue = soldItems.reduce((sum, item) => {
    return sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0);
  }, 0);

  const profit = revenue - batch.totalCost;
  const paybackRate = batch.totalCost > 0 ? revenue / batch.totalCost : 0;
  const hasQuantityMismatch = itemsCount !== batch.quantity;

  let status = 'new';
  if (soldCount === 0) status = 'new';
  else if (hasQuantityMismatch) status = 'selling';
  else if (soldCount === batch.quantity) status = 'cleared';
  else if (paybackRate >= 1) status = 'paid_back';
  else status = 'selling';

  return { itemsCount, soldCount, revenue, profit, paybackRate, status, hasQuantityMismatch };
}

// ============================================================
// 服务方法
// ============================================================

/**
 * 查询批次列表（含分页、材质筛选、统计信息）
 */
export async function getBatches(params: GetBatchesParams) {
  const page = params.page || 1;
  const size = params.size || 20;
  const materialId = params.materialId;

  const where: Record<string, unknown> = {};
  if (materialId) where.materialId = parseInt(materialId, 10);

  const [total, batches] = await Promise.all([
    db.batch.count({ where }),
    db.batch.findMany({
      where,
      include: { material: true, type: true, supplier: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  const itemsWithStats = await Promise.all(
    batches.map(async (b) => {
      const stats = await getBatchStats(b.id, { totalCost: b.totalCost, quantity: b.quantity });
      return {
        ...b,
        materialName: b.material?.name,
        typeName: b.type?.name,
        supplierName: b.supplier?.name,
        ...stats,
      };
    }),
  );

  return {
    items: itemsWithStats,
    pagination: { total, page, size, pages: Math.ceil(total / size) },
  };
}

/**
 * 创建批次
 * 批次编码自动生成（格式 B{类别码}{MMDD}{序号}），支持外部传入
 * @throws {ValidationError} 参数校验失败
 * @throws {ConflictError} 批次编号已存在
 */
export async function createBatch(body: CreateBatchInput) {
  const { batchCode, materialId, typeId, quantity, totalCost, costAllocMethod, supplierId, purchaseDate, notes } = body;

  if (!materialId || isNaN(materialId)) {
    throw new ValidationError('请选择材质');
  }
  if (!typeId || isNaN(typeId)) {
    throw new ValidationError('请选择器型');
  }
  if (!quantity || quantity <= 0) {
    throw new ValidationError('请输入有效的数量');
  }
  if (!totalCost || totalCost <= 0) {
    throw new ValidationError('请输入有效的总成本');
  }

  // 自动生成批次编码（如果未提供）
  let finalBatchCode = batchCode?.trim();
  if (!finalBatchCode) {
    finalBatchCode = await generateBatchCode(materialId);
  } else if (/[^\x00-\x7F]/.test(finalBatchCode)) {
    throw new ValidationError('批次编号不允许包含中文字符');
  }

  try {
    const batch = await db.batch.create({
      data: {
        batchCode: finalBatchCode,
        materialId,
        typeId: typeId ?? null,
        quantity,
        totalCost,
        costAllocMethod: costAllocMethod || 'equal',
        supplierId: supplierId ?? null,
        purchaseDate: purchaseDate || null,
        notes: notes || null,
      },
    });
    return batch;
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes('Unique')) {
      throw new ConflictError('批次编号已存在');
    }
    throw e;
  }
}

/**
 * 查询单条批次详情（含批次下的所有货品）
 * @throws {NotFoundError} 批次不存在
 */
export async function getBatchById(id: number) {
  const batch = await db.batch.findUnique({
    where: { id },
    include: { material: true, type: true, supplier: true },
  });

  if (!batch) {
    throw new NotFoundError('未找到');
  }

  const stats = await getBatchStats(batch.id, { totalCost: batch.totalCost, quantity: batch.quantity });
  const items = await db.item.findMany({
    where: { batchId: batch.id, isDeleted: false },
    include: { material: true, type: true, spec: true, tags: true, images: true },
    orderBy: { createdAt: 'desc' },
  });

  return {
    ...batch,
    materialName: batch.material?.name,
    typeName: batch.type?.name,
    supplierName: batch.supplier?.name,
    ...stats,
    items,
  };
}

/**
 * 更新批次信息
 * @throws {NotFoundError} 批次不存在（Prisma 原生找不到会抛错）
 */
export async function updateBatch(id: number, body: UpdateBatchInput) {
  try {
    const batch = await db.batch.update({ where: { id }, data: body });
    return batch;
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes('Record to update not found')) {
      throw new NotFoundError('未找到');
    }
    throw e;
  }
}

/**
 * 删除批次
 * - 有已售货品时不允许删除
 * - 删除前将关联货品的 batchId 置空
 * @throws {ValidationError} 批次有已售货品
 */
export async function deleteBatch(id: number) {
  // 检查是否有已售货品
  const soldCount = await db.item.count({
    where: { batchId: id, status: 'sold', isDeleted: false },
  });

  if (soldCount > 0) {
    throw new ValidationError(`该批次已有 ${soldCount} 件已售出货品，无法删除`);
  }

  // 解除关联货品的批次绑定
  await db.item.updateMany({
    where: { batchId: id },
    data: { batchId: null, batchCode: null },
  });

  await db.batch.delete({ where: { id } });
}

/**
 * 批次成本分摊
 * 将批次总成本按分摊方式（equal / by_weight / by_price）分配到每件货品，
 * 同时计算底价和建议售价
 * @throws {NotFoundError} 批次不存在
 * @throws {ValidationError} 货品数量与批次不一致 / 分摊方式不支持 / 数据不足
 */
export async function allocateItems(batchId: number) {
  const batch = await db.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new NotFoundError('批次不存在');
  }

  const items = await db.item.findMany({
    where: { batchId, isDeleted: false },
    include: { spec: true },
  });

  if (items.length !== batch.quantity) {
    throw new ValidationError(`货品数量与批次不一致，当前 ${items.length}/${batch.quantity} 件`);
  }

  // 获取系统配置（运营费率、加价率）
  const configs = await db.sysConfig.findMany();
  const configMap = Object.fromEntries(configs.map(c => [c.key, parseFloat(c.value)]));
  const operatingCostRate = configMap['operating_cost_rate'] || 0.05;
  const markupRate = configMap['markup_rate'] || 0.30;

  let allocatedCosts: number[] = [];

  if (batch.costAllocMethod === 'equal') {
    // 平均分摊
    const perItem = Math.floor((batch.totalCost / batch.quantity) * 100) / 100;
    const remainder = Math.round((batch.totalCost - perItem * batch.quantity) * 100) / 100;
    allocatedCosts = items.map((_, i) => (i === items.length - 1 ? perItem + remainder : perItem));
  } else if (batch.costAllocMethod === 'by_weight') {
    // 按克重分摊
    const weights = items.map(item => item.spec?.weight || 0);
    if (weights.some(w => w <= 0)) {
      throw new ValidationError('按克重分摊：每件货品克重必须大于0');
    }
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) {
      throw new ValidationError('按克重分摊：所有货品必须有克重');
    }
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
    // 按售价比例分摊
    const prices = items.map(item => item.sellingPrice || 0);
    const totalSelling = prices.reduce((a, b) => a + b, 0);
    if (totalSelling === 0) {
      throw new ValidationError('按售价比例分摊：所有货品必须有售价');
    }
    let sumAllocated = 0;
    allocatedCosts = items.map((item, i) => {
      const cost = i === items.length - 1
        ? Math.round((batch.totalCost - sumAllocated) * 100) / 100
        : Math.round((item.sellingPrice / totalSelling) * batch.totalCost * 100) / 100;
      sumAllocated += cost;
      return cost;
    });
  } else {
    throw new ValidationError('不支持的分摊方式');
  }

  // 应用分摊 + 定价引擎
  const results: Array<{ skuCode: string; allocatedCost: number; floorPrice: number; suggestedSellingPrice: number }> = [];
  for (let i = 0; i < items.length; i++) {
    const allocatedCost = allocatedCosts[i];
    const floorPrice = Math.round(allocatedCost * (1 + operatingCostRate) * 100) / 100;
    const suggestedSellingPrice = Math.round(floorPrice * (1 + markupRate) * 100) / 100;

    await db.item.update({
      where: { id: items[i].id },
      data: { allocatedCost, floorPrice },
    });

    results.push({ skuCode: items[i].skuCode, allocatedCost, floorPrice, suggestedSellingPrice });
  }

  // 记录操作日志
  await logAction('allocate_batch', 'batch', batchId, {
    batchCode: batch.batchCode,
    method: batch.costAllocMethod,
    itemCount: items.length,
    totalCost: batch.totalCost,
  });

  return { items: results };
}
