import { db } from '@/lib/db';

// ============================================================
// 类型定义
// ============================================================

export interface ExportInventoryParams {
  materialId?: string | null;
  status?: string | null;
}

export interface ExportSalesParams {
  startDate?: string | null;
  endDate?: string | null;
}

// ============================================================
// 导出方法
// ============================================================

/**
 * 获取库存CSV导出数据（行列结构）
 * JOIN材质/器型/规格，按SKU升序
 */
export async function getExportInventoryData(params: ExportInventoryParams) {
  const where: any = { isDeleted: false };
  if (params.materialId) where.materialId = parseInt(params.materialId);
  if (params.status) where.status = params.status;

  const items = await db.item.findMany({
    where,
    include: { material: true, type: true, spec: true, tags: true },
    orderBy: { skuCode: 'asc' },
  });

  const headers = ['SKU', '名称', '材质', '器型', '成本', '分摊成本', '售价', '底价', '状态', '产地', '柜台', '证书号', '入库日期'];
  const rows = items.map(item => [
    item.skuCode,
    item.name || '',
    item.material?.name || '',
    item.type?.name || '',
    item.costPrice?.toFixed(2) || '',
    item.allocatedCost?.toFixed(2) || '',
    item.sellingPrice?.toFixed(2) || '',
    item.floorPrice?.toFixed(2) || '',
    { in_stock: '在库', sold: '已售', returned: '已退' }[item.status] || item.status,
    item.origin || '',
    item.counter?.toString() || '',
    item.certNo || '',
    item.purchaseDate || '',
  ]);

  return { headers, rows };
}

/**
 * 获取销售CSV导出数据（行列结构）
 * JOIN货品/客户，按销售日期降序
 */
export async function getExportSalesData(params: ExportSalesParams) {
  const where: any = {};
  if (params.startDate) where.saleDate = { ...where.saleDate, gte: params.startDate };
  if (params.endDate) where.saleDate = { ...where.saleDate, lte: params.endDate };

  const sales = await db.saleRecord.findMany({
    where,
    include: { item: { include: { material: true } }, customer: true },
    orderBy: { saleDate: 'desc' },
  });

  const headers = ['销售单号', 'SKU', '货品名称', '材质', '成交价', '渠道', '销售日期', '客户', '成本', '毛利'];
  const rows = sales.map(s => [
    s.saleNo,
    s.item?.skuCode || '',
    s.item?.name || '',
    s.item?.material?.name || '',
    s.actualPrice.toFixed(2),
    { store: '门店', wechat: '微信' }[s.channel] || s.channel,
    s.saleDate,
    s.customer?.name || '',
    (s.item?.allocatedCost || s.item?.costPrice || 0).toFixed(2),
    (s.actualPrice - (s.item?.allocatedCost || s.item?.costPrice || 0)).toFixed(2),
  ]);

  return { headers, rows };
}

/**
 * 获取批次CSV导出数据（行列结构）
 * JOIN材质/货品/销售记录，按创建时间降序
 * 含计算字段：已售数、回款、利润、回本率、状态
 */
export async function getExportBatchesData() {
  const batches = await db.batch.findMany({
    include: { material: true, items: { where: { isDeleted: false }, include: { saleRecords: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['批次编号', '材质', '数量', '总成本', '分摊方式', '已售数', '已回款', '利润', '回本率', '状态'];
  const rows = batches.map(b => {
    const soldItems = b.items.filter(i => i.status === 'sold');
    const soldCount = soldItems.length;
    const revenue = soldItems.reduce((sum, item) => sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0), 0);
    const profit = revenue - b.totalCost;
    const paybackRate = b.totalCost > 0 ? revenue / b.totalCost : 0;
    let status = '未开始';
    if (soldCount === 0) status = '未开始';
    else if (soldCount === b.quantity) status = '清仓完毕';
    else if (paybackRate >= 1) status = '已回本';
    else status = '销售中';

    return [
      b.batchCode,
      b.material?.name || '',
      b.quantity.toString(),
      b.totalCost.toFixed(2),
      { equal: '均摊', by_weight: '按克重', by_price: '按售价' }[b.costAllocMethod] || b.costAllocMethod,
      soldCount.toString(),
      revenue.toFixed(2),
      profit.toFixed(2),
      (paybackRate * 100).toFixed(1) + '%',
      status,
    ];
  });

  return { headers, rows };
}
