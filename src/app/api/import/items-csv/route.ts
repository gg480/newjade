import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

// CSV columns expected: SKU,名称,器型,材质,状态,成本,售价,柜台号,采购日期
const STATUS_MAP: Record<string, string> = {
  '在库': 'in_stock',
  '已售': 'sold',
  '已退': 'returned',
  'in_stock': 'in_stock',
  'sold': 'sold',
  'returned': 'returned',
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Handle BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(parseCSVLine);
  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ code: 400, message: '请上传CSV文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const csvText = buffer.toString('utf-8');
    const { headers, rows } = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ code: 400, message: 'CSV文件为空' }, { status: 400 });
    }

    // Build column index map
    const colIdx: Record<string, number> = {};
    headers.forEach((h, i) => {
      const trimmed = h.trim();
      if (trimmed === 'SKU' || trimmed === 'sku') colIdx.sku = i;
      else if (trimmed === '名称' || trimmed === 'name') colIdx.name = i;
      else if (trimmed === '器型' || trimmed === 'typeName') colIdx.typeName = i;
      else if (trimmed === '材质' || trimmed === 'materialName') colIdx.materialName = i;
      else if (trimmed === '状态' || trimmed === 'status') colIdx.status = i;
      else if (trimmed === '成本' || trimmed === 'cost') colIdx.cost = i;
      else if (trimmed === '售价' || trimmed === 'price') colIdx.price = i;
      else if (trimmed === '柜台号' || trimmed === 'counter') colIdx.counter = i;
      else if (trimmed === '采购日期' || trimmed === 'purchaseDate') colIdx.purchaseDate = i;
    });

    // Pre-load dictionaries
    const allMaterials = await db.dictMaterial.findMany();
    const allTypes = await db.dictType.findMany();
    const materialCache = new Map(allMaterials.map(m => [m.name, m]));
    const typeCache = new Map(allTypes.map(t => [t.name, t]));

    let success = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 header, +1 0-indexed

      try {
        // Extract values
        const sku = colIdx.sku !== undefined ? row[colIdx.sku]?.trim() : '';
        const name = colIdx.name !== undefined ? row[colIdx.name]?.trim() : '';
        const typeName = colIdx.typeName !== undefined ? row[colIdx.typeName]?.trim() : '';
        const materialName = colIdx.materialName !== undefined ? row[colIdx.materialName]?.trim() : '';
        const statusRaw = colIdx.status !== undefined ? row[colIdx.status]?.trim() : '';
        const costRaw = colIdx.cost !== undefined ? row[colIdx.cost]?.trim() : '';
        const priceRaw = colIdx.price !== undefined ? row[colIdx.price]?.trim() : '';
        const counterRaw = colIdx.counter !== undefined ? row[colIdx.counter]?.trim() : '';
        const purchaseDate = colIdx.purchaseDate !== undefined ? row[colIdx.purchaseDate]?.trim() : '';

        // Validate required fields
        if (!sku) {
          errors.push(`第${rowNum}行: 缺少SKU`);
          continue;
        }
        if (!name) {
          errors.push(`第${rowNum}行: 缺少名称`);
          continue;
        }

        // Check for duplicate SKU
        const existing = await db.item.findUnique({ where: { skuCode: sku } });
        if (existing) {
          skipped++;
          continue;
        }

        // Parse status
        const status = STATUS_MAP[statusRaw] || 'in_stock';

        // Parse costs
        const cost = costRaw ? parseFloat(costRaw) : null;
        const price = priceRaw ? parseFloat(priceRaw) : null;

        if (price !== null && isNaN(price)) {
          errors.push(`第${rowNum}行: 售价格式无效 "${priceRaw}"`);
          continue;
        }
        if (cost !== null && isNaN(cost)) {
          errors.push(`第${rowNum}行: 成本格式无效 "${costRaw}"`);
          continue;
        }

        // Find or skip material
        let materialId: number | null = null;
        if (materialName) {
          const material = materialCache.get(materialName);
          if (material) {
            materialId = material.id;
          }
          // If material not found, still create the item without material
        }

        // Find or skip type
        let typeId: number | null = null;
        if (typeName) {
          const type = typeCache.get(typeName);
          if (type) {
            typeId = type.id;
          }
        }

        // Parse counter
        const counter = counterRaw ? parseInt(counterRaw) : null;

        // Validate purchase date
        let parsedDate: string | null = null;
        if (purchaseDate) {
          const d = new Date(purchaseDate);
          if (!isNaN(d.getTime())) {
            parsedDate = d.toISOString().slice(0, 10);
          }
        }

        // Create item
        await db.item.create({
          data: {
            skuCode: sku,
            name: name,
            materialId: materialId,
            typeId: typeId,
            costPrice: cost,
            allocatedCost: cost,
            sellingPrice: price,
            counter: counter,
            purchaseDate: parsedDate,
            status: status,
          },
        });

        await logAction('import_csv_item', 'item', 0, { skuCode: sku, name, row: rowNum });
        success++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`第${rowNum}行: ${message}`);
      }
    }

    return NextResponse.json({
      code: 0,
      data: { success, skipped, errors },
      message: `导入完成: 成功${success}条, 跳过${skipped}条, 错误${errors.length}条`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, message: `导入失败: ${message}` }, { status: 500 });
  }
}
