/**
 * 综合治理审核导出 V2（基于系统材质体系）
 *
 * 改进点：
 *   - 推断逻辑基于系统现有 DictMaterial 表，不自己创建材质名
 *   - Sheet1: 全量材质核对（5231条，DB材质 vs 推断系统材质）
 *   - Sheet2: Excel规格匹配清单（835条）
 *
 * 用法：npx tsx scripts/export-governance-audit.ts
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

// ============================================================
// 系统材质体系（运行时从 DB 加载）
// ============================================================

interface SystemMaterial {
  id: number;
  name: string;
  category: string | null;
}

let systemMaterials: SystemMaterial[] = [];
let materialByName: Map<string, SystemMaterial> = new Map();

async function loadSystemMaterials() {
  systemMaterials = await prisma.dictMaterial.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true },
    orderBy: { category: 'asc' },
  });
  for (const m of systemMaterials) {
    materialByName.set(m.name, m);
  }
  console.log(`加载系统材质: ${systemMaterials.length} 个`);
  for (const m of systemMaterials) {
    console.log(`  [${m.category || '(空)'}] ${m.name} (id=${m.id})`);
  }
}

// ============================================================
// 名称关键词 → 系统材质映射规则
// 顺序敏感：蜜蜡/琥珀 > 水晶品种 > 玉器/翡翠 > 贵金属
// 每条规则映射到系统现有材质名
// ============================================================

interface InferRule {
  keywords: string[];
  systemMaterialName: string; // 必须是系统 DictMaterial 中存在的材质名
  reason: string;
}

const INFER_RULES: InferRule[] = [
  // 蜜蜡/琥珀 → 文玩
  { keywords: ['蜜蜡'], systemMaterialName: '蜜蜡', reason: '蜜蜡属文玩' },
  { keywords: ['琥珀'], systemMaterialName: '琥珀', reason: '琥珀属文玩' },
  // 水晶品种（精确匹配系统材质名）
  { keywords: ['粉晶'], systemMaterialName: '粉晶', reason: '粉晶属水晶' },
  { keywords: ['紫水晶', '紫晶'], systemMaterialName: '紫水晶', reason: '紫水晶属水晶' },
  { keywords: ['巴西黄水晶'], systemMaterialName: '巴西黄水晶', reason: '巴西黄水晶属水晶' },
  { keywords: ['人工黄水晶'], systemMaterialName: '人工黄水晶', reason: '人工黄水晶属水晶' },
  { keywords: ['黄水晶', '黄晶'], systemMaterialName: '黄水晶', reason: '黄水晶属水晶' },
  { keywords: ['金发晶'], systemMaterialName: '金发晶', reason: '金发晶属水晶' },
  { keywords: ['发晶'], systemMaterialName: '发晶', reason: '发晶属水晶' },
  { keywords: ['钛晶'], systemMaterialName: '钛晶', reason: '钛晶属水晶' },
  { keywords: ['绿幽灵'], systemMaterialName: '绿幽灵', reason: '绿幽灵属水晶' },
  { keywords: ['红幽灵'], systemMaterialName: '红幽灵', reason: '红幽灵属水晶' },
  { keywords: ['白幽灵'], systemMaterialName: '白幽灵', reason: '白幽灵属水晶' },
  { keywords: ['彩幽灵'], systemMaterialName: '彩幽灵', reason: '彩幽灵属水晶' },
  { keywords: ['蓝晶石'], systemMaterialName: '蓝晶石', reason: '蓝晶石属水晶' },
  { keywords: ['红绿宝石'], systemMaterialName: '红绿宝石共生', reason: '红绿宝石共生属水晶' },
  { keywords: ['天河石'], systemMaterialName: '天河石', reason: '天河石属水晶' },
  { keywords: ['海蓝宝'], systemMaterialName: '海蓝宝', reason: '海蓝宝属水晶' },
  { keywords: ['车花透辉石'], systemMaterialName: '车花透辉石', reason: '车花透辉石属水晶' },
  { keywords: ['碧玺'], systemMaterialName: '碧玺', reason: '碧玺属水晶' },
  { keywords: ['金虎眼'], systemMaterialName: '金虎眼', reason: '金虎眼属水晶' },
  { keywords: ['虎眼'], systemMaterialName: '虎眼', reason: '虎眼属水晶' },
  { keywords: ['青金石'], systemMaterialName: '青金石', reason: '青金石属水晶' },
  { keywords: ['金曜石'], systemMaterialName: '金曜石', reason: '金曜石属水晶' },
  { keywords: ['黑曜石'], systemMaterialName: '黑曜石', reason: '黑曜石属水晶' },
  { keywords: ['玛瑙'], systemMaterialName: '玛瑙', reason: '玛瑙属水晶' },
  { keywords: ['莹石'], systemMaterialName: '莹石', reason: '莹石属水晶' },
  // 注意：系统材质表中没有名为"水晶"的材质，只有具体品种（粉晶/紫水晶等）
  // 玉器/翡翠（宽匹配，统一映射到系统"翡翠"材质）
  {
    keywords: [
      '翡翠', '佛公', '手镯', '糯底', '糯化', '豆青', '豆底', '豆绿', '豆种',
      '白地青', '白底青', '紫萝兰', '紫夢兰', '冰油', '冰种', '冰底', '冰黄', '冰紫',
      '春彩', '春带彩', '飘花', '飘绿', '红翡', '黄翡', '果绿', '果糖',
      '洒金', '铁龙星', '花青', '油底', '油青', '青绿', '茄紫', '黑油青',
      '牛奶底', '牛好底', '算盘子', '竹节', '平安扣', '面包扣', '福袋', '福锁',
      '貔貅', '妖花', '如意', '关公', '路路通', '招财进宝', '长寿果',
      '子母扣', '算盘珠', '桶珠', '厚环', '圆牌', '无事牌', '三彩', '碟珠', '米珠',
      '怀古', '怀古扣',
    ],
    systemMaterialName: '翡翠',
    reason: '名称含玉器/翡翠类关键词',
  },
  // 碧玉/青玉/和田玉
  { keywords: ['碧玉'], systemMaterialName: '碧玉', reason: '碧玉属玉' },
  { keywords: ['青玉'], systemMaterialName: '青玉', reason: '青玉属玉' },
  { keywords: ['和田玉'], systemMaterialName: '和田玉', reason: '和田玉属玉' },
  // 贵金属类（精确匹配系统材质名）
  { keywords: ['足银990', '足银'], systemMaterialName: '足银990', reason: '足银990属贵金属' },
  { keywords: ['925银'], systemMaterialName: '925银', reason: '925银属贵金属' },
  { keywords: ['18K金'], systemMaterialName: '18K金', reason: '18K金属贵金属' },
  { keywords: ['K白金'], systemMaterialName: 'K白金', reason: 'K白金属贵金属' },
  { keywords: ['玫瑰金'], systemMaterialName: '玫瑰金', reason: '玫瑰金属贵金属' },
  { keywords: ['铂金999'], systemMaterialName: '铂金999', reason: '铂金999属贵金属' },
  { keywords: ['k铂金'], systemMaterialName: 'k铂金', reason: 'k铂金属贵金属' },
  { keywords: ['铂金'], systemMaterialName: '铂金', reason: '铂金属贵金属' },
  { keywords: ['黄金999足金', '足金', '千足金'], systemMaterialName: '黄金999足金', reason: '黄金999足金属贵金属' },
  // 注意：系统材质表中没有名为"黄金"的材质，只有"黄金999足金"
  // 其他
  { keywords: ['锆石'], systemMaterialName: '锆石', reason: '锆石属其他' },
  { keywords: ['斑彩螺'], systemMaterialName: '斑彩螺', reason: '斑彩螺属其他' },
  { keywords: ['珍珠'], systemMaterialName: '珍珠', reason: '珍珠属其他' },
  { keywords: ['珊瑚'], systemMaterialName: '珊瑚', reason: '珊瑚属其他' },
  { keywords: ['朱砂'], systemMaterialName: '朱砂', reason: '朱砂属文玩' },
];

interface InferResult {
  systemMaterialId: number;
  systemMaterialName: string;
  category: string;
  reason: string;
}

/**
 * 用货品名称推断系统材质（基于 DictMaterial 表）
 * 返回系统材质 ID + 名称 + 类别
 */
