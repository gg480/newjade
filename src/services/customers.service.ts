import { db } from '@/lib/db';
import { logAction } from '@/lib/log';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ============================================================
// 类型定义
// ============================================================

/** 客户列表查询参数 */
export interface GetCustomersParams {
  page?: number;
  size?: number;
  keyword?: string | null;
  tag?: string | null;
  sortBy?: string;
  sortOrder?: string;
}

/** 创建客户参数 */
export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  wechat?: string | null;
  address?: string | null;
  notes?: string | null;
  tags?: string[];
}

/** 更新客户参数 */
export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  wechat?: string | null;
  address?: string | null;
  notes?: string | null;
  tags?: string[];
}

/** 客户合并参数 */
export interface MergeCustomersInput {
  targetCustomerId: number;
  saleRecordIds: number[];
}

// ============================================================
// 内部辅助函数
// ============================================================

/**
 * 解析 tags JSON 字符串为数组
 */
function parseTags(tagsStr: string | null): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 序列化 tags 数组为 JSON 字符串
 */
function serializeTags(tags: string[] | undefined | null): string | null {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return null;
  return JSON.stringify(tags);
}

/**
 * 自动生成客户编码 cst{YYYYMMDD}{3位序号}
 */
async function generateCustomerCode(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `cst${today}`;
  const last = await db.customer.findFirst({
    where: { customerCode: { startsWith: prefix } },
    orderBy: { customerCode: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.customerCode.slice(-3));
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * VIP 等级阈值配置
 */
const vipThresholds = [
  { label: '普通客户', min: 0, max: 5000 },
  { label: '银卡会员', min: 5000, max: 20000 },
  { label: '金卡会员', min: 20000, max: 50000 },
  { label: '钻石会员', min: 50000, max: Infinity },
];

/**
 * 计算客户的购买统计
 */
function calculatePurchaseStats(saleRecords: Array<{ actualPrice: number; saleDate: string | null }>) {
  const totalSpending = saleRecords.reduce((sum, s) => sum + (s.actualPrice || 0), 0);
  const orderCount = saleRecords.length;
  const avgOrderValue = orderCount > 0 ? Math.round((totalSpending / orderCount) * 100) / 100 : 0;
  const lastPurchaseDate = saleRecords.length > 0 ? saleRecords[0].saleDate : null;
  const daysSinceLastPurchase = lastPurchaseDate
    ? Math.floor((Date.now() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  return { totalSpending, orderCount, avgOrderValue, lastPurchaseDate, daysSinceLastPurchase };
}

/**
 * 计算月度消费趋势（近12个月）
 */
function calculateMonthlySpending(saleRecords: Array<{ actualPrice: number; saleDate: string | null }>) {
  const monthlySpending: { month: string; amount: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthSales = saleRecords.filter(s => s.saleDate && s.saleDate.startsWith(monthKey));
    const amount = monthSales.reduce((sum, s) => sum + (s.actualPrice || 0), 0);
    monthlySpending.push({ month: monthKey, amount });
  }
  return monthlySpending;
}

/**
 * 计算偏好材质 Top5
 */
function calculateTopMaterials(saleRecords: Array<{ actualPrice: number; item?: { material?: { name?: string } } | null }>) {
  const materialCounts: Record<string, { count: number; total: number }> = {};
  for (const sr of saleRecords) {
    const matName = (sr.item as any)?.material?.name || '未知';
    if (!materialCounts[matName]) materialCounts[matName] = { count: 0, total: 0 };
    materialCounts[matName].count++;
    materialCounts[matName].total += sr.actualPrice || 0;
  }
  return Object.entries(materialCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data]) => ({ name, count: data.count, totalSpending: data.total }));
}

/**
 * 计算 VIP 等级进度
 */
function calculateVipProgress(totalSpending: number) {
  const currentVip = vipThresholds.find(v => totalSpending >= v.min && totalSpending < v.max) || vipThresholds[vipThresholds.length - 1];
  const nextVip = vipThresholds.find(v => v.min > currentVip.min);
  const progressToNext = nextVip
    ? Math.min(((totalSpending - currentVip.min) / (nextVip.min - currentVip.min)) * 100, 100)
    : 100;
  return {
    currentLevel: currentVip.label,
    currentMin: currentVip.min,
    nextLevel: nextVip?.label || null,
    nextMin: nextVip?.min || null,
    progressToNext: Math.round(progressToNext),
  };
}

// ============================================================
// 服务方法
// ============================================================

/**
 * 查询客户列表（含关键词搜索、标签筛选、分页、排序、消费统计聚合）
 */
export async function getCustomers(params: GetCustomersParams) {
  const page = params.page || 1;
  const size = params.size || 20;
  const keyword = params.keyword || undefined;
  const tag = params.tag || undefined;
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';
  const direction = sortOrder === 'asc' ? 'asc' : 'desc';

  const where: any = { isActive: true };
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { phone: { contains: keyword } },
      { wechat: { contains: keyword } },
    ];
  }
  if (tag) {
    where.tags = { contains: tag };
  }

  const total = await db.customer.count({ where });

  // 判断排序方式：DB 级别排序 vs 内存排序
  const dbSortFields = new Set(['created_at', 'name']);
  const needsInMemorySort = !dbSortFields.has(sortBy);

  let customers: any[];
  if (needsInMemorySort) {
    // 内存排序：先查出所有匹配客户
    customers = await db.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  } else {
    // DB 排序：直接分页查询
    const orderByMap: Record<string, any> = {
      created_at: { createdAt: direction },
      name: { name: direction },
    };
    customers = await db.customer.findMany({
      where,
      orderBy: orderByMap[sortBy] || { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    });
  }

  // 聚合每位客户的消费统计
  const customerIds = customers.map((c: any) => c.id);
  const spendingAgg = customerIds.length > 0 ? await db.saleRecord.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds } },
    _sum: { actualPrice: true },
    _count: { id: true },
  }) : [];

  const spendingMap = new Map<number, { totalSpending: number; orderCount: number; lastSaleDate: string | null }>();
  for (const agg of spendingAgg) {
    if (agg.customerId) {
      spendingMap.set(agg.customerId, {
        totalSpending: agg._sum.actualPrice || 0,
        orderCount: agg._count.id,
        lastSaleDate: null,
      });
    }
  }

  // 获取每位客户最近的销售日期
  if (customerIds.length > 0 && sortBy === 'last_purchase') {
    const lastSales = await db.saleRecord.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _max: { saleDate: true },
    });
    for (const ls of lastSales) {
      if (ls.customerId) {
        const existing = spendingMap.get(ls.customerId);
        if (existing) {
          existing.lastSaleDate = ls._max.saleDate;
        } else {
          spendingMap.set(ls.customerId, {
            totalSpending: 0,
            orderCount: 0,
            lastSaleDate: ls._max.saleDate,
          });
        }
      }
    }
  }

  // 组装 items
  let items = customers.map((c: any) => {
    const spending = spendingMap.get(c.id) || { totalSpending: 0, orderCount: 0, lastSaleDate: null };
    return {
      ...c,
      tags: parseTags(c.tags),
      totalSpending: spending.totalSpending,
      orderCount: spending.orderCount,
      lastPurchaseDate: spending.lastSaleDate,
    };
  });

  // 内存排序
  if (needsInMemorySort) {
    const sortFns: Record<string, (a: any, b: any) => number> = {
      total_spending: (a, b) => direction === 'desc' ? b.totalSpending - a.totalSpending : a.totalSpending - b.totalSpending,
      order_count: (a, b) => direction === 'desc' ? b.orderCount - a.orderCount : a.orderCount - b.orderCount,
      last_purchase: (a, b) => {
        const da = a.lastPurchaseDate || '';
        const db2 = b.lastPurchaseDate || '';
        return direction === 'desc' ? db2.localeCompare(da) : da.localeCompare(db2);
      },
    };
    const sortFn = sortFns[sortBy];
    if (sortFn) {
      items = items.sort(sortFn);
    }

    // 分页（内存排序后分页）
    const start = (page - 1) * size;
    items = items.slice(start, start + size);
  }

  // 总体统计
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const [totalCustomers, newThisMonth, totalSpendingAll] = await Promise.all([
    db.customer.count({ where: { isActive: true } }),
    db.customer.count({ where: { isActive: true, createdAt: { gte: new Date(monthStart) } } }),
    db.saleRecord.aggregate({ _sum: { actualPrice: true } }),
  ]);
  const avgOrderValue = totalSpendingAll._sum.actualPrice
    ? Math.round((totalSpendingAll._sum.actualPrice / Math.max(totalCustomers, 1)) * 100) / 100
    : 0;

  // 收集所有标签（用于筛选下拉）
  const allCustomers = await db.customer.findMany({
    where: { isActive: true },
    select: { tags: true },
  });
  const tagSet = new Set<string>();
  for (const c of allCustomers) {
    const parsed = parseTags(c.tags);
    parsed.forEach((t: string) => tagSet.add(t));
  }
  const allTags = Array.from(tagSet).sort();

  return {
    items,
    pagination: { total, page, size, pages: Math.ceil(total / size) },
    stats: {
      totalCustomers,
      newThisMonth,
      totalSpending: totalSpendingAll._sum.actualPrice || 0,
      avgOrderValue,
    },
    allTags,
  };
}

