import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';
import Papa from 'papaparse';

// CSV 列名到系统字段的映射
const SALE_FIELD_MAP: Record<string, string> = {
  'SKU编号': 'skuCode',
  'SKU': 'skuCode',
  'sku': 'skuCode',
  '成交价': 'actualPrice',
  '销售价': 'actualPrice',
  '售价': 'actualPrice',
  '销售日期': 'saleDate',
  '日期': 'saleDate',
  '渠道': 'channel',
  '客户姓名': 'customerName',
  '客户': 'customerName',
  '客户电话': 'customerPhone',
  '电话': 'customerPhone',
  '备注': 'note',
};

// 渠道映射
const CHANNEL_MAP: Record<string, string> = {
  '门店': 'store',
  '微信': 'wechat',
  '网店': 'wechat',
  '线上': 'wechat',
  'store': 'store',
  'wechat': 'wechat',
};

interface ImportResult {
  row: number;
  success: boolean;
  skuCode?: string;
  saleNo?: string;
  error?: string;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const autoCreate = formData.get('autoCreate') !== 'false'; // default true

    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请上传CSV文件' }, { status: 400 });
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
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
      if (SALE_FIELD_MAP[trimmed]) {
        columnMap[trimmed] = SALE_FIELD_MAP[trimmed];
      }
    }

    const results: ImportResult[] = [];
    let successCount = 0;
    let failCount = 0;

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

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for header row and 0-indexed

      try {
        // Extract fields
        const mapped: Record<string, string> = {};
        for (const [csvCol, sysField] of Object.entries(columnMap)) {
          const value = row[csvCol]?.trim();
          if (value) mapped[sysField] = value;
        }

        // Validate required fields
        const skuCode = mapped.skuCode;
        if (!skuCode) {
          results.push({ row: rowNum, success: false, error: '缺少SKU编号' });
          failCount++;
          continue;
        }

        const actualPriceStr = mapped.actualPrice;
        if (!actualPriceStr) {
          results.push({ row: rowNum, success: false, error: '缺少成交价' });
          failCount++;
          continue;
        }

        const actualPrice = parseFloat(actualPriceStr);
        if (isNaN(actualPrice) || actualPrice <= 0) {
          results.push({ row: rowNum, success: false, error: '成交价格式无效' });
          failCount++;
          continue;
        }

        const saleDate = mapped.saleDate || new Date().toISOString().slice(0, 10);

        // Find item by SKU
        const item = await db.item.findUnique({ where: { skuCode } });
        if (!item) {
          results.push({ row: rowNum, success: false, skuCode, error: `SKU「${skuCode}」不存在` });
          failCount++;
          continue;
        }

        if (item.status === 'sold') {
          results.push({ row: rowNum, success: false, skuCode, error: `SKU「${skuCode}」已售出` });
          failCount++;
          continue;
        }

        // Determine channel
        const channelInput = mapped.channel || '门店';
        const channel = CHANNEL_MAP[channelInput] || 'store';

        // Find or create customer
        let customerId: number | null = null;
        const customerName = mapped.customerName;
        if (customerName) {
          let customer = await db.customer.findFirst({ where: { name: customerName } });
          if (!customer && autoCreate) {
            const customerCode = `C${Date.now()}${Math.floor(Math.random() * 1000)}`;
            customer = await db.customer.create({
              data: {
                customerCode,
                name: customerName,
                phone: mapped.customerPhone || null,
              },
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
            saleDate,
            customerId,
            note: mapped.note || null,
          },
        });

        // Update item status to sold
        await db.item.update({
          where: { id: item.id },
          data: { status: 'sold' },
        });

        await logAction('import_sale', 'sale', sale.id, {
          saleNo,
          skuCode,
          actualPrice,
          saleDate,
          row: rowNum,
        });

        results.push({ row: rowNum, success: true, skuCode, saleNo });
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
