/**
 * 读取规格审核 Excel 的"修正建议"列
 * 同时识别组合型货品（名称含多种材质关键词）
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const excelPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\规格审核V4_已写入.xlsx';

// 组合型识别：名称同时含多种材质关键词
const MATERIAL_KEYWORDS: Array<{ cat: string; kws: string[] }> = [
  { cat: '玉', kws: ['翡翠', '佛公', '手镯', '糯底', '豆青', '白地青', '白底青', '飘花', '红翡', '黄翡', '冰油', '冰种', '春彩', '平安扣', '怀古', '如意', '貔貅', '福袋', '福锁'] },
  { cat: '贵金属', kws: ['足金', '足银', '925银', '990银', '18K金', 'K白金', '玫瑰金', '铂金', '黄金', '金珠', '银珠'] },
  { cat: '文玩', kws: ['蜜蜡', '琥珀', '朱砂'] },
  { cat: '水晶', kws: ['粉晶', '紫水晶', '黄水晶', '发晶', '钛晶', '碧玺', '虎眼', '黑曜石', '玛瑙', '水晶'] },
];

function detectCombo(name: string): string[] {
  const cats: string[] = [];
  for (const { cat, kws } of MATERIAL_KEYWORDS) {
    if (kws.some(kw => name.includes(kw))) {
      cats.push(cat);
    }
  }
  return cats;
}

function main() {
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets['规格数据审核'];
  if (!ws) {
    console.log('未找到"规格数据审核" Sheet');
    return;
  }
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`总行数: ${rows.length}`);

  // 提取有"修正建议"的行
  const withSuggestion = rows.filter(r => {
    const v = r['修正建议'] || '';
    return String(v).trim() !== '';
  });
  console.log(`\n有"修正建议"的行: ${withSuggestion.length} 条`);

  // 输出修正建议样例
  for (const r of withSuggestion.slice(0, 50)) {
    console.log(`  ${r['SKU']} | ${r['货品名称']} | 标签="${r['标签规格']}" | 建议="${r['修正建议']}"`);
  }
  if (withSuggestion.length > 50) {
    console.log(`  ... 还有 ${withSuggestion.length - 50} 条`);
  }

  // 统计修正建议分布
  const sugStat = new Map<string, number>();
  for (const r of withSuggestion) {
    const s = String(r['修正建议'] || '').trim();
    sugStat.set(s, (sugStat.get(s) || 0) + 1);
  }
  console.log('\n修正建议分布:');
  for (const [s, n] of [...sugStat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${s}": ${n} 条`);
  }

  // 识别组合型货品（全量，不只是有建议的）
  const comboItems = rows.filter(r => {
    const cats = detectCombo(String(r['货品名称'] || ''));
    return cats.length >= 2;
  });
  console.log(`\n组合型货品（名称含2+材质类别）: ${comboItems.length} 条`);
  for (const r of comboItems.slice(0, 30)) {
    const cats = detectCombo(String(r['货品名称'] || ''));
    console.log(`  ${r['SKU']} | ${r['货品名称']} | 类别=[${cats.join('+')}]`);
  }
  if (comboItems.length > 30) {
    console.log(`  ... 还有 ${comboItems.length - 30} 条`);
  }

  // 导出修正建议 JSON
  const exportData = withSuggestion.map(r => ({
    sku: r['SKU'],
    name: r['货品名称'],
    materialName: r['材质名'],
    materialCategory: r['材质类别'],
    labelSpec: r['标签规格'],
    weight: r['货品重量weight'],
    metalWeight: r['金属克重metalWeight'],
    braceletSize: r['圈口braceletSize'],
    size: r['大小size'],
    beadDiameter: r['珠子口径beadDiameter'],
    beadCount: r['粒数beadCount'],
    suggestion: String(r['修正建议'] || '').trim(),
  }));
  fs.writeFileSync('scripts/spec-suggestions.json', JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`\n修正建议已导出: scripts/spec-suggestions.json (${exportData.length} 条)`);

  // 导出组合型货品 JSON
  const comboExport = comboItems.map(r => {
    const cats = detectCombo(String(r['货品名称'] || ''));
    return {
      sku: r['SKU'],
      name: r['货品名称'],
      materialName: r['材质名'],
      materialCategory: r['材质类别'],
      comboCategories: cats,
    };
  });
  fs.writeFileSync('scripts/combo-items.json', JSON.stringify(comboExport, null, 2), 'utf8');
  console.log(`组合型货品已导出: scripts/combo-items.json (${comboExport.length} 条)`);
}

main();