/**
 * 创建客户
 * @throws {ValidationError} 客户名为空
 */
export async function createCustomer(data: CreateCustomerInput) {
  const { name, phone, wechat, address, notes, tags } = data;

  if (!name || !name.trim()) {
    throw new ValidationError('请输入客户姓名');
  }

  const customerCode = await generateCustomerCode();
  const tagsStr = serializeTags(tags);

  const customer = await db.customer.create({
    data: { customerCode, name, phone, wechat, address, notes, tags: tagsStr },
  });

  return { ...customer, tags: tags || [] };
}

/**
 * 查询客户详情（含购买统计、月度趋势、偏好材质、VIP等级、关联销售记录）
 * @throws {NotFoundError} 客户不存在
 */
export async function getCustomerById(id: number) {
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      saleRecords: {
        include: {
          item: {
            include: {
              material: true,
              type: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      },
    },
  });

  if (!customer) {
    throw new NotFoundError('未找到');
  }

  const parsedTags = parseTags(customer.tags);
  const saleRecords = customer.saleRecords || [];
  const purchaseStats = calculatePurchaseStats(saleRecords);
  const monthlySpending = calculateMonthlySpending(saleRecords);
  const topMaterials = calculateTopMaterials(saleRecords);
  const vipProgress = calculateVipProgress(purchaseStats.totalSpending);

  return {
    ...customer,
    tags: parsedTags,
    purchaseStats,
    monthlySpending,
    topMaterials,
    vipProgress,
  };
}