function inferSystemMaterial(name: string): InferResult | null {
  if (!name) return null;
  for (const rule of INFER_RULES) {
    for (const kw of rule.keywords) {
      if (name.includes(kw)) {
        const mat = materialByName.get(rule.systemMaterialName);
        if (!mat) {
          // 规则配置错误：系统材质表中不存在该材质名
          console.warn(`⚠️ 规则配置错误：系统材质表中不存在"${rule.systemMaterialName}"`);
          return null;
        }
        return {
          systemMaterialId: mat.id,
          systemMaterialName: mat.name,
          category: mat.category || '(空)',
          reason: `${rule.reason}(命中:${kw})`,
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
  console.log('=== 综合治理审核导出 V2 ===\n');

  // 1. 加载系统材质体系
  await loadSystemMaterials();

  // 2. 全量扫描货品
  console.log('\n加载全量货品...');
  const items = await prisma.item.findMany({
    where: { isDeleted: false },
    include: { material: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log(`货品总数: ${items.length}\n`);

  // 3. 构建 Sheet1 数据：全量材质核对
  const sheet1Rows = items.map(item => {
    const dbMatName = item.material?.name || '(空)';
    const dbCat = item.material?.category || '(空)';
    const infer = inferSystemMaterial(item.name || '');
    const isMatch = infer ? infer.systemMaterialName === dbMatName : true;
    const needFix = infer && !isMatch;
    return {
      '货品ID': item.id,
      'SKU': item.skuCode,
      '货品名称': item.name,
      'DB材质ID': item.materialId ?? '',
      'DB材质名': dbMatName,
      'DB材质类别': dbCat,
      '推断材质ID': infer?.systemMaterialId ?? '',
      '推断材质名': infer?.systemMaterialName ?? '',
      '推断材质类别': infer?.category ?? '',
      '推断原因': infer?.reason ?? '',
      '是否一致': isMatch ? '✓' : '✗',
      '是否需修正': needFix ? '是' : '否',
    };
  });

  const mismatchCount = sheet1Rows.filter(r => r['是否一致'] === '✗').length;
  const noInferCount = sheet1Rows.filter(r => !r['推断材质名']).length;
  console.log(`Sheet1 全量材质核对: ${sheet1Rows.length} 条（不一致 ${mismatchCount}，无法推断 ${noInferCount}）`);

  // 4. 构建 Sheet2 数据：Excel规格匹配清单（从 fix-spec-report.json 读取）
  let sheet2Rows: unknown[] = [];
  const reportPath = 'scripts/fix-spec-report.json';
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    sheet2Rows = report.writeTasks.map((t: any) => {
      const s = t.specData;
      // 标签格式规格
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
        const parts: string[] = [];
        if (s.metalWeight !== undefined) parts.push(`${s.metalWeight}g`);
        if (s.beadDiameter) parts.push(`珠径${s.beadDiameter}`);
        if (s.beadCount !== undefined) parts.push(`${s.beadCount}粒`);
        labelSpec = parts.join(' ');
      }
      return {
        'SKU': t.skuCode,
        '货品名称': t.productName,
        '推断材质类别': t.materialCategory,
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
    console.log(`Sheet2 Excel规格匹配: ${sheet2Rows.length} 条`);
  } else {
    console.log('⚠️ 未找到 scripts/fix-spec-report.json，Sheet2 为空（请先运行 fix-spec-data.ts dry-run）');
  }

  // 5. 构建 Sheet3 数据：需修正材质清单（仅不一致的）
  const sheet3Rows = sheet1Rows.filter(r => r['是否需修正'] === '是');
  console.log(`Sheet3 需修正材质清单: ${sheet3Rows.length} 条`);

  // 6. 构建 Sheet4 数据：未分类货品清单
  const sheet4Rows = sheet1Rows.filter(r => r['DB材质名'] === '未分类');
  console.log(`Sheet4 未分类货品清单: ${sheet4Rows.length} 条`);

  // 7. 写 Excel
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
  ws1['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 28 }, { wch: 8 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '全量材质核对');

  if (sheet2Rows.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);
    ws2['!cols'] = [
      { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 18 },
      { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 8 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Excel规格匹配');
  }

  const ws3 = XLSX.utils.json_to_sheet(sheet3Rows);
  ws3['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 28 }, { wch: 8 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, '需修正材质清单');

  const ws4 = XLSX.utils.json_to_sheet(sheet4Rows);
  ws4['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 28 }, { wch: 8 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, '未分类货品清单');

  const excelPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\综合治理审核V2.xlsx';
  try {
    XLSX.writeFile(wb, excelPath);
    console.log(`\n✓ 审核Excel已导出: ${excelPath}`);
  } catch {
    const altPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\综合治理审核V2_new.xlsx';
    XLSX.writeFile(wb, altPath);
    console.log(`\n✓ 文件被占用，改写入: ${altPath}`);
  }

  // 8. 输出统计摘要
  console.log('\n=== 统计摘要 ===');
  console.log(`全量货品: ${items.length} 条`);
  console.log(`材质不一致: ${mismatchCount} 条`);
  console.log(`无法推断: ${noInferCount} 条`);
  console.log(`未分类货品: ${sheet4Rows.length} 条`);

  // 按推断类别统计不一致
  const byInferCat = new Map<string, number>();
  for (const r of sheet3Rows) {
    const c = r['推断材质类别'] as string;
    byInferCat.set(c, (byInferCat.get(c) || 0) + 1);
  }
  console.log('\n需修正按推断类别分布:');
  for (const [c, n] of byInferCat) {
    console.log(`  ${c}: ${n} 条`);
  }
}

main().finally(() => prisma.$disconnect());
