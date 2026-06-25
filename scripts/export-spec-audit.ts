/**
 * 基于 fix-spec-report.json 导出 V4 审核 Excel
 * 2个Sheet：规格补全清单 + 材质推断明细
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';

interface SpecData {
  weight?: number;
  metalWeight?: number;
  size?: string;
  braceletSize?: string;
  beadDiameter?: string;
  beadCount?: number;
}

interface WriteTask {
  itemId: number;
  skuCode: string;
  orderNo: string;
  productName: string;
  materialCategory: string;
  categorySource: string;
  specData: SpecData;
  diamondNote: string | null;
}

interface Report {
  mode: string;
  matchStats: { matched: number; zero: number; multi: number; noSpec: number };
  fieldStats: Record<string, number>;
  writeTasks: WriteTask[];
}

function main() {
  const report: Report = JSON.parse(fs.readFileSync('scripts/fix-spec-report.json', 'utf-8'));

  const wb = XLSX.utils.book_new();

  // Sheet1: 规格补全清单
  const specRows = report.writeTasks.map(t => {
    const s = t.specData;
    // 标签格式规格（非贵金属时展示）
    let labelSpec = '';
    if (t.materialCategory !== '贵金属') {
      const parts: string[] = [];
      if (s.braceletSize) parts.push(`圈口${s.braceletSize}`);
      if (s.weight !== undefined) parts.push(`${s.weight}g`);
      if (s.size) parts.push(s.size);
      if (s.beadDiameter) parts.push(`珠径${s.beadDiameter}`);
      if (s.beadCount !== undefined) parts.push(`${s.beadCount}粒`);
      labelSpec = parts.join(' ');
    } else {
      // 贵金属标签格式
      const parts: string[] = [];
      if (s.metalWeight !== undefined) parts.push(`${s.metalWeight}g`);
      if (s.beadDiameter) parts.push(`珠径${s.beadDiameter}`);
      if (s.beadCount !== undefined) parts.push(`${s.beadCount}粒`);
      labelSpec = parts.join(' ');
    }

    return {
      'SKU': t.skuCode,
      '货品名称': t.productName,
      '材质类别': t.materialCategory,
      '类别来源': t.categorySource,
      '入货单号': t.orderNo,
      '标签规格': labelSpec,
      '货品重量weight': s.weight ?? '',
      '金属克重metalWeight': s.metalWeight ?? '',
      '圈口': s.braceletSize ?? '',
      '大小': s.size ?? '',
      '珠子口径': s.beadDiameter ?? '',
      '粒数': s.beadCount ?? '',
      '钻石备注': t.diamondNote ?? '',
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(specRows);
  ws1['!cols'] = [
    { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 18 },
    { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '规格补全清单');

  // Sheet2: 材质推断明细（重点关注名称推断的条目）
  const inferRows = report.writeTasks
    .filter(t => t.categorySource === '名称推断')
    .map(t => ({
      'SKU': t.skuCode,
      '货品名称': t.productName,
      '推断类别': t.materialCategory,
      '入货单号': t.orderNo,
    }));
  const ws2 = XLSX.utils.json_to_sheet(inferRows);
  ws2['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, '名称推断明细');

  const excelPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\规格审核V4.xlsx';
  try {
    XLSX.writeFile(wb, excelPath);
    console.log(`审核Excel已导出: ${excelPath}`);
  } catch {
    const altPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\规格审核V4_new.xlsx';
    XLSX.writeFile(wb, altPath);
    console.log(`文件被占用，改写入: ${altPath}`);
  }

  console.log(`\n统计:`);
  console.log(`  总匹配: ${report.writeTasks.length} 条`);
  console.log(`  名称推断: ${inferRows.length} 条`);
  console.log(`  DB降级: ${report.writeTasks.length - inferRows.length} 条`);
  console.log(`  字段覆盖: ${JSON.stringify(report.fieldStats)}`);
}

main();
