import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';

const db = new PrismaClient();

// Auto-generate SKU code (same logic as items/route.ts)
async function generateSkuCode(materialId: number, typeId?: number | null): Promise<string> {
  const mCode = String(materialId).padStart(2, '0');
  const tCode = typeId ? String(typeId).padStart(2, '0') : '00';
  const today = new Date();
  const dateStr = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const prefixFull = `${mCode}${tCode}-${dateStr}-`;

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

// Find or create material by name
async function findOrCreateMaterial(name: string): Promise<number | null> {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  // Try exact match first
  const existing = await db.dictMaterial.findFirst({
    where: { name: trimmed },
  });
  if (existing) return existing.id;

  // Auto-create with inferred category
  const categoryMap: Record<string, string> = {
    '翡翠': '玉', '和田玉': '玉', '玉': '玉',
    '黄金': '贵金属', '银': '贵金属', '铂金': '贵金属', '18K金': '贵金属', 'k铂金': '贵金属',
    '珍珠': '其他',
    '朱砂': '文玩', '蜜蜡': '文玩', '琥珀': '文玩',
  };
  const category = categoryMap[trimmed] || '其他';

  const created = await db.dictMaterial.create({
    data: { name: trimmed, category },
  });
  console.log(`[IMPORT] Auto-created material: ${trimmed} (${category}), id=${created.id}`);
  return created.id;
}

// Find or create type by name
async function findOrCreateType(name: string): Promise<number | null> {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  // Try exact match first
  const existing = await db.dictType.findFirst({
    where: { name: trimmed },
  });
  if (existing) return existing.id;

  // Auto-create with empty specFields
  const lastType = await db.dictType.findFirst({ orderBy: { sortOrder: 'desc' } });
  const sortOrder = (lastType?.sortOrder || 0) + 1;

  const created = await db.dictType.create({
    data: { name: trimmed, specFields: JSON.stringify({ weight: { required: false } }), sortOrder },
  });
  console.log(`[IMPORT] Auto-created type: ${trimmed}, id=${created.id}`);
  return created.id;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ code: 400, message: '请上传CSV文件' }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    // Build caches for faster lookup
    const materialCache = new Map<string, any>();
    const typeCache = new Map<string, any>();
    const allMaterials = await db.dictMaterial.findMany();
    const allTypes = await db.dictType.findMany();
    allMaterials.forEach(m => materialCache.set(m.name, m));
    allTypes.forEach(t => typeCache.set(t.name, t));

    let success = 0;
    let skipped = 0;
    const errors: string[] = [];
    const autoCreated: { materials: string[]; types: string[] } = { materials: [], types: [] };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // +2 for header row + 0-indexed

      try {
        // Support multiple column name conventions
        const name = row['名称'] || row['name'] || row['货品名称'] || '';
        const sku = row['SKU'] || row['sku'] || row['编码'] || row['skuCode'] || '';
        const materialName = row['材质'] || row['material'] || row['材质名称'] || '';
        const typeName = row['器型'] || row['type'] || row['器型名称'] || '';
        const costRaw = row['成本价'] || row['costPrice'] || row['成本'] || '';
        const priceRaw = row['零售价'] || row['sellingPrice'] || row['售价'] || row['标价'] || '';
        const counterRaw = row['柜台'] || row['counter'] || '';
        const purchaseDate = row['采购日期'] || row['purchaseDate'] || row['入库日期'] || '';
        const origin = row['产地'] || row['origin'] || '';
        const certNo = row['证书号'] || row['certNo'] || '';
        const notes = row['备注'] || row['notes'] || '';

        if (!name) {
          errors.push(`第${rowNum}行: 名称不能为空`);
          skipped++;
          continue;
        }

        // Find or create material
        let materialId: number | null = null;
        if (materialName) {
          const cached = materialCache.get(materialName);
          if (cached) {
            materialId = cached.id;
          } else {
            materialId = await findOrCreateMaterial(materialName);
            if (materialId) {
              // Update cache
              const newMat = await db.dictMaterial.findUnique({ where: { id: materialId } });
              if (newMat) {
                materialCache.set(newMat.name, newMat);
                if (!autoCreated.materials.includes(newMat.name)) {
                  autoCreated.materials.push(newMat.name);
                }
              }
            }
          }
        }

        // Find or create type
        let typeId: number | null = null;
        if (typeName) {
          const cached = typeCache.get(typeName);
          if (cached) {
            typeId = cached.id;
          } else {
            typeId = await findOrCreateType(typeName);
            if (typeId) {
              const newType = await db.dictType.findUnique({ where: { id: typeId } });
              if (newType) {
                typeCache.set(newType.name, newType);
                if (!autoCreated.types.includes(newType.name)) {
                  autoCreated.types.push(newType.name);
                }
              }
            }
          }
        }

        // Parse prices
        const cost = costRaw ? parseFloat(costRaw) : null;
        const price = priceRaw ? parseFloat(priceRaw) : null;
        const counter = counterRaw ? parseInt(counterRaw) : null;

        // Parse purchase date
        let parsedDate: string | null = null;
        if (purchaseDate) {
          const d = new Date(purchaseDate);
          if (!isNaN(d.getTime())) {
            parsedDate = d.toISOString().slice(0, 10);
          }
        }

        // Auto-generate SKU if not provided
        let finalSkuCode = sku.trim();
        if (!finalSkuCode) {
          if (materialId) {
            finalSkuCode = await generateSkuCode(materialId, typeId);
          } else {
            // No material, use a generic prefix
            const today = new Date();
            const dateStr = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
            const prefixFull = `00${typeId ? String(typeId).padStart(2, '0') : '00'}-${dateStr}-`;
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
            finalSkuCode = `${prefixFull}${String(seq).padStart(3, '0')}`;
          }
        }

        // Create item
        await db.item.create({
          data: {
            skuCode: finalSkuCode,
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
            notes: notes || null,
            status: 'in_stock',
          },
        });

        success++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`第${rowNum}行: ${message}`);
      }
    }

    // Build result message
    let message = `导入完成: 成功${success}条, 跳过${skipped}条`;
    if (errors.length > 0) message += `, 错误${errors.length}条`;
    if (autoCreated.materials.length > 0) message += ` | 自动创建材质: ${autoCreated.materials.join('、')}`;
    if (autoCreated.types.length > 0) message += ` | 自动创建器型: ${autoCreated.types.join('、')}`;

    return NextResponse.json({
      code: 0,
      data: { success, skipped, errors, autoCreated },
      message,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, message: `导入失败: ${message}` }, { status: 500 });
  }
}
