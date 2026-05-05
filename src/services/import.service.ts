import { db } from '@/lib/db';
import { logAction } from '@/lib/log';

// ============================================================
// 日期工具
// ============================================================

/**
 * 标准化日期输入，支持 YYYY-MM-DD、YYYY/M/D、Excel 序列号、中文日期
 * 返回 YYYY-MM-DD 或 null
 */
export function normalizeDateInput(input: string | null | undefined): string | null {
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
  const num = Number(raw);
  if (!Number.isNaN(num) && num > 20000 && num < 100000) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(base.getTime() + num * 86400000);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

// ============================================================
// SKU 生成
// ============================================================

/**
 * 自动生成 SKU 编码（格式：{材质ID2位}{器型ID2位}-{MMDD}-{序号3位}）
 * 用于 items-csv 导入
 */
export async function generateSkuCode(materialId: number, typeId?: number | null): Promise<string> {
  const mCode = String(materialId).padStart(2, '0');
  const tCode = typeId ? String(typeId).padStart(2, '0') : '00';
  const today = new Date();
  const dateStr = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const prefixFull = `${mCode}${tCode}-${dateStr}-`;

  const existingItems = await db.item.findMany({
    where: { skuCode: { startsWith: prefixFull } },
    select: { skuCode: true },
  });

  let maxSeq = 0;
  for (const item of existingItems) {
    const parts = item.skuCode.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  return `${prefixFull}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * 生成 SKU（带重试机制，最多 8 次，处理并发唯一约束冲突）
 */
export async function createItemWithGeneratedSku(
  data: Omit<Parameters<typeof db.item.create>[0]['data'], 'skuCode'>,
  materialId: number,
  typeId: number | null,
): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const skuCode = await generateSkuCode(materialId, typeId);
    try {
      await db.item.create({
        data: {
          ...data,
          skuCode,
        },
      });
      return;
    } catch (err: unknown) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('Unique constraint failed on the fields: (`sku_code`)')) {
        throw err;
      }
    }
  }
  throw lastErr ?? new Error('生成SKU失败，请重试');
}

// ============================================================
// 字典查找/创建（用于 items-csv 导入）
// ============================================================

const MATERIAL_CATEGORY_MAP: Record<string, string> = {
  '翡翠': '玉', '和田玉': '玉', '玉': '玉', '碧玉': '玉', '青玉': '玉', '白玉': '玉', '糖玉': '玉', '墨玉': '玉', '黄玉': '玉',
  '黄金': '贵金属', '银': '贵金属', '铂金': '贵金属', '18K金': '贵金属', 'k铂金': '贵金属', 'K金': '贵金属',
  '珍珠': '其他', '珊瑚': '其他', '砗磲': '其他',
  '朱砂': '文玩', '蜜蜡': '文玩', '琥珀': '文玩', '绿松石': '文玩', '南红': '文玩', '沉香': '文玩',
  '紫水晶': '水晶', '黄水晶': '水晶', '粉水晶': '水晶', '白水晶': '水晶', '发晶': '水晶', '黑曜石': '水晶',
};

/**
 * 按名称查找或自动创建材质
 */
export async function findOrCreateMaterial(name: string, materialCache: Map<string, any>): Promise<number> {
  if (!name || !name.trim()) {
    const uncategorized = materialCache.get('未分类');
    if (uncategorized) return uncategorized.id;
    const created = await db.dictMaterial.create({ data: { name: '未分类', category: '其他', sortOrder: 99 } });
    materialCache.set('未分类', created);
    return created.id;
  }
  const trimmed = name.trim();
  const cached = materialCache.get(trimmed);
  if (cached) return cached.id;

  const category = MATERIAL_CATEGORY_MAP[trimmed] || '其他';
  const created = await db.dictMaterial.create({
    data: { name: trimmed, category },
  });
  console.log(`[IMPORT] Auto-created material: ${trimmed} (${category}), id=${created.id}`);
  materialCache.set(trimmed, created);
  return created.id;
}

/**
 * 按名称查找或自动创建器型
 */
export async function findOrCreateType(name: string, typeCache: Map<string, any>): Promise<number | null> {
  if (!name || !name.trim()) {
    const uncategorized = typeCache.get('未分类');
    if (uncategorized) return uncategorized.id;
    const lastType = await db.dictType.findFirst({ orderBy: { sortOrder: 'desc' } });
    const sortOrder = (lastType?.sortOrder || 0) + 1;
    const created = await db.dictType.create({
      data: { name: '未分类', specFields: JSON.stringify({ weight: { required: false } }), sortOrder },
    });
    typeCache.set('未分类', created);
    return created.id;
  }
  const trimmed = name.trim();
  const cached = typeCache.get(trimmed);
  if (cached) return cached.id;

  const lastType = await db.dictType.findFirst({ orderBy: { sortOrder: 'desc' } });
  const sortOrder = (lastType?.sortOrder || 0) + 1;
  const created = await db.dictType.create({
    data: { name: trimmed, specFields: JSON.stringify({ weight: { required: false } }), sortOrder },
  });
  console.log(`[IMPORT] Auto-created type: ${trimmed}, id=${created.id}`);
  typeCache.set(trimmed, created);
  return created.id;
}

/**
 * 从货品名称推断材质和器型
 */
export function inferFromName(name: string): { material?: string; type?: string } {
  if (!name) return {};
  const result: { material?: string; type?: string } = {};

  const materialKeywords: [string, string][] = [
    ['翡翠', '翡翠'], ['和田玉', '和田玉'], ['碧玉', '碧玉'], ['青玉', '青玉'],
    ['白玉', '白玉'], ['黄金', '黄金'], ['18K', '18K金'], ['银', '银'],
    ['铂金', '铂金'], ['蜜蜡', '蜜蜡'], ['琥珀', '琥珀'], ['朱砂', '朱砂'],
    ['绿松石', '绿松石'], ['南红', '南红'], ['紫水晶', '紫水晶'], ['黄水晶', '黄水晶'],
    ['粉水晶', '粉水晶'], ['白水晶', '白水晶'], ['发晶', '发晶'], ['黑曜石', '黑曜石'],
    ['沉香', '沉香'], ['珍珠', '珍珠'], ['珊瑚', '珊瑚'],
  ];
  for (const [keyword, material] of materialKeywords) {
    if (name.includes(keyword)) {
      result.material = material;
      break;
    }
  }

  const typeKeywords: [string, string][] = [
    ['手镯', '手镯'], ['手链', '手链'], ['项链', '项链'], ['脚链', '脚链'],
    ['戒指', '戒指'], ['吊坠', '吊坠'], ['耳环', '耳饰'], ['耳钉', '耳饰'], ['耳饰', '耳饰'],
    ['摆件', '摆件'], ['挂件', '吊坠'], ['平安扣', '吊坠'], ['珠串', '项链'],
  ];
  for (const [keyword, type] of typeKeywords) {
    if (name.includes(keyword)) {
      result.type = type;
      break;
    }
  }

  return result;
}

// ============================================================
// 销售导入
// ============================================================

/** 渠道名称映射 */
export const CHANNEL_MAP: Record<string, string> = {
  '门店': 'store', '微信': 'wechat', '网店': 'wechat', '线上': 'wechat',
  'store': 'store', 'wechat': 'wechat',
};

/** 销售导入单行结果 */
export interface SalesImportRowResult {
  row: number;
  success: boolean;
  skuCode?: string;
  saleNo?: string;
  error?: string;
}

/** 销售导入结果 */
export interface SalesImportResult {
  successCount: number;
  failCount: number;
  results: SalesImportRowResult[];
}

/** 销售编号生成 */
async function generateSaleNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `S-${dateStr}-`;
  const lastSale = await db.saleRecord.findFirst({
    where: { saleNo: { startsWith: prefix } },
    orderBy: { saleNo: 'desc' },
  });
  let seq = 1;
  if (lastSale) {
    const parts = lastSale.saleNo.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * 批量导入销售记录
 * 根据匹配码查找库存货品，创建销售记录并更新货品状态
 * @throws 不主动抛出异常，失败信息记录在 results 中
 */
export async function importSalesRows(
  rows: Record<string, string>[],
  options: { autoCreate: boolean },
): Promise<SalesImportResult> {
  let successCount = 0;
  let failCount = 0;
  const results: SalesImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const name = row['名称'] || row['name'] || row['货品名称'] || '';
      const matchKey = row['匹配码'] || row['matchKey'] || row['关联码'] || '';
      const retailPriceStr = row['零售价'] || row['sellingPrice'] || row['售价'] || row['标价'] || '';
      const actualPriceStr = row['成交价'] || row['actualPrice'] || row['销售价'] || row['售价'] || '';
      const saleDateRaw = row['销售日期'] || row['saleDate'] || row['日期'] || '';
      const saleDate = normalizeDateInput(saleDateRaw);
      const channelInput = row['渠道'] || row['channel'] || '门店';
      const customerName = row['客户姓名'] || row['客户'] || row['customerName'] || '';
      const customerPhone = row['客户电话'] || row['电话'] || row['customerPhone'] || '';
      const note = row['备注'] || row['notes'] || '';

      if (!matchKey) {
        results.push({ row: rowNum, success: false, error: '缺少匹配码（销售导入必须提供匹配码）' });
        failCount++;
        continue;
      }

      if (!actualPriceStr) {
        results.push({ row: rowNum, success: false, error: '缺少成交价' });
        failCount++;
        continue;
      }

      if (saleDateRaw && !saleDate) {
        results.push({ row: rowNum, success: false, error: `销售日期格式无效: ${saleDateRaw}` });
        failCount++;
        continue;
      }

      const actualPrice = parseFloat(actualPriceStr);
      if (isNaN(actualPrice) || actualPrice <= 0) {
        results.push({ row: rowNum, success: false, error: '成交价格式无效' });
        failCount++;
        continue;
      }

      const item = await db.item.findFirst({
        where: {
          notes: { contains: `[MK:${matchKey}]` },
          isDeleted: false,
        },
      });

      if (!item) {
        results.push({ row: rowNum, success: false, error: `匹配码「${matchKey}」未在库存中找到对应货品` });
        failCount++;
        continue;
      }

      if (item.status === 'sold') {
        results.push({ row: rowNum, success: false, skuCode: item.skuCode, error: `SKU「${item.skuCode}」已售出` });
        failCount++;
        continue;
      }

      if (name && item.name && name !== item.name) {
        results.push({
          row: rowNum,
          success: false,
          skuCode: item.skuCode,
          error: `名称与库存不一致（导入=${name}，库存=${item.name}）`,
        });
        failCount++;
        continue;
      }

      if (retailPriceStr) {
        const retailPrice = parseFloat(retailPriceStr);
        if (!isNaN(retailPrice) && item.sellingPrice !== retailPrice) {
          results.push({
            row: rowNum,
            success: false,
            skuCode: item.skuCode,
            error: `零售价与库存不一致（导入=${retailPrice}，库存=${item.sellingPrice}）`,
          });
          failCount++;
          continue;
        }
      }

      const channel = CHANNEL_MAP[channelInput] || 'store';

      let customerId: number | null = null;
      if (customerName && options.autoCreate) {
        let customer = await db.customer.findFirst({ where: { name: customerName } });
        if (!customer) {
          const customerCode = `C${Date.now()}${Math.floor(Math.random() * 1000)}`;
          customer = await db.customer.create({
            data: { customerCode, name: customerName, phone: customerPhone || null },
          });
        }
        if (customer) customerId = customer.id;
      }

      const saleNo = await generateSaleNo();

      const sale = await db.saleRecord.create({
        data: {
          saleNo,
          itemId: item.id,
          actualPrice,
          channel,
          saleDate: saleDate || normalizeDateInput(new Date().toISOString().slice(0, 10))!,
          customerId,
          note: note || null,
        },
      });

      if (item.status !== 'sold') {
        await db.item.update({
          where: { id: item.id },
          data: { status: 'sold' },
        });
      }

      await logAction('import_sale', 'sale', sale.id, {
        saleNo,
        skuCode: item.skuCode,
        matchKey,
        actualPrice,
        saleDate: saleDate || '',
        row: rowNum,
      });

      results.push({ row: rowNum, success: true, skuCode: item.skuCode, saleNo });
      successCount++;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ row: rowNum, success: false, error: `处理失败: ${message}` });
      failCount++;
    }
  }

  return { successCount, failCount, results };
}

// ============================================================
// 货品导入（csv-parse 版本，用于 /api/import/items-csv）
// ============================================================

/** items-csv 导入单行结果 */
export interface ItemsCsvRowResult {
  row: number;
  success: boolean;
  skuCode?: string;
  name?: string;
  error?: string;
}

/** items-csv 导入完整结果 */
export interface ItemsCsvImportResult {
  success: number;
  skipped: number;
  duplicated: number;
  errors: string[];
  autoCreated: { materials: string[]; types: string[] };
  inferred: { row: number; field: string; value: string }[];
  results: ItemsCsvRowResult[];
}

/**
 * 批量导入货品（csv-parse 格式）
 * 从已解析的 CSV 记录创建货品，支持自动创建字典、智能推断、去重
 */
export async function importItemsCsvRows(
  records: Record<string, string>[],
): Promise<ItemsCsvImportResult> {
  const materialCache = new Map<string, any>();
  const typeCache = new Map<string, any>();
  const allMaterials = await db.dictMaterial.findMany();
  const allTypes = await db.dictType.findMany();
  allMaterials.forEach(m => materialCache.set(m.name, m));
  allTypes.forEach(t => typeCache.set(t.name, t));

  let success = 0;
  let skipped = 0;
  let duplicated = 0;
  const errors: string[] = [];
  const autoCreated: { materials: string[]; types: string[] } = { materials: [], types: [] };
  const inferred: { row: number; field: string; value: string }[] = [];
  const results: ItemsCsvRowResult[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;

    try {
      const name = row['名称'] || row['name'] || row['货品名称'] || '';
      const sku = row['SKU'] || row['sku'] || row['编码'] || row['skuCode'] || '';
      const matchKey = row['匹配码'] || row['matchKey'] || row['关联码'] || '';
      let materialName = row['材质'] || row['material'] || row['材质名称'] || '';
      let typeName = row['器型'] || row['type'] || row['器型名称'] || '';
      const costRaw = row['成本价'] || row['costPrice'] || row['成本'] || '';
      const priceRaw = row['零售价'] || row['sellingPrice'] || row['售价'] || row['标价'] || '';
      const counterRaw = row['柜台'] || row['counter'] || '';
      const quantityRaw = row['数量'] || row['quantity'] || row['qty'] || '1';
      const purchaseDate = row['采购日期'] || row['purchaseDate'] || row['入库日期'] || '';
      const origin = row['产地'] || row['origin'] || '';
      const certNo = row['证书号'] || row['certNo'] || '';
      const notes = row['备注'] || row['notes'] || '';

      if (!name) {
        errors.push(`第${rowNum}行: 名称不能为空`);
        skipped++;
        results.push({ row: rowNum, success: false, error: '名称不能为空' });
        continue;
      }

      if (!materialName || !typeName) {
        const inferred_ = inferFromName(name);
        if (!materialName && inferred_.material) {
          materialName = inferred_.material;
          inferred.push({ row: rowNum, field: '材质', value: materialName });
        }
        if (!typeName && inferred_.type) {
          typeName = inferred_.type;
          inferred.push({ row: rowNum, field: '器型', value: typeName });
        }
      }

      let materialId: number;
      {
        const prevSize = materialCache.size;
        materialId = await findOrCreateMaterial(materialName, materialCache);
        if (materialCache.size > prevSize) {
          const newMat = materialCache.get(materialName || '未分类');
          if (newMat && !autoCreated.materials.includes(newMat.name)) {
            autoCreated.materials.push(newMat.name);
          }
        }
      }

      let typeId: number | null = null;
      if (typeName) {
        const prevSize = typeCache.size;
        typeId = await findOrCreateType(typeName, typeCache);
        if (typeCache.size > prevSize) {
          const newType = typeCache.get(typeName);
          if (newType && !autoCreated.types.includes(newType.name)) {
            autoCreated.types.push(newType.name);
          }
        }
      } else {
        typeId = await findOrCreateType('', typeCache);
      }

      const cost = costRaw ? parseFloat(costRaw) : null;
      const price = priceRaw ? parseFloat(priceRaw) : null;
      const counter = counterRaw ? parseInt(counterRaw) : null;
      const quantity = Math.max(1, parseInt(quantityRaw) || 1);

      let parsedDate: string | null = null;
      if (purchaseDate) {
        parsedDate = normalizeDateInput(purchaseDate);
      }

      if (matchKey) {
        const existing = await db.item.findFirst({
          where: {
            notes: { contains: `[MK:${matchKey}]` },
            isDeleted: false,
          },
        });
        if (existing) {
          duplicated++;
          results.push({ row: rowNum, success: false, skuCode: existing.skuCode, error: `匹配码「${matchKey}」已存在，已跳过` });
          continue;
        }
      }

      const notesWithKey = [
        matchKey ? `[MK:${matchKey}]` : '',
        notes,
      ].filter(Boolean).join(' ') || null;

      for (let q = 0; q < quantity; q++) {
        await createItemWithGeneratedSku(
          {
            name: name,
            materialId: materialId,
            typeId: typeId,
            costPrice: cost && !isNaN(cost) ? cost : null,
            allocatedCost: cost && !isNaN(cost) ? cost : null,
            sellingPrice: price && !isNaN(price) ? price : null,
            counter: counter && !isNaN(counter) ? counter : null,
            purchaseDate: parsedDate,
            origin: origin || null,
            certNo: certNo || null,
            notes: notesWithKey,
            status: 'in_stock',
          },
          materialId,
          typeId,
        );
      }

      success += quantity;
      results.push({ row: rowNum, success: true, skuCode: '' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`第${rowNum}行: ${message}`);
      results.push({ row: rowNum, success: false, error: message });
    }
  }

  return { success, skipped, duplicated, errors, autoCreated, inferred, results };
}

// ============================================================
// 货品导入（papaparse 版本，用于 /api/import/items）
// ============================================================

/** 导入单行结果 */
export interface ImportRowResult {
  row: number;
  success: boolean;
  skuCode?: string;
  name?: string;
  error?: string;
}

/** 导入完整结果 */
export interface ImportItemsResult {
  total: number;
  successCount: number;
  failCount: number;
  results: ImportRowResult[];
}

// CSV 列名到系统字段的映射
const ITEM_FIELD_MAP: Record<string, string> = {
  'SKU编号': 'skuCode',
  'SKU': 'skuCode',
  'sku': 'skuCode',
  '名称': 'name',
  '货品名称': 'name',
  '材质': 'materialName',
  '器型': 'typeName',
  '成本价': 'costPrice',
  '进价': 'costPrice',
  '售价': 'sellingPrice',
  '定价': 'sellingPrice',
  '柜台号': 'counter',
  '柜台': 'counter',
  '克重': 'weight',
  '重量': 'weight',
  '圈口': 'braceletSize',
  '戒圈': 'ringSize',
  '珠径': 'beadDiameter',
  '颗数': 'beadCount',
  '产地': 'origin',
  '证书号': 'certNo',
  '匹配码': 'matchKey',
  '关联码': 'matchKey',
  'matchKey': 'matchKey',
  '标签': 'tagNames',
  '备注': 'notes',
  '底价': 'floorPrice',
  '供应商': 'supplierName',
  '入库日期': 'purchaseDate',
  '日期': 'purchaseDate',
};

// 器型名称到默认 specFields 的映射
const TYPE_DEFAULT_SPEC: Record<string, Record<string, { required: boolean }>> = {
  '手镯': { weight: { required: false }, braceletSize: { required: true } },
  '戒指': { weight: { required: false }, ringSize: { required: true } },
  '手串': { weight: { required: false }, beadDiameter: { required: true }, beadCount: { required: false } },
  '手链': { weight: { required: false }, beadDiameter: { required: true }, beadCount: { required: false } },
  '项链': { weight: { required: false }, beadDiameter: { required: true } },
  '吊坠': { weight: { required: false } },
  '耳饰': { weight: { required: false } },
  '把件': { weight: { required: false } },
  '摆件': { weight: { required: false } },
};

/**
 * 自动生成 SKU（papaparse 版本，使用材质名称前2字符做前缀）
 */
async function generateSkuCodeV2(materialId: number): Promise<string> {
  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  const prefix = material ? material.name.slice(0, 2) : 'XX';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefixFull = `${prefix}-${dateStr}-`;

  const existingItems = await db.item.findMany({
    where: { skuCode: { startsWith: prefixFull } },
    select: { skuCode: true },
  });

  let maxSeq = 0;
  for (const item of existingItems) {
    const parts = item.skuCode.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  return `${prefixFull}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * 批量导入货品（papaparse 版本）
 * 从 CSV 解析结果创建货品，支持自动创建字典项、按匹配码去重
 * 等同于 POST /api/import/items
 */
export async function importItemsFromCsv(
  rows: Record<string, string>[],
  options: {
    autoCreate: boolean;
    skipExisting: boolean;
    batchId?: number | null;
  },
): Promise<ImportItemsResult> {
  const { autoCreate = true, skipExisting = true, batchId = null } = options;

  // Pre-load dictionaries for quick lookup
  const allMaterials = await db.dictMaterial.findMany();
  const allTypes = await db.dictType.findMany();
  const allTags = await db.dictTag.findMany();

  const materialCache = new Map(allMaterials.map(m => [m.name, m]));
  const typeCache = new Map(allTypes.map(t => [t.name, t]));
  const tagCache = new Map(allTags.map(t => [t.name, t]));

  const results: ImportRowResult[] = [];
  let successCount = 0;
  let failCount = 0;
  const BATCH_SIZE = 50;

  // Process rows in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const rowNum = i + j + 2; // +2 for header row and 0-indexed

      try {
        // Extract fields from row using column mapping
        const mapped: Record<string, string> = {};
        for (const [csvCol, sysField] of Object.entries(ITEM_FIELD_MAP)) {
          const value = row[csvCol]?.trim();
          if (value) mapped[sysField] = value;
        }

        // Validate required fields
        const materialName = mapped.materialName;
        const sellingPriceStr = mapped.sellingPrice;

        if (!materialName) {
          results.push({ row: rowNum, success: false, error: '缺少材质信息' });
          failCount++;
          continue;
        }

        if (!sellingPriceStr) {
          results.push({ row: rowNum, success: false, error: '缺少售价信息' });
          failCount++;
          continue;
        }

        const sellingPrice = parseFloat(sellingPriceStr);
        if (isNaN(sellingPrice) || sellingPrice <= 0) {
          results.push({ row: rowNum, success: false, error: '售价格式无效' });
          failCount++;
          continue;
        }

        // Find or create material
        let material = materialCache.get(materialName);
        if (!material) {
          if (autoCreate) {
            material = await db.dictMaterial.create({
              data: { name: materialName, category: '其他' },
            });
            materialCache.set(materialName, material);
          } else {
            results.push({ row: rowNum, success: false, error: `材质「${materialName}」不存在` });
            failCount++;
            continue;
          }
        }

        // Find or create type
        let typeId: number | null = null;
        const typeName = mapped.typeName;
        if (typeName) {
          let type = typeCache.get(typeName);
          if (!type) {
            if (autoCreate) {
              const defaultSpec = TYPE_DEFAULT_SPEC[typeName] || { weight: { required: false } };
              type = await db.dictType.create({
                data: { name: typeName, specFields: JSON.stringify(defaultSpec) },
              });
              typeCache.set(typeName, type);
            } else {
              results.push({ row: rowNum, success: false, error: `器型「${typeName}」不存在` });
              failCount++;
              continue;
            }
          }
          typeId = type.id;
        }

        // Check duplicate by matchKey
        const matchKey = mapped.matchKey || '';
        if (matchKey) {
          const existingByMatchKey = await db.item.findFirst({
            where: {
              notes: { contains: `[MK:${matchKey}]` },
              isDeleted: false,
            },
          });
          if (existingByMatchKey) {
            if (skipExisting) {
              results.push({
                row: rowNum,
                success: false,
                skuCode: existingByMatchKey.skuCode,
                name: existingByMatchKey.name || mapped.name,
                error: `匹配码「${matchKey}」已存在，已跳过`,
              });
              failCount++;
              continue;
            }
          }
        }

        // Check SKU existence
        const skuCode = mapped.skuCode || '';
        if (skuCode) {
          const existing = await db.item.findUnique({ where: { skuCode } });
          if (existing) {
            if (skipExisting) {
              results.push({ row: rowNum, success: false, skuCode, name: mapped.name, error: `SKU「${skuCode}」已存在，已跳过` });
              failCount++;
              continue;
            } else {
              // Update existing item
              const updateData: Record<string, unknown> = { sellingPrice, materialId: material.id };
              if (typeId) updateData.typeId = typeId;
              if (mapped.name) updateData.name = mapped.name;
              if (mapped.costPrice) updateData.costPrice = parseFloat(mapped.costPrice) || null;
              if (mapped.origin) updateData.origin = mapped.origin;
              if (mapped.counter) updateData.counter = parseInt(mapped.counter) || null;
              if (mapped.certNo) updateData.certNo = mapped.certNo;
              if (mapped.notes) updateData.notes = mapped.notes;
              if (mapped.purchaseDate) updateData.purchaseDate = normalizeDateInput(mapped.purchaseDate);
              if (mapped.floorPrice) updateData.floorPrice = parseFloat(mapped.floorPrice) || null;

              await db.item.update({ where: { skuCode }, data: updateData });
              results.push({ row: rowNum, success: true, skuCode, name: mapped.name });
              successCount++;
              continue;
            }
          }
        }

        // Generate SKU if not provided
        let finalSkuCode = skuCode;

        // Build spec data
        const specData: Record<string, unknown> = {};
        if (mapped.weight) specData.weight = parseFloat(mapped.weight) || null;
        if (mapped.metalWeight) specData.metalWeight = parseFloat(mapped.metalWeight) || null;
        if (mapped.beadCount) specData.beadCount = parseInt(mapped.beadCount) || null;
        if (mapped.braceletSize) specData.braceletSize = mapped.braceletSize;
        if (mapped.beadDiameter) specData.beadDiameter = mapped.beadDiameter;
        if (mapped.ringSize) specData.ringSize = mapped.ringSize;
        if (mapped.size) specData.size = mapped.size;

        for (const key of Object.keys(specData)) {
          if (specData[key] == null || specData[key] === '') {
            delete specData[key];
          }
        }

        // Handle tags
        const tagIds: number[] = [];
        if (mapped.tagNames) {
          const tagList = mapped.tagNames.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
          for (const tagName of tagList) {
            let tag = tagCache.get(tagName);
            if (!tag) {
              if (autoCreate) {
                tag = await db.dictTag.create({ data: { name: tagName } });
                tagCache.set(tagName, tag);
              }
            }
            if (tag) tagIds.push(tag.id);
          }
        }

        // Handle supplier
        let supplierId: number | null = null;
        if (mapped.supplierName) {
          const supplier = await db.supplier.findFirst({ where: { name: mapped.supplierName } });
          if (supplier) supplierId = supplier.id;
        }

        // Create item
        const costPrice = mapped.costPrice ? parseFloat(mapped.costPrice) : null;
        const notesWithKey = [matchKey ? `[MK:${matchKey}]` : '', mapped.notes || ''].filter(Boolean).join(' ') || null;
        const createData = {
          name: mapped.name || null,
          materialId: material.id,
          typeId: typeId || null,
          costPrice: costPrice ?? null,
          allocatedCost: costPrice ?? null,
          sellingPrice,
          floorPrice: mapped.floorPrice ? parseFloat(mapped.floorPrice) : null,
          origin: mapped.origin || null,
          counter: mapped.counter ? parseInt(mapped.counter) : null,
          certNo: mapped.certNo || null,
          notes: notesWithKey,
          supplierId,
          purchaseDate: normalizeDateInput(mapped.purchaseDate) || null,
          status: 'in_stock',
          ...(tagIds.length > 0 ? {
            tags: { connect: tagIds.map(id => ({ id })) },
          } : {}),
          ...(Object.keys(specData).length > 0 ? {
            spec: { create: specData },
          } : {}),
        };

        let item;
        if (finalSkuCode) {
          item = await db.item.create({
            data: { skuCode: finalSkuCode, ...createData },
          });
        } else {
          let lastErr: unknown = null;
          for (let attempt = 0; attempt < 8; attempt++) {
            finalSkuCode = await generateSkuCodeV2(material.id);
            try {
              item = await db.item.create({
                data: { skuCode: finalSkuCode, ...createData },
              });
              break;
            } catch (err: unknown) {
              lastErr = err;
              const message = err instanceof Error ? err.message : String(err);
              if (!message.includes('Unique constraint failed on the fields: (`sku_code`)')) {
                throw err;
              }
            }
          }
          if (!item) throw lastErr ?? new Error('生成SKU失败，请重试');
        }

        await logAction('import_item', 'item', item.id, {
          skuCode: finalSkuCode,
          name: mapped.name,
          row: rowNum,
        });

        results.push({ row: rowNum, success: true, skuCode: finalSkuCode, name: mapped.name });
        successCount++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ row: rowNum, success: false, error: `处理失败: ${message}` });
        failCount++;
      }
    }
  }

  return { total: rows.length, successCount, failCount, results };
}
