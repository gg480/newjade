import { db } from '@/lib/db';
import { logAction } from '@/lib/log';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { Prisma } from '@prisma/client';

// ============================================================
// 日期工具函数
// ============================================================

/**
 * 标准化日期输入，支持 YYYY-MM-DD、YYYY/M/D、中文日期等格式
 * 返回 YYYY-MM-DD 或 null
 */
function normalizeDateInput(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[年./]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '');
  const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[3], 10)).padStart(2, '0')}`;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

/**
 * 仅做格式归一化（用于内存过滤时的日期比较），不宽松解析
 */
function normalizeSaleDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const raw = String(dateStr).trim();
  const m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return '';
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[3], 10)).padStart(2, '0')}`;
}

// ============================================================
// 编号生成
// ============================================================

async function generateSaleNo(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `s${today}`;
  const lastSale = await db.saleRecord.findFirst({
    where: { saleNo: { startsWith: prefix } },
    orderBy: { saleNo: 'desc' },
  });
  let seq = 1;
  if (lastSale) {
    const lastSeq = parseInt(lastSale.saleNo.slice(-3));
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

async function generateBundleNo(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `b${today}`;
  const last = await db.bundleSale.findFirst({
    where: { bundleNo: { startsWith: prefix } },
    orderBy: { bundleNo: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.bundleNo.slice(-3));
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// ============================================================
// 类型定义
// ============================================================

/** 销售列表查询参数 */
export interface GetSalesParams {
  page?: number;
  size?: number;
  channel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  customerId?: string | null;
  /** 搜索无关联客户的散客销售（customerId='null' 时生效） */
  unlinkedOnly?: boolean;
  keyword?: string | null;
  /** 按货品名称/SKU搜索 */
  itemKeyword?: string | null;
  /** 最小成交价 */
  minAmount?: string | null;
  /** 最大成交价 */
  maxAmount?: string | null;
  includeReturned?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

/** 创建销售参数 */
export interface CreateSaleInput {
  itemId: number;
  actualPrice: number;
  channel: string;
  saleDate: string;
  customerId?: number | null;
  note?: string | null;
}

/** 更新销售参数 */
export interface UpdateSaleInput {
  actualPrice?: number;
  channel?: string;
  saleDate?: string;
  customerId?: number | null;
  note?: string | null;
}

/** 退货参数 */
export interface ProcessReturnInput {
  saleId: number;
  refundAmount?: number | null;
  returnReason?: string | null;
  returnDate?: string | null;
}

/** 套装销售参数 */
export interface CreateBundleSaleInput {
  itemIds: number[];
  totalPrice: number;
  allocMethod: 'by_ratio' | 'chain_at_cost';
  channel: string;
  saleDate: string;
  customerId?: number | null;
  note?: string | null;
  chainItems?: boolean[];
}

// ============================================================
// 公共 include 模板
// ============================================================

const saleInclude = {
  item: { include: { material: true, type: true } },
  customer: true,
  bundle: true,
} as const;

// ============================================================
// 服务方法
// ============================================================

/**
 * 查询销售列表（含多条件筛选、分页、内存日期过滤）
 * 默认排除已退货记录，可通过 includeReturned=true 查看全部
 */
export async function getSales(params: GetSalesParams) {
  const page = params.page || 1;
  const size = params.size || 20;
  const channel = params.channel || undefined;
  const startDate = params.startDate || undefined;
  const endDate = params.endDate || undefined;
  const customerIdRaw = params.customerId || undefined;
  const unlinkedOnly = params.unlinkedOnly === true || customerIdRaw === 'null';
  const keyword = params.keyword || undefined;
  const itemKeyword = params.itemKeyword || undefined;
  const minAmount = params.minAmount ? parseFloat(params.minAmount) : undefined;
  const maxAmount = params.maxAmount ? parseFloat(params.maxAmount) : undefined;
  const includeReturned = params.includeReturned === true;
  const sortBy = params.sortBy || 'sale_date';
  const sortOrder = params.sortOrder || 'desc';

  // 构建 where 条件
  const where: Prisma.SaleRecordWhereInput = {};

  if (channel) where.channel = channel;

  // 散客模式：搜索无关联客户的销售记录
  if (unlinkedOnly) {
    where.customerId = null;
  } else if (customerIdRaw && customerIdRaw !== 'null') {
    where.customerId = parseInt(customerIdRaw);
  }

  if (keyword) {
    where.OR = [
      { saleNo: { contains: keyword } },
      { item: { is: { skuCode: { contains: keyword } } } },
      { item: { is: { name: { contains: keyword } } } },
      { customer: { is: { name: { contains: keyword } } } },
      { customer: { is: { phone: { contains: keyword } } } },
    ];
  }

  // 按货品名称/SKU搜索（用于客户合并时的散客回溯）
  if (itemKeyword) {
    // 将 itemKeyword 条件合并到已有的 OR 中
    const itemCondition = {
      OR: [
        { item: { is: { skuCode: { contains: itemKeyword } } } },
        { item: { is: { name: { contains: itemKeyword } } } },
      ],
    };
    if (where.OR) {
      where.AND = [{ OR: where.OR }, itemCondition];
      delete where.OR;
    } else {
      Object.assign(where, itemCondition);
    }
  }

  // 金额范围过滤
  if (minAmount !== undefined && !isNaN(minAmount)) {
    (where.actualPrice as any) = { ...((where.actualPrice as any) || {}), gte: minAmount };
  }
  if (maxAmount !== undefined && !isNaN(maxAmount)) {
    (where.actualPrice as any) = { ...((where.actualPrice as any) || {}), lte: maxAmount };
  }

  if (!includeReturned) {
    where.saleReturns = { none: {} };
  }

  const direction = sortOrder === 'asc' ? 'asc' : 'desc';
  const orderByMap: Record<string, Prisma.SaleRecordOrderByWithRelationInput> = {
    created_at: { createdAt: direction },
    sale_no: { saleNo: direction },
    sale_date: { saleDate: direction },
    channel: { channel: direction },
    actual_price: { actualPrice: direction },
    item_sku: { item: { skuCode: direction } },
    item_name: { item: { name: direction } },
    customer_name: { customer: { name: direction } },
  };
  const orderBy = orderByMap[sortBy] || orderByMap.created_at;

  let total = 0;
  let records: any[] = [];

  // 日期过滤：历史数据存在 YYYY-MM-DD 和 YYYY/M/D 混合格式，
  // 为保证准确性，在内存中做归一化过滤
  if (startDate || endDate) {
    const all = await db.saleRecord.findMany({ where, include: saleInclude });

    const startNorm = normalizeSaleDate(startDate);
    const endNorm = normalizeSaleDate(endDate);
    const filtered = all.filter((r: any) => {
      const d = normalizeSaleDate(r.saleDate);
      if (!d) return false;
      if (startNorm && d < startNorm) return false;
      if (endNorm && d > endNorm) return false;
      return true;
    });

    const sorted = filtered.sort((a: any, b: any) => {
      const dir = direction === 'asc' ? 1 : -1;
      const cmpStr = (x: string, y: string) => x.localeCompare(y) * dir;
      const cmpNum = (x: number, y: number) => (x - y) * dir;
      switch (sortBy) {
        case 'sale_no': return cmpStr(a.saleNo || '', b.saleNo || '');
        case 'sale_date': return cmpStr(normalizeSaleDate(a.saleDate), normalizeSaleDate(b.saleDate));
        case 'channel': return cmpStr(a.channel || '', b.channel || '');
        case 'actual_price': return cmpNum(a.actualPrice || 0, b.actualPrice || 0);
        case 'item_sku': return cmpStr(a.item?.skuCode || '', b.item?.skuCode || '');
        case 'item_name': return cmpStr(a.item?.name || '', b.item?.name || '');
        case 'customer_name': return cmpStr(a.customer?.name || '', b.customer?.name || '');
        case 'created_at':
        default:
          return cmpStr(String(a.createdAt || ''), String(b.createdAt || ''));
      }
    });

    total = sorted.length;
    records = sorted.slice((page - 1) * size, (page - 1) * size + size);
  } else {
    total = await db.saleRecord.count({ where });
    records = await db.saleRecord.findMany({
      where,
      include: saleInclude,
      orderBy,
      skip: (page - 1) * size,
      take: size,
    });
  }

  // 附加计算字段（前端消费）
  const items = records.map((r: any) => ({
    ...r,
    itemSku: r.item?.skuCode,
    itemName: r.item?.name,
    customerName: r.customer?.name,
    customerPhone: r.customer?.phone,
    materialName: r.item?.material?.name,
    typeName: r.item?.type?.name,
    counter: r.item?.counter,
    costPrice: r.item?.allocatedCost ?? r.item?.costPrice ?? 0,
    cost: r.item?.allocatedCost ?? r.item?.costPrice ?? 0,
    grossProfit: r.actualPrice - (r.item?.allocatedCost ?? r.item?.costPrice ?? 0),
  }));

  return {
    items,
    pagination: { total, page, size, pages: Math.ceil(total / size) },
  };
}

/**
 * 按 ID 查询销售详情（含关联 Item、Customer、Bundle）
 * @throws {NotFoundError} 销售记录不存在时抛出
 */
export async function getSaleById(id: number) {
  const record = await db.saleRecord.findUnique({
    where: { id },
    include: saleInclude,
  });
  if (!record) throw new NotFoundError('销售记录不存在');
  return record;
}

/**
 * 创建单件销售记录
 * 事务内完成：创建 SaleRecord + 更新 Item 状态为 sold
 * @throws {ValidationError} 货品不存在/不在库时抛出
 */
export async function createSale(data: CreateSaleInput) {
  // 校验货品
  const item = await db.item.findUnique({ where: { id: data.itemId } });
  if (!item || item.isDeleted) {
    throw new ValidationError('货品不存在');
  }
  if (item.status !== 'in_stock') {
    throw new ValidationError('货品不在库，无法出售');
  }

  const saleNo = await generateSaleNo();

  // 事务：创建销售记录 + 更新货品状态
  const record = await db.$transaction(async (tx) => {
    const sale = await tx.saleRecord.create({
      data: {
        saleNo,
        itemId: data.itemId,
        actualPrice: data.actualPrice,
        channel: data.channel,
        saleDate: data.saleDate,
        customerId: data.customerId ?? null,
        note: data.note ?? null,
      },
    });
    await tx.item.update({ where: { id: data.itemId }, data: { status: 'sold' } });
    return sale;
  });

  // 日志（事务外，非关键）
  await logAction('sell_item', 'sale', record.id, {
    saleNo,
    itemSku: item.skuCode,
    actualPrice: data.actualPrice,
    channel: data.channel,
    saleDate: data.saleDate,
  });

  return record;
}

/**
 * 更新销售记录
 * 记录变更前后的关键字段差异到操作日志
 * @throws {NotFoundError} 销售记录不存在时抛出
 * @throws {ValidationError} 参数校验失败时抛出
 */
export async function updateSale(id: number, data: UpdateSaleInput) {
  const original = await db.saleRecord.findUnique({ where: { id } });
  if (!original) throw new NotFoundError('销售记录不存在');

  const updated = await db.saleRecord.update({
    where: { id },
    data: {
      actualPrice: data.actualPrice,
      channel: data.channel,
      saleDate: data.saleDate,
      customerId: data.customerId,
      note: data.note ?? null,
    },
    include: saleInclude,
  });

  await logAction('edit_sale', 'sale', id, {
    saleNo: updated.saleNo,
    before: {
      actualPrice: original.actualPrice,
      channel: original.channel,
      saleDate: original.saleDate,
      customerId: original.customerId,
      note: original.note,
    },
    after: {
      actualPrice: updated.actualPrice,
      channel: updated.channel,
      saleDate: updated.saleDate,
      customerId: updated.customerId,
      note: updated.note,
    },
  });

  return updated;
}

/**
 * 处理退货
 * 创建 SaleReturn 记录 + 更新货品状态为 returned
 * @throws {NotFoundError} 销售记录不存在时抛出
 * @throws {ValidationError} 货品状态不是 sold 时抛出
 */
export async function processReturn(data: ProcessReturnInput) {
  // 校验销售记录存在
  const sale = await db.saleRecord.findUnique({
    where: { id: data.saleId },
    include: { item: true },
  });
  if (!sale) throw new NotFoundError('销售记录不存在');

  // 校验货品状态
  if (sale.item.status !== 'sold') {
    throw new ValidationError(`货品当前状态为「${sale.item.status}」，无法退货`);
  }

  const today = data.returnDate || new Date().toISOString().slice(0, 10);
  const refund = data.refundAmount ?? sale.actualPrice;

  // 创建退货记录
  const returnRecord = await db.saleReturn.create({
    data: {
      saleId: data.saleId,
      itemId: sale.itemId,
      refundAmount: refund,
      returnReason: data.returnReason || '客户退货',
      returnDate: today,
    },
  });

  // 更新货品状态
  await db.item.update({
    where: { id: sale.itemId },
    data: { status: 'returned' },
  });

  // 操作日志
  await logAction('return_sale', 'sale', data.saleId, {
    saleNo: sale.saleNo,
    itemSku: sale.item.skuCode,
    refundAmount: refund,
    returnReason: data.returnReason || '客户退货',
    returnDate: today,
  });

  return returnRecord;
}

/**
 * 创建套装销售（一单多件）
 * 支持两种分摊方式：by_ratio（按售价比例）、chain_at_cost（链件原价+主件剩余）
 * 事务内：创建 BundleSale + N 个 SaleRecord + 更新 N 个 Item 状态为 sold
 * @throws {ValidationError} 参数校验失败、货品无效/不在库、分摊失败时抛出
 */
export async function createBundleSale(data: CreateBundleSaleInput) {
  const allowedAllocMethods = new Set(['by_ratio', 'chain_at_cost']);

  // 校验参数
  if (data.itemIds.length < 2) {
    throw new ValidationError('套装至少2件货品');
  }
  if (isNaN(data.totalPrice) || data.totalPrice <= 0) {
    throw new ValidationError('请输入有效的套装总价');
  }
  if (!allowedAllocMethods.has(data.allocMethod)) {
    throw new ValidationError('不支持的套装分摊方式');
  }

  // 校验货品
  const uniqueItemIds = Array.from(new Set(data.itemIds));
  const items = await db.item.findMany({ where: { id: { in: uniqueItemIds } } });
  if (items.length !== uniqueItemIds.length) {
    throw new ValidationError('存在无效货品ID，请刷新后重试');
  }
  const notInStock = items.filter((i) => i.status !== 'in_stock' || i.isDeleted);
  if (notInStock.length > 0) {
    throw new ValidationError(
      `以下货品不在库: ${notInStock.map((i) => i.skuCode).join(', ')}`,
    );
  }

  // 分摊计算
  const allocations: { itemId: number; price: number }[] = [];

  if (data.allocMethod === 'by_ratio') {
    const totalSelling = items.reduce((sum, i) => sum + i.sellingPrice, 0);
    if (totalSelling <= 0) {
      throw new ValidationError('按比例分摊失败：货品售价合计必须大于0');
    }
    let allocated = 0;
    items.forEach((item, i) => {
      if (i === items.length - 1) {
        allocations.push({
          itemId: item.id,
          price: Math.round((data.totalPrice - allocated) * 100) / 100,
        });
      } else {
        const price =
          Math.round((item.sellingPrice / totalSelling) * data.totalPrice * 100) / 100;
        allocated += price;
        allocations.push({ itemId: item.id, price });
      }
    });
  } else if (data.allocMethod === 'chain_at_cost') {
    const chainItems = data.chainItems || uniqueItemIds.map(() => false);
    if (chainItems.length !== items.length) {
      throw new ValidationError('链件标记数量与货品数量不一致');
    }
    let chainTotal = 0;
    items.forEach((item, i) => {
      if (chainItems[i]) {
        chainTotal += item.sellingPrice;
        allocations.push({ itemId: item.id, price: item.sellingPrice });
      }
    });
    const mainItemIndices = items.map((_, i) => i).filter((i) => !chainItems[i]);
    const mainTotal = data.totalPrice - chainTotal;
    if (mainItemIndices.length > 0) {
      const mainSelling = mainItemIndices.reduce((sum, i) => sum + items[i].sellingPrice, 0);
      let allocated = 0;
      mainItemIndices.forEach((idx, j) => {
        if (j === mainItemIndices.length - 1) {
          allocations.push({
            itemId: items[idx].id,
            price: Math.round((mainTotal - allocated) * 100) / 100,
          });
        } else {
          const price =
            Math.round((items[idx].sellingPrice / mainSelling) * mainTotal * 100) / 100;
          allocated += price;
          allocations.push({ itemId: items[idx].id, price });
        }
      });
    }
  }

  if (allocations.length !== items.length) {
    throw new ValidationError('套装分摊失败：部分货品未分配价格');
  }

  // 事务：创建套装 + 销售记录 + 更新货品状态
  const bundleNo = await generateBundleNo();
  const saleNo = await generateSaleNo();
  const bundle = await db.$transaction(async (tx) => {
    const b = await tx.bundleSale.create({
      data: {
        bundleNo,
        totalPrice: data.totalPrice,
        allocMethod: data.allocMethod,
        saleDate: data.saleDate,
        channel: data.channel,
        customerId: data.customerId ?? null,
        note: data.note ?? null,
      },
    });

    const baseSeq = parseInt(saleNo.slice(-3)) || 0;
    for (const [index, alloc] of allocations.entries()) {
      const seq = baseSeq + index + 1;
      await tx.saleRecord.create({
        data: {
          saleNo: `${saleNo.slice(0, -3)}${String(seq).padStart(3, '0')}`,
          itemId: alloc.itemId,
          actualPrice: alloc.price,
          channel: data.channel,
          saleDate: data.saleDate,
          customerId: data.customerId ?? null,
          bundleId: b.id,
        },
      });
      await tx.item.update({ where: { id: alloc.itemId }, data: { status: 'sold' } });
    }

    return b;
  });

  return { bundle, allocations };
}

/** 导出日期工具供 route 层使用（参数校验阶段） */
export { normalizeDateInput };
