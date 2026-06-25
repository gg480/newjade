/**
 * 基于 DB 已写入的 ItemSpec 数据导出规格审核 Excel
 * 让用户审核实际写入的规格数据是否正确
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 导出规格审核 Excel（基于 DB 已写入数据）===\n');

  // 查询所有有规格数据的货品
  const items = await prisma.item.findMany({
    where: {
      isDeleted: false,
      spec: { isNot: null },
    },
    include: {
      spec: true,
      material: true,
    },
    orderBy: { skuCode: 'asc' },
  });
  console.log(`有规格数据的货品: ${items.length} 条`);

  // 构建 Excel 行
  const rows = items.map(item => {
    const s = item.spec!;
    const mat = item.material;
    // 标签格式规格
    let labelSpec = '';
    if (mat?.category !== '贵金属') {
      const parts: string[] = [];
      if (s.braceletSize) parts.push(`圈口${s.braceletSize}`);
      if (s.weight !== null && s.weight !== undefined) parts.push(`${s.weight}g`);
      if (s.size) parts.push(s.size);
      if (s.beadDiameter) parts.push(`珠径${s.beadDiameter}`);
      if (s.beadCount !== null && s.beadCount !== undefined) parts.push(`${s.beadCount}粒`);
      labelSpec = parts.join(' ');
    } else {
      const parts: string[] = [];
      if (s.metalWeight !== null && s.metalWeight !== undefined) parts.push(`${s.metalWeight}g`);
      if (s.beadDiameter) parts.push(`珠径${s.beadDiameter}`);
      if (s.beadCount !== null && s.beadCount !== undefined) parts.push(`${s.beadCount}粒`);
      labelSpec = parts.join(' ');
    }

    return {
      'SKU': item.skuCode,
      '货品名称': item.name,
      '材质名': mat?.name || '',
      '材质类别': mat?.category || '',
      '标签规格': labelSpec,
      '货品重量weight': s.weight ?? '',
      '金属克重metalWeight': s.metalWeight ?? '',
      '圈口braceletSize': s.braceletSize ?? '',
      '大小size': s.size ?? '',
      '珠子口径beadDiameter': s.beadDiameter ?? '',
      '粒数beadCount': s.beadCount ?? '',
      '备注(钻石)': item.notes || '',
      '修正建议': '', // 留空给用户批注
    };
  });

  // 写 Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 24 },
    { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
    { wch: 8 }, { wch: 20 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '规格数据审核');

  const excelPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\规格审核V4_已写入.xlsx';
  try {
    XLSX.writeFile(wb, excelPath);
    console.log(`\n✓ 审核Excel已导出: ${excelPath}`);
  } catch {
    const altPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\规格审核V4_已写入_new.xlsx';
    XLSX.writeFile(wb, altPath);
    console.log(`\n✓ 文件被占用，改写入: ${altPath}`);
  }

  // 统计
  console.log(`\n=== 统计 ===`);
  console.log(`总条数: ${rows.length}`);
  const byCat = new Map<string, number>();
  for (const r of rows) {
    const c = r['材质类别'] || '(空)';
    byCat.set(c, (byCat.get(c) || 0) + 1);
  }
  console.log('按材质类别:');
  for (const [c, n] of byCat) {
    console.log(`  ${c}: ${n} 条`);
  }

  const fieldStat = {
    weight: rows.filter(r => r['货品重量weight'] !== '').length,
    metalWeight: rows.filter(r => r['金属克重metalWeight'] !== '').length,
    braceletSize: rows.filter(r => r['圈口braceletSize'] !== '').length,
    size: rows.filter(r => r['大小size'] !== '').length,
    beadDiameter: rows.filter(r => r['珠子口径beadDiameter'] !== '').length,
    beadCount: rows.filter(r => r['粒数beadCount'] !== '').length,
  };
  console.log('字段覆盖:');
  for (const [f, n] of Object.entries(fieldStat)) {
    console.log(`  ${f}: ${n} 条`);
  }
}

main().finally(() => prisma.$disconnect());
