import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';
import Papa from 'papaparse';

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

// 自动生成 SKU
async function generateSkuCode(materialId: number): Promise<string> {
  const material = await db.dictMaterial.findUnique({ where: { id: materialId } });
  const prefix = material ? material.name.slice(0, 2) : 'XX';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefixFull = `${prefix}-${dateStr}-`;

  const lastItem = await db.item.findFirst({
    where: { skuCode: { startsWith: prefixFull } },
    orderBy: { skuCode: 'desc' },
  });

  let seq = 1;
  if (lastItem) {
    const parts = lastItem.skuCode.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefixFull}${String(seq).padStart(3, '0')}`;
}

interface ImportResult {
  row: number;
  success: boolean;
  skuCode?: string;
  name?: string;
  error?: string;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const autoCreate = formData.get('autoCreate') !== 'false'; // default true
    const skipExisting = formData.get('skipExisting') !== 'false'; // default true
    const batchIdStr = formData.get('batchId') as string | null;
    const batchId = batchIdStr ? parseInt(batchIdStr) : null;

    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请上传CSV文件' }, { status: 400 });
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    // Handle UTF-8 BOM
    let csvText = buffer.toString('utf-8');
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    // Parse CSV
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
    });

    if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
      return NextResponse.json({
        code: 400,
        data: null,
        message: `CSV解析失败: ${parseResult.errors[0].message}`,
      }, { status: 400 });
    }

    const rows = parseResult.data as Record<string, string>[];
    if (rows.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: 'CSV文件为空' }, { status: 400 });
    }

    // Map CSV columns to system fields
    const headers = parseResult.meta.fields || [];
    const columnMap: Record<string, string> = {};
    for (const header of headers) {
      const trimmed = header.trim();
      if (ITEM_FIELD_MAP[trimmed]) {
        columnMap[trimmed] = ITEM_FIELD_MAP[trimmed];
      }
    }

    // Pre-load dictionaries for quick lookup
    const allMaterials = await db.dictMaterial.findMany();
    const allTypes = await db.dictType.findMany();
    const allTags = await db.dictTag.findMany();

    const materialCache = new Map(allMaterials.map(m => [m.name, m]));
    const typeCache = new Map(allTypes.map(t => [t.name, t]));
    const tagCache = new Map(allTags.map(t => [t.name, t]));

    const results: ImportResult[] = [];
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
          for (const [csvCol, sysField] of Object.entries(columnMap)) {
            const value = row[csvCol]?.trim();
            if (value) mapped[sysField] = value;
          }

          // Validate required fields: at least material and sellingPrice
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
                  data: {
                    name: typeName,
                    specFields: JSON.stringify(defaultSpec),
                  },
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
                const updateData: Record<string, unknown> = {
                  sellingPrice,
                  materialId: material.id,
                };
                if (typeId) updateData.typeId = typeId;
                if (mapped.name) updateData.name = mapped.name;
                if (mapped.costPrice) updateData.costPrice = parseFloat(mapped.costPrice) || null;
                if (mapped.origin) updateData.origin = mapped.origin;
                if (mapped.counter) updateData.counter = parseInt(mapped.counter) || null;
                if (mapped.certNo) updateData.certNo = mapped.certNo;
                if (mapped.notes) updateData.notes = mapped.notes;
                if (mapped.purchaseDate) updateData.purchaseDate = mapped.purchaseDate;
                if (mapped.floorPrice) updateData.floorPrice = parseFloat(mapped.floorPrice) || null;

                await db.item.update({ where: { skuCode }, data: updateData });
                results.push({ row: rowNum, success: true, skuCode, name: mapped.name });
                successCount++;
                continue;
              }
            }
          }

          // Generate SKU if not provided
          const finalSkuCode = skuCode || await generateSkuCode(material.id);

          // Build spec data
          const specData: Record<string, unknown> = {};
          if (mapped.weight) specData.weight = parseFloat(mapped.weight) || null;
          if (mapped.metalWeight) specData.metalWeight = parseFloat(mapped.metalWeight) || null;
          if (mapped.beadCount) specData.beadCount = parseInt(mapped.beadCount) || null;
          if (mapped.braceletSize) specData.braceletSize = mapped.braceletSize;
          if (mapped.beadDiameter) specData.beadDiameter = mapped.beadDiameter;
          if (mapped.ringSize) specData.ringSize = mapped.ringSize;
          if (mapped.size) specData.size = mapped.size;

          // Clean up null spec values
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
          const item = await db.item.create({
            data: {
              skuCode: finalSkuCode,
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
              notes: mapped.notes || null,
              supplierId,
              purchaseDate: mapped.purchaseDate || null,
              status: 'in_stock',
              ...(tagIds.length > 0 ? {
                tags: { connect: tagIds.map(id => ({ id })) },
              } : {}),
              ...(Object.keys(specData).length > 0 ? {
                spec: { create: specData },
              } : {}),
            },
          });

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

    return NextResponse.json({
      code: 0,
      data: {
        total: rows.length,
        successCount,
        failCount,
        results,
      },
      message: `导入完成: 成功${successCount}条, 失败${failCount}条`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message: `导入失败: ${message}` }, { status: 500 });
  }
}
