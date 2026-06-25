/**
 * 全量材质审计 V2（按 excel-data-governance SKILL.md 优化）
 *
 * 目标：排查数据库 Item.materialId 关联是否与货品名称冲突
 * 策略：用名称关键词推断"应有类别"，对比数据库实际类别
 * 输出：
 *   - scripts/audit-result.txt（文本报告）
 *   - scripts/material-audit.xlsx（Excel 审核清单，2个Sheet）
 *
 * 用法：npx tsx scripts/audit-all-materials.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

// ============================================================
// 名称关键词推断规则（按优先级从高到低）
// 顺序敏感：蜜蜡/琥珀 > 水晶品种 > 玉器/翡翠 > 贵金属
// ============================================================

interface InferRule {
  keywords: string[];
  material: string; // 推断的材质名（用于修正 materialId）
  category: string; // 推断的类别
  reason: string;
}

const RULES: InferRule[] = [
  // 蜜蜡/琥珀 → 文玩（最高优先级，不会被镶嵌材质覆盖）
  {
    keywords: ['蜜蜡'],
    material: '蜜蜡',
    category: '文玩',
    reason: '蜜蜡属文玩类有机宝石',
  },
  {
    keywords: ['琥珀'],
    material: '琥珀',
    category: '文玩',
    reason: '琥珀属文玩类有机宝石',
  },
  // 水晶品种（精确匹配品种名）
  { keywords: ['粉晶'], material: '粉晶', category: '水晶', reason: '粉晶属水晶类' },
  { keywords: ['紫水晶', '紫晶'], material: '紫水晶', category: '水晶', reason: '紫水晶属水晶类' },
  { keywords: ['黄水晶', '黄晶'], material: '黄水晶', category: '水晶', reason: '黄水晶属水晶类' },
  { keywords: ['发晶'], material: '发晶', category: '水晶', reason: '发晶属水晶类' },
  { keywords: ['钛晶'], material: '钛晶', category: '水晶', reason: '钛晶属水晶类' },
  { keywords: ['碧玺'], material: '碧玺', category: '水晶', reason: '碧玺属水晶类' },
  { keywords: ['虎眼', '金虎眼'], material: '虎眼', category: '水晶', reason: '虎眼属水晶类' },
  { keywords: ['黑曜石', '金曜石'], material: '黑曜石', category: '水晶', reason: '黑曜石属水晶类' },
  { keywords: ['玛瑙'], material: '玛瑙', category: '水晶', reason: '玛瑙属水晶类' },
  { keywords: ['水晶'], material: '水晶', category: '水晶', reason: '名称含水晶关键词' },
  // 玉器/翡翠关键词（宽匹配，38个关键词）
  {
    keywords: [
      '翡翠', '佛公', '手镯', '糯底', '糯化', '豆青', '豆底', '豆绿', '豆种',
      '白地青', '白底青', '紫萝兰', '紫夢兰', '冰油', '冰种', '冰底', '冰黄', '冰紫',
      '春彩', '春带彩', '飘花', '飘绿', '红翡', '黄翡', '果绿', '果糖',
      '洒金', '铁龙星', '花青', '油底', '油青', '青绿', '茄紫', '黑油青',
      '牛奶底', '牛好底', '算盘子', '竹节', '平安扣', '面包扣', '福袋', '福锁',
      '貔貅', '妖花', '如意', '关公', '路路通', '招财进宝', '长寿果',
      '子母扣', '算盘珠', '桶珠', '厚环', '圆牌', '无事牌', '三彩', '碟珠', '米珠',
    ],
    material: '翡翠',
    category: '玉',
    reason: '名称含玉器/翡翠类关键词',
  },
  // 贵金属类（仅当 DB=未分类时才推断，避免覆盖正确的贵金属关联）
  {
    keywords: ['足金', '千足金', '足银', '银珠', '金珠', '银饰', '金饰'],
    material: '黄金999足金',
    category: '贵金属',
    reason: '名称含贵金属关键词',
  },
];

interface InferResult {
  material: string;
  category: string;
  reason: string;
  hitKeyword: string;
}

function inferMaterial(name: string, dbMaterialName: string = ''): InferResult | null {
  // 贵金属规则特殊处理：仅当 DB=未分类 时才推断为贵金属
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (name.includes(kw)) {
        // 贵金属规则的条件检查
        if (rule.category === '贵金属' && dbMaterialName !== '未分类') {
          continue;
        }
        return {
          material: rule.material,
          category: rule.category,
          reason: `${rule.reason}(命中:${kw})`,
          hitKeyword: kw,
        };
      }
    }
  }
  return null;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const lines: string[] = [];
  console.log('=== 材质全量审计 V2 ===\n');

  // 1. 列出所有材质及其货品数量
  const materials = await prisma.dictMaterial.findMany({ orderBy: { category: 'asc' } });
  lines.push('=== 数据库材质表 ===');
  console.log('数据库材质表:');
  for (const m of materials) {
    const count = await prisma.item.count({ where: { materialId: m.id, isDeleted: false } });
    lines.push(`  [${m.category}] ${m.name} → ${count} 条`);
    console.log(`  [${m.category}] ${m.name} → ${count} 条`);
  }

  // 2. 全量扫描货品
  const items = await prisma.item.findMany({
    where: { isDeleted: false },
    include: { material: true },
  });
  lines.push(`\n=== 全量扫描 ${items.length} 条货品 ===`);
  console.log(`\n全量扫描 ${items.length} 条货品\n`);

  // 3. 对比：推断类别 vs 数据库类别
  interface Mismatch {
    itemId: number;
    sku: string;
    name: string;
    dbCat: string;
    dbMat: string;
    inferMat: string;
    inferCat: string;
    reason: string;
  }
  const mismatches: Mismatch[] = [];
  const noInfer: Array<{ itemId: number; sku: string; name: string; dbCat: string; dbMat: string }> = [];

  for (const item of items) {
    const dbCat = item.material?.category || '(空)';
    const dbMat = item.material?.name || '(空)';
    const infer = inferMaterial(item.name || '', dbMat);
    if (!infer) {
      noInfer.push({ itemId: item.id, sku: item.skuCode, name: item.name ?? '', dbCat, dbMat });
      continue;
    }
    // 类别不一致 或 DB=未分类但能推断出具体材质 → 视为不一致
    if (infer.category !== dbCat || dbMat === '未分类') {
      mismatches.push({
        itemId: item.id,
        sku: item.skuCode,
        name: item.name ?? '',
        dbCat,
        dbMat,
        inferMat: infer.material,
        inferCat: infer.category,
        reason: infer.reason,
      });
    }
  }

  // 4. 输出统计
  lines.push(`\n=== 材质关联不一致: ${mismatches.length} 条 ===`);
  console.log(`材质关联不一致: ${mismatches.length} 条`);

  // 按推断类别分组
  const byInfer = new Map<string, Mismatch[]>();
  for (const m of mismatches) {
    if (!byInfer.has(m.inferCat)) byInfer.set(m.inferCat, []);
    byInfer.get(m.inferCat)!.push(m);
  }
  for (const [cat, list] of byInfer) {
    lines.push(`\n--- 应为 [${cat}] 但DB不是: ${list.length} 条 ---`);
    console.log(`\n应为 [${cat}] 但DB不是: ${list.length} 条`);
    const byDb = new Map<string, number>();
    for (const m of list) {
      const key = `${m.dbMat}(${m.dbCat})`;
      byDb.set(key, (byDb.get(key) || 0) + 1);
    }
    for (const [k, v] of byDb) {
      lines.push(`  DB=${k}: ${v} 条`);
      console.log(`  DB=${k}: ${v} 条`);
    }
    lines.push('  样例:');
    for (const m of list.slice(0, 30)) {
      lines.push(`    ${m.sku} | ${m.name} | DB=${m.dbMat}(${m.dbCat}) | 应=${m.inferMat}(${m.inferCat}) | ${m.reason}`);
    }
    if (list.length > 30) lines.push(`    ... 还有 ${list.length - 30} 条`);
  }

  // 5. 未分类货品详细统计（用户重点关注）
  const unclassified = items.filter(i => (i.material?.name || '') === '未分类');
  lines.push(`\n=== 未分类货品详细统计: ${unclassified.length} 条 ===`);
  console.log(`\n未分类货品详细统计: ${unclassified.length} 条`);

  // 按推断材质分组
  const unclassifiedByInfer = new Map<string, typeof unclassified>();
  const unclassifiedNoInfer: typeof unclassified = [];
  for (const item of unclassified) {
    const infer = inferMaterial(item.name || '', '未分类');
    if (infer) {
      const key = `${infer.material}(${infer.category})`;
      if (!unclassifiedByInfer.has(key)) unclassifiedByInfer.set(key, []);
      unclassifiedByInfer.get(key)!.push(item);
    } else {
      unclassifiedNoInfer.push(item);
    }
  }
  for (const [key, list] of unclassifiedByInfer) {
    lines.push(`  可推断为 ${key}: ${list.length} 条`);
    console.log(`  可推断为 ${key}: ${list.length} 条`);
    for (const item of list.slice(0, 10)) {
      lines.push(`    ${item.skuCode} | ${item.name}`);
    }
    if (list.length > 10) lines.push(`    ... 还有 ${list.length - 10} 条`);
  }
  lines.push(`  无法推断: ${unclassifiedNoInfer.length} 条`);
  console.log(`  无法推断: ${unclassifiedNoInfer.length} 条`);
  for (const item of unclassifiedNoInfer.slice(0, 30)) {
    lines.push(`    ${item.skuCode} | ${item.name}`);
  }
  if (unclassifiedNoInfer.length > 30) lines.push(`    ... 还有 ${unclassifiedNoInfer.length - 30} 条`);

  // 6. 无法推断类别的货品
  lines.push(`\n=== 无法推断类别的货品: ${noInfer.length} 条（不报错，仅记录）===`);
  console.log(`\n无法推断类别的货品: ${noInfer.length} 条`);
  const byDbNoInfer = new Map<string, number>();
  for (const n of noInfer) {
    const key = `${n.dbMat}(${n.dbCat})`;
    byDbNoInfer.set(key, (byDbNoInfer.get(key) || 0) + 1);
  }
  for (const [k, v] of byDbNoInfer) {
    lines.push(`  DB=${k}: ${v} 条`);
    console.log(`  DB=${k}: ${v} 条`);
  }
  lines.push('  样例:');
  for (const n of noInfer.slice(0, 30)) {
    lines.push(`    ${n.sku} | ${n.name} | DB=${n.dbMat}(${n.dbCat})`);
  }
  if (noInfer.length > 30) lines.push(`    ... 还有 ${noInfer.length - 30} 条`);

  // 7. 写文本报告
  fs.writeFileSync('scripts/audit-result.txt', lines.join('\n'), 'utf8');
  console.log(`\n文本报告: scripts/audit-result.txt`);

  // 8. 导出 Excel 审核清单（2个Sheet）
  const wb = XLSX.utils.book_new();

  // Sheet1: 材质不一致清单
  const mismatchRows = mismatches.map(m => ({
    '货品ID': m.itemId,
    'SKU': m.sku,
    '货品名称': m.name,
    'DB材质': m.dbMat,
    'DB类别': m.dbCat,
    '推断材质': m.inferMat,
    '推断类别': m.inferCat,
    '推断原因': m.reason,
  }));
  const ws1 = XLSX.utils.json_to_sheet(mismatchRows);
  ws1['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 10 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '材质不一致清单');

  // Sheet2: 未分类货品清单
  const unclassifiedRows = unclassified.map(item => {
    const infer = inferMaterial(item.name || '', '未分类');
    return {
      '货品ID': item.id,
      'SKU': item.skuCode,
      '货品名称': item.name,
      'DB材质': item.material?.name || '(空)',
      'DB类别': item.material?.category || '(空)',
      '推断材质': infer?.material || '',
      '推断类别': infer?.category || '',
      '推断原因': infer?.reason || '',
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(unclassifiedRows);
  ws2['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 10 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '未分类货品清单');

  const excelPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\材质审计V2.xlsx';
  try {
    XLSX.writeFile(wb, excelPath);
    console.log(`Excel审核清单: ${excelPath}`);
  } catch (e) {
    // 文件被占用时改文件名
    const altPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\材质审计V2_new.xlsx';
    XLSX.writeFile(wb, altPath);
    console.log(`Excel被占用，改写入: ${altPath}`);
  }

  console.log(`\n=== 审计完成 ===`);
  console.log(`  不一致: ${mismatches.length} 条`);
  console.log(`  未分类: ${unclassified.length} 条（可推断 ${unclassified.length - unclassifiedNoInfer.length}，无法推断 ${unclassifiedNoInfer.length}）`);
  console.log(`  无法推断: ${noInfer.length} 条`);
}

main().finally(() => prisma.$disconnect());
