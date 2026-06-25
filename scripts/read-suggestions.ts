/**
 * 读取用户审核批注的 Excel，提取"修正建议"列
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const excelPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\综合治理审核V2.xlsx';

function main() {
  const wb = XLSX.readFile(excelPath);
  console.log('Sheet 列表:', wb.SheetNames);

  // 读取全量材质核对 Sheet
  const ws = wb.Sheets['全量材质核对'];
  if (!ws) {
    console.log('未找到"全量材质核对" Sheet');
    return;
  }
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`\n全量材质核对: ${rows.length} 行`);

  // 查看列名
  if (rows.length > 0) {
    console.log('列名:', Object.keys(rows[0]));
  }

  // 提取有"修正建议"的行
  const withSuggestion = rows.filter(r => {
    const v = r['修正建议'] || r['修正建議'] || '';
    return String(v).trim() !== '';
  });
  console.log(`\n有"修正建议"的行: ${withSuggestion.length} 条`);

  // 输出样例
  for (const r of withSuggestion.slice(0, 50)) {
    console.log(`  SKU=${r['SKU']} | ${r['货品名称']} | DB=${r['DB材质名']} | 推断=${r['推断材质名']} | 建议=${r['修正建议'] || r['修正建議']}`);
  }
  if (withSuggestion.length > 50) {
    console.log(`  ... 还有 ${withSuggestion.length - 50} 条`);
  }

  // 统计修正建议分布
  const suggestionStat = new Map<string, number>();
  for (const r of withSuggestion) {
    const s = String(r['修正建议'] || r['修正建議'] || '').trim();
    suggestionStat.set(s, (suggestionStat.get(s) || 0) + 1);
  }
  console.log('\n修正建议分布:');
  for (const [s, n] of [...suggestionStat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${s}": ${n} 条`);
  }

  // 导出为 JSON 供后续修正脚本使用
  const exportData = withSuggestion.map(r => ({
    itemId: r['货品ID'],
    sku: r['SKU'],
    name: r['货品名称'],
    dbMaterialId: r['DB材质ID'],
    dbMaterialName: r['DB材质名'],
    dbCategory: r['DB材质类别'],
    inferMaterialId: r['推断材质ID'],
    inferMaterialName: r['推断材质名'],
    inferCategory: r['推断材质类别'],
    suggestion: String(r['修正建议'] || r['修正建議'] || '').trim(),
  }));
  fs.writeFileSync('scripts/user-suggestions.json', JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`\n已导出到 scripts/user-suggestions.json (${exportData.length} 条)`);
}

main();