/**
 * 更新客户信息
 * @throws {NotFoundError} 客户不存在
 */
export async function updateCustomer(id: number, data: UpdateCustomerInput) {
  // 检查客户是否存在
  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('未找到');
  }

  const updateData: any = { ...data };
  // tags 数组转 JSON 存储
  if (Array.isArray(data.tags)) {
    updateData.tags = data.tags.length > 0 ? JSON.stringify(data.tags) : null;
  }

  const customer = await db.customer.update({
    where: { id },
    data: updateData,
  });

  return { ...customer, tags: parseTags(customer.tags) };
}

/**
 * 删除客户（软删除 isActive=false）
 * 存在有效销售记录时拒绝删除
 * @throws {NotFoundError} 客户不存在
 * @throws {ValidationError} 有有效销售记录
 */
export async function deleteCustomer(id: number) {
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) {
    throw new NotFoundError('未找到');
  }

  // 检查是否有有效销售记录（状态为 sold 的货品）
  const activeSales = await db.saleRecord.count({
    where: { customerId: id, item: { status: 'sold' } },
  });
  if (activeSales > 0) {
    throw new ValidationError(`该客户有 ${activeSales} 笔有效销售记录，无法删除`);
  }

  await db.customer.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * 合并客户
 * 事务内：更新销售记录归属 + 软删除源客户 + OperationLog 审计
 *
 * 散客模式（sourceId === targetId）：仅更新销售记录，不软删除
 * 客户合并模式（sourceId !== targetId）：更新销售记录 + 软删除源客户
 *
 * @throws {NotFoundError} 源客户/目标客户不存在
 * @throws {ValidationError} 销售记录参数无效
 */
export async function mergeCustomers(sourceId: number, input: MergeCustomersInput) {
  const { targetCustomerId, saleRecordIds } = input;

  // 参数校验
  if (!targetCustomerId || isNaN(targetCustomerId)) {
    throw new ValidationError('请提供有效的目标客户ID');
  }
  if (!saleRecordIds || !Array.isArray(saleRecordIds) || saleRecordIds.length === 0) {
    throw new ValidationError('请选择至少一条销售记录');
  }

  // 去重并确保都是整数
  const uniqueIds = Array.from(new Set(saleRecordIds.map((id: any) => parseInt(id)))).filter(
    (id) => !isNaN(id),
  );
  if (uniqueIds.length === 0) {
    throw new ValidationError('无效的销售记录ID');
  }

  const isUnlinkedMerge = targetCustomerId === sourceId;

  // 校验目标客户
  const targetCustomer = await db.customer.findUnique({ where: { id: targetCustomerId } });
  if (!targetCustomer) {
    throw new NotFoundError('目标客户不存在');
  }

  // 校验源客户（仅非散客合并时）
  let sourceCustomer: { id: number; name: string } | null = null;
  if (!isUnlinkedMerge) {
    sourceCustomer = await db.customer.findUnique({ where: { id: sourceId } });
    if (!sourceCustomer) {
      throw new NotFoundError('源客户不存在');
    }
  }

  // 校验所有销售记录是否存在
  const existingSales = await db.saleRecord.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  const existingIds = new Set(existingSales.map((s) => s.id));
  const missing = uniqueIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError(`以下销售记录不存在: ${missing.join(', ')}`);
  }

  // 事务：转移销售记录 + 软删除源客户
  const result = await db.$transaction(async (tx) => {
    const updatedCount = await tx.saleRecord.updateMany({
      where: { id: { in: uniqueIds } },
      data: { customerId: targetCustomerId },
    });

    if (!isUnlinkedMerge) {
      await tx.customer.update({
        where: { id: sourceId },
        data: { isActive: false },
      });
    }

    return { updatedCount: updatedCount.count };
  });

  // 审计日志
  await logAction('merge_customer', 'customer', sourceId, {
    sourceCustomerId: isUnlinkedMerge ? null : sourceId,
    sourceName: sourceCustomer?.name || '(散客)',
    targetCustomerId,
    targetName: targetCustomer.name,
    saleRecordIds: uniqueIds,
    saleRecordCount: uniqueIds.length,
    isUnlinkedMerge,
  });

  return {
    mergedSales: result.updatedCount,
    sourceCustomer: isUnlinkedMerge
      ? null
      : { id: sourceId, name: sourceCustomer?.name },
    targetCustomer: { id: targetCustomerId, name: targetCustomer.name },
    isUnlinkedMerge,
  };
}
