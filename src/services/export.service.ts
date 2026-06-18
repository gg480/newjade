import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// ============================================================
// 类型定义
// ============================================================

type ItemSpecFields = {
  weight: number | null;
  metalWeight: number | null;
  size: string | null;
  braceletSize: string | null;
  beadCount: number | null;
  beadDiameter: string | null;
  ringSize: string | null;
};

export interface ExportInventoryParams {
  materialId?: string | null;
  status?: string | null;
}

export interface ExportSalesParams {
  startDate?: string | null;
  endDate?: string | null;
}

export interface LabelExportParams {
  ids?: number[];
}

// ============================================================
// 导出方法
// ============================================================

/**
 * 获取全量库存导出数据（所有字段）
 * 用于导出完整库存表格，含所有关联字段
 */
export async function getFullExportData() {
  const items = await db.item.findMany({
    where: { isDeleted: false },
    include: {
      material: true,
      type: true,
      spec: true,
      tags: true,
      batch: { select: { batchCode: true, totalCost: true, costAllocMethod: true } },
      supplier: { select: { name: true } },
      materialComponents: { include: { material: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { skuCode: 'asc' },
  });

  const headers = [
    'SKU', '货品名称', '材质', '材质类别', '器型',
    '批次编号', '批次总成本', '分摊方式',
    '成本价', '分摊成本', '售价', '底价',
    '货品类型', '主石材质', '主石售价', '镶材', '镶材重量', '伴石材质', '伴石售价', '组合组件',
    '重量(g)', '金重(g)', '尺寸', '圈口', '颗数', '珠径', '戒圈',
    '产地', '柜台', '证书号', '供应商', '备注',
    '状态', '入库日期', '标签',
    '创建时间', '更新时间',
  ];

  const rows = items.map(item => {
    // 标签
    const tagNames = item.tags?.map(t => t.name).join('、') || '';

    // ADR-020 材质组件
    const mainStone = item.materialComponents?.find(c => c.role === 'main_stone');
    const settingMat = item.materialComponents?.find(c => c.role === 'setting_material');
    const companionStone = item.materialComponents?.find(c => c.role === 'companion_stone');
    const otherComps = item.materialComponents?.filter(c => c.role === 'component') || [];

    const compositeTypeLabel = item.compositeType === 'inlay' ? '镶嵌型'
      : item.compositeType === 'composite' ? '组合型' : '单材质';

    const compDesc = otherComps.map(c => `${c.material?.name || ''}`).join(' / ');

    return [
      item.skuCode,
      item.name || '',
      item.material?.name || '',
      item.material?.category || '',
      item.type?.name || '',
      item.batch?.batchCode || '',
      item.batch?.totalCost?.toFixed(2) || '',
      item.batch?.costAllocMethod === 'equal' ? '均摊'
        : item.batch?.costAllocMethod === 'by_weight' ? '按克重'
        : item.batch?.costAllocMethod === 'by_price' ? '按售价' : '',
      item.costPrice?.toFixed(2) || '',
      item.allocatedCost?.toFixed(2) || '',
      item.sellingPrice?.toFixed(2) || '',
      item.floorPrice?.toFixed(2) || '',
      compositeTypeLabel,
      mainStone?.material?.name || '',
      mainStone?.sellingPrice?.toFixed(2) || '',
      settingMat?.material?.name || '',
      settingMat?.weight != null ? `${settingMat.weight}g` : '',
      companionStone?.material?.name || '',
      companionStone?.sellingPrice?.toFixed(2) || '',
      compDesc,
      item.spec?.weight?.toFixed(2) != null ? item.spec.weight.toFixed(2) : '',
      item.spec?.metalWeight?.toFixed(2) != null ? item.spec.metalWeight.toFixed(2) : '',
      item.spec?.size || '',
      item.spec?.braceletSize || '',
      item.spec?.beadCount?.toString() || '',
      item.spec?.beadDiameter || '',
      item.spec?.ringSize || '',
      item.origin || '',
      item.counter?.toString() || '',
      item.certNo || '',
      item.supplier?.name || '',
      item.notes || '',
      { in_stock: '在库', sold: '已售', returned: '已退' }[item.status] || item.status,
      item.purchaseDate || '',
      tagNames,
      item.createdAt?.toISOString().slice(0, 19).replace('T', ' ') || '',
      item.updatedAt?.toISOString().slice(0, 19).replace('T', ' ') || '',
    ];
  });

  return { headers, rows };
}

/**
 * 获取库存CSV导出数据（行列结构）
 * JOIN材质/器型/规格，按SKU升序
 */
export async function getExportInventoryData(params: ExportInventoryParams) {
  const where: Prisma.ItemWhereInput = { isDeleted: false };
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
 * 构建规格描述字符串（从 ItemSpec 真实字段拼接）
 */
function buildSpecLabel(spec: ItemSpecFields): string {
  const labels: Record<string, string> = {
    weight: '克重', metalWeight: '金重', size: '尺寸',
    braceletSize: '圈口', beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈',
  };
  const parts: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const val = (spec as any)[key];
    if (val != null && val !== '') {
      parts.push(`${label}:${val}${key === 'weight' || key === 'metalWeight' ? 'g' : key === 'beadDiameter' ? 'mm' : ''}`);
    }
  }
  return parts.join(' ');
}

/**
 * 获取标签打印CSV导出数据（行列结构）
 * 查询指定的未删除货品，JOIN材质/器型/规格
 * 用于德佟P2热敏标签打印机「微打」App导入
 */
export async function getLabelExportData(params: LabelExportParams) {
  const { ids } = params;

  const where: Prisma.ItemWhereInput = { isDeleted: false };
  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }

  const items = await db.item.findMany({
    where,
    include: { material: true, type: true, spec: true },
    orderBy: { skuCode: 'asc' },
  });

  const headers = ['商品名称', '售价', '规格', '条形码'];
  const rows = items.map(item => {
    const isPreciousMetal = item.material?.category === '贵金属';
    return [
      item.name || '',
      isPreciousMetal && item.spec?.weight != null
        ? `${item.spec.weight}g`
        : item.sellingPrice?.toFixed(2) || '',
      isPreciousMetal ? '' : (item.spec ? buildSpecLabel(item.spec) : ''),
      item.skuCode,
    ];
  });

  return { headers, rows };
}

/**
 * 获取销售CSV导出数据（行列结构）
 * JOIN货品/客户，按销售日期降序
 */
export async function getExportSalesData(params: ExportSalesParams) {
  const where: Prisma.SaleRecordWhereInput = {};
  if (params.startDate) where.saleDate = { gte: params.startDate };
  if (params.endDate) where.saleDate = { ...(where.saleDate as object), lte: params.endDate };

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
