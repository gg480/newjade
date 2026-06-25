/**
 * 排查：用户指出的错误货品，看 Excel 材质名称1 vs 数据库材质
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const excelPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\商品价格表.xlsx';
  const buf = fs.readFileSync(excelPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets['入库登记'];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });

  // 用户指出的 SKU 列表
  const problemSkus = [
    '0701-0420-002', '0701-0420-003', '0701-0420-004', '0701-0420-005',
    '0701-0420-006', '0701-0420-007', '0701-0420-008', '0701-0420-009',
    '0702-0420-001', '0702-0420-002', '0702-0420-003',
    '0901-0420-766',
    '0902-0420-010', '0902-0420-011', '0902-0420-018', '0902-0420-019',
  ];

  // 查数据库这些 SKU 的材质
  console.log('=== 数据库材质 ===');
  const items = await prisma.item.findMany({
    where: { skuCode: { in: problemSkus } },
    include: { material: true, spec: true },
    orderBy: { skuCode: 'asc' },
  });
  for (const item of items) {
    console.log(`SKU=${item.skuCode} | ${item.name} | DB材质=${item.material?.name}(${item.material?.category}) | notes=${item.notes}`);
  }

  // 查 Excel 这些货品的入货单号和材质名称1
  console.log('\n=== Excel 材质名称1 ===');
  const notesToSku = new Map<string, string>();
  for (const item of items) {
    const mk = (item.notes || '').match(/\[MK:(I[^\]]+)\]/);
    if (mk) notesToSku.set(mk[1], item.skuCode);
  }
  for (const row of rows) {
    const orderNo = String(row['入货单号'] || '').trim();
    if (notesToSku.has(orderNo)) {
      console.log(`单号=${orderNo} → SKU=${notesToSku.get(orderNo)} | ${row['产品名称']} | Excel材质1=[${row['材质名称 1']}] | 金属克重=[${row['金属克重']}] | 大小=[${row['大小']}]`);
    }
  }

  // 统计：数据库里 materialId 指向"未分类"的货品有多少
  const unclassified = await prisma.dictMaterial.findFirst({ where: { name: '未分类' } });
  if (unclassified) {
    const unclassifiedCount = await prisma.item.count({ where: { materialId: unclassified.id, isDeleted: false } });
    console.log(`\n=== 数据库 materialId=未分类 的货品: ${unclassifiedCount} 条 ===`);

    // 按名称关键词统计
    const unclassifiedItems = await prisma.item.findMany({
      where: { materialId: unclassified.id, isDeleted: false },
      select: { name: true },
    });
    const kwMap = new Map<string, number>();
    const keywords = ['手镯', '翡翠', '平安扣', '佛公', '蜜蜡', '琥珀', '粉晶', '水晶', '手链', '吊坠'];
    for (const item of unclassifiedItems) {
      const name = item.name || '';
      for (const kw of keywords) {
        if (name.includes(kw)) {
          kwMap.set(kw, (kwMap.get(kw) || 0) + 1);
          break;
        }
      }
    }
    console.log('按名称关键词:');
    for (const [k, v] of kwMap) {
      console.log(`  ${k}: ${v}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
