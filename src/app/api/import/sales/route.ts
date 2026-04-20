import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';
import { parse as csvParse } from 'csv-parse/sync';

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

  const num = Number(raw);
  if (!Number.isNaN(num) && num > 20000 && num < 100000) {
    // Excel serial date (1900-based)
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

// Generate sale number
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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const autoCreate = formData.get('autoCreate') !== 'false';

    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请上传CSV文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let csvText = buffer.toString('utf-8');
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    const rows = csvParse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];

    if (rows.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: 'CSV文件为空' }, { status: 400 });
    }

    // Channel mapping
    const CHANNEL_MAP: Record<string, string> = {
      '门店': 'store', '微信': 'wechat', '网店': 'wechat', '线上': 'wechat',
      'store': 'store', 'wechat': 'wechat',
    };

    const results: { row: number; success: boolean; skuCode?: string; saleNo?: string; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Support multiple column name conventions
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

        // Sales import must identify item by matchKey from inventory.
        if (!matchKey) {
          results.push({ row: rowNum, success: false, error: '缺少匹配码（销售导入必须提供匹配码）' });
          failCount++;
          continue;
        }

        // Validate actual price
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

        // Search by matchKey stored in notes as [MK:xxx]
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

        // Determine channel
        const channel = CHANNEL_MAP[channelInput] || 'store';

        // Find or create customer
        let customerId: number | null = null;
        if (customerName && autoCreate) {
          let customer = await db.customer.findFirst({ where: { name: customerName } });
          if (!customer) {
            const customerCode = `C${Date.now()}${Math.floor(Math.random() * 1000)}`;
            customer = await db.customer.create({
              data: { customerCode, name: customerName, phone: customerPhone || null },
            });
          }
          if (customer) customerId = customer.id;
        }

        // Generate sale number
        const saleNo = await generateSaleNo();

        // Create sale record
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

        // Update item status to sold (if not already)
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
