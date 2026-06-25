/**
 * 规格数据补全脚本 V4（按 excel-data-governance SKILL.md 优化）
 *
 * 核心改进（V3→V4）：
 *   - 不再依赖 DB material.category 判断贵金属分流（DB材质关联本身不准确）
 *   - 改用名称关键词推断主材质类别（蜜蜡→文玩，足银→贵金属，翡翠→玉）
 *   - 修复蜜蜡+足银990被误判为贵金属导致克重错误进入 metalWeight 的问题
 *
 * 匹配键：Excel「入货单号」(I20250617037) ↔ 数据库 Item.notes ([MK:I20250617037])
 *
 * 字段映射（按推断材质类别分流）：
 *   贵金属：「金属克重」→ metalWeight
 *   非贵金属：「金属克重」→ weight（货品重量，不是金属克重）
 *   非贵金属：「大小」含"克"或与金属克重同值 → 跳过（是克重不是尺寸）；否则 → size
 *   圈口 → braceletSize（重点）
 *   珠子口径 → beadDiameter
 *   粒数 → beadCount
 *   规格 → 解析钻石数存入 Item.notes 后缀
 *   材质名称1 → 仅参考，不入库
 *
 * 用法：
 *   预览：npx tsx scripts/fix-spec-data.ts <excel路径>
 *   写入：npx tsx scripts/fix-spec-data.ts <excel路径> --write
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

// ============================================================
// 类型定义
// ============================================================

interface ExcelRow {
  '入货单号': string;
  '产品名称': string;
  '材质名称 1': string;
  '金属克重': string;
  '大小': string;
  '规格': string;
  '圈口': string;
  '粒数': string;
  '珠子口径': string;
}

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
  categorySource: string; // '名称推断' | 'DB降级'
  specData: SpecData;
  diamondNote: string | null;
}

// ============================================================
// 工具函数
// ============================================================

function cleanStr(v: unknown): string | null {
  if (v === '' || v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseFloat2(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseInt2(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function parseDiamondCount(spec: string): number | null {
  const m = spec.match(/(\d+)\s*(?:只|颗|粒)\s*钻/);
  if (m) return parseInt(m[1], 10);
  return null;
}

// ============================================================
// 名称关键词推断主材质类别（不依赖 DB material.category）
// 顺序敏感：蜜蜡/琥珀 > 水晶品种 > 玉器/翡翠 > 贵金属
// ============================================================

interface InferRule {
  keywords: string[];
  category: string;
}

const INFER_RULES: InferRule[] = [
  // 蜜蜡/琥珀 → 文玩（最高优先级，不会被镶嵌材质覆盖）
  { keywords: ['蜜蜡', '琥珀'], category: '文玩' },
  // 水晶品种
  {
    keywords: ['粉晶', '紫水晶', '紫晶', '黄水晶', '黄晶', '发晶', '钛晶', '碧玺',
      '虎眼', '金虎眼', '黑曜石', '金曜石', '玛瑙', '水晶'],
    category: '水晶',
  },
  // 玉器/翡翠关键词（宽匹配）
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
    category: '玉',
  },
  // 贵金属类
  { keywords: ['足金', '千足金', '足银', '银珠', '金珠', '银饰', '金饰'], category: '贵金属' },
];

/**
 * 用货品名称推断主材质类别
 * 返回 '贵金属' / '文玩' / '水晶' / '玉' / null
 */
function inferMaterialCategory(name: string): string | null {
  if (!name) return null;
  for (const rule of INFER_RULES) {
    for (const kw of rule.keywords) {
      if (name.includes(kw)) {
        return rule.category;
      }
    }
  }
  return null;
}

/**
 * 按材质类别构建规格数据
 * - 贵金属：金属克重 → metalWeight
 * - 非贵金属：金属克重 → weight；大小列含"克"或与金属克重同值 → 跳过
 */
function buildSpecData(row: ExcelRow, materialCategory: string): { spec: SpecData; diamondNote: string | null } {
  const spec: SpecData = {};
  const isPreciousMetal = materialCategory === '贵金属';

  // 圈口 → braceletSize（所有材质通用）
  const braceletSize = cleanStr(row['圈口']);
  if (braceletSize) spec.braceletSize = braceletSize;

  // 金属克重：按材质类别分流
  const metalWeightRaw = parseFloat2(row['金属克重']);
  if (metalWeightRaw !== null) {
    if (isPreciousMetal) {
      spec.metalWeight = metalWeightRaw;
    } else {
      // 非贵金属：这是货品克重，不是金属克重
      spec.weight = metalWeightRaw;
    }
  }

  // 大小：非贵金属时判断是否为克重（含"克"字或与金属克重同值）
  const sizeRaw = cleanStr(row['大小']);
  if (sizeRaw) {
    const sizeNum = parseFloat2(sizeRaw);
    const isKeweight =
      sizeRaw.includes('克') ||
      (sizeNum !== null && metalWeightRaw !== null && Math.abs(sizeNum - metalWeightRaw) < 0.01);
    if (isKeweight) {
      // 是克重不是尺寸：非贵金属时补入 weight（如未赋值）
      if (!isPreciousMetal && spec.weight === undefined && sizeNum !== null) {
        spec.weight = sizeNum;
      }
      // 贵金属的克重已由金属克重列覆盖，跳过
    } else {
      // 真正的尺寸（如"30"、"19"、"14.5"）
      spec.size = sizeRaw;
    }
  }

  // 珠子口径 → beadDiameter
  const beadDiameter = cleanStr(row['珠子口径']);
  if (beadDiameter) spec.beadDiameter = beadDiameter;

  // 粒数 → beadCount
  const beadCount = parseInt2(row['粒数']);
  if (beadCount !== null) spec.beadCount = beadCount;

  // 规格列：解析钻石数
  let diamondNote: string | null = null;
  const specStr = cleanStr(row['规格']);
  if (specStr) {
    const diamondCount = parseDiamondCount(specStr);
    if (diamondCount !== null) {
      diamondNote = `镶嵌${diamondCount}只钻石`;
    }
  }

  return { spec, diamondNote };
}

function hasSpecData(data: SpecData): boolean {
  return Object.keys(data).length > 0;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const excelPath = process.argv[2];
  const isWriteMode = process.argv.includes('--write');

  if (!excelPath) {
    console.error('用法: npx tsx scripts/fix-spec-data.ts <excel路径> [--write]');
    process.exit(1);
  }
  if (!fs.existsSync(excelPath)) {
    console.error(`文件不存在: ${excelPath}`);
    process.exit(1);
  }

  console.log(`\n=== 规格数据补全脚本 V4（入货单号精准+名称推断材质类别）===`);
  console.log(`模式: ${isWriteMode ? '写入（--write）' : '预览（dry-run）'}`);
  console.log(`Excel: ${excelPath}\n`);

  // 1. 读取 Excel，构建 orderNo → row 映射
  console.log('读取 Excel...');
  const buf = fs.readFileSync(excelPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets['入库登记'];
  if (!ws) {
    console.error('Excel 中找不到「入库登记」Sheet');
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: '', raw: false });
  console.log(`入库登记表: ${rows.length} 行\n`);

  // 构建入货单号 → row 映射（仅保留可能有规格数据的行）
  const rowMap = new Map<string, { row: ExcelRow; rowNum: number }>();
  for (let i = 0; i < rows.length; i++) {
    const orderNo = cleanStr(rows[i]['入货单号']);
    if (!orderNo) continue;
    // 快速判断是否有任何规格相关字段
    const hasAny =
      cleanStr(rows[i]['圈口']) ||
      cleanStr(rows[i]['金属克重']) ||
      cleanStr(rows[i]['大小']) ||
      cleanStr(rows[i]['珠子口径']) ||
      cleanStr(rows[i]['粒数']) ||
      cleanStr(rows[i]['规格']);
    if (hasAny) {
      rowMap.set(orderNo, { row: rows[i], rowNum: i + 2 });
    }
  }
  console.log(`有规格相关字段的入货单号: ${rowMap.size} 条\n`);

  // 2. 加载数据库货品（含材质），构建 notes → item 映射
  console.log('加载数据库货品...');
  const items = await prisma.item.findMany({
    select: { id: true, skuCode: true, name: true, notes: true, material: { select: { category: true, name: true } } },
  });
  console.log(`数据库货品: ${items.length} 条\n`);

  const notesIndex = new Map<string, typeof items>();
  for (const item of items) {
    const notes = (item.notes || '').trim();
    if (!notes) continue;
    const arr = notesIndex.get(notes) || [];
    arr.push(item);
    notesIndex.set(notes, arr);
  }

  // 3. 匹配 + 按材质类别构建 specData
  console.log('开始匹配...\n');
  const writeTasks: WriteTask[] = [];
  const skippedZero: { orderNo: string; productName: string; row: number }[] = [];
  const skippedMulti: { orderNo: string; productName: string; row: number; count: number }[] = [];
  const skippedNoSpec: { orderNo: string; productName: string; row: number }[] = [];

  for (const [orderNo, { row, rowNum }] of rowMap) {
    const matchKey = `[MK:${orderNo}]`;
    const matched = notesIndex.get(matchKey);

    if (!matched || matched.length === 0) {
      skippedZero.push({ orderNo, productName: cleanStr(row['产品名称']) || '', row: rowNum });
      continue;
    }
    if (matched.length > 1) {
      skippedMulti.push({ orderNo, productName: cleanStr(row['产品名称']) || '', row: rowNum, count: matched.length });
      continue;
    }

    const item = matched[0];
    // V4 关键改进：用名称关键词推断主材质类别，不依赖 DB material.category
    // 因为 DB materialId 关联本身不准确（如蜜蜡货品关联了足银990）
    const productName = cleanStr(row['产品名称']) || item.name || '';
    const dbCategory = item.material?.category || '';
    const inferredCategory = inferMaterialCategory(productName);
    // 优先用名称推断；推断失败时降级用 DB 类别
    const materialCategory = inferredCategory || dbCategory;
    const categorySource = inferredCategory ? '名称推断' : 'DB降级';
    const { spec, diamondNote } = buildSpecData(row, materialCategory);

    if (!hasSpecData(spec) && !diamondNote) {
      skippedNoSpec.push({ orderNo, productName: cleanStr(row['产品名称']) || '', row: rowNum });
      continue;
    }

    writeTasks.push({
      itemId: item.id,
      skuCode: item.skuCode,
      orderNo,
      productName: cleanStr(row['产品名称']) || '',
      materialCategory,
      categorySource,
      specData: spec,
      diamondNote,
    });
  }

  // 4. 统计
  console.log('=== 匹配结果统计 ===');
  console.log(`  精准命中: ${writeTasks.length} 条`);
  console.log(`  零命中: ${skippedZero.length} 条`);
  console.log(`  多命中: ${skippedMulti.length} 条`);
  console.log(`  命中但无规格数据: ${skippedNoSpec.length} 条\n`);

  // 字段覆盖统计
  const fieldStats = {
    weight: writeTasks.filter(t => t.specData.weight !== undefined).length,
    metalWeight: writeTasks.filter(t => t.specData.metalWeight !== undefined).length,
    braceletSize: writeTasks.filter(t => t.specData.braceletSize).length,
    size: writeTasks.filter(t => t.specData.size).length,
    beadDiameter: writeTasks.filter(t => t.specData.beadDiameter).length,
    beadCount: writeTasks.filter(t => t.specData.beadCount !== undefined).length,
    diamondNote: writeTasks.filter(t => t.diamondNote).length,
  };
  console.log('=== 字段覆盖统计 ===');
  console.log(`  货品重量 weight: ${fieldStats.weight}（非贵金属克重）`);
  console.log(`  金属克重 metalWeight: ${fieldStats.metalWeight}（贵金属）`);
  console.log(`  圈口 braceletSize: ${fieldStats.braceletSize}`);
  console.log(`  大小 size: ${fieldStats.size}`);
  console.log(`  珠子口径 beadDiameter: ${fieldStats.beadDiameter}`);
  console.log(`  粒数 beadCount: ${fieldStats.beadCount}`);
  console.log(`  钻石备注: ${fieldStats.diamondNote}\n`);

  // 按材质类别统计
  const catStat = new Map<string, number>();
  for (const t of writeTasks) {
    const c = t.materialCategory || '(空)';
    catStat.set(c, (catStat.get(c) || 0) + 1);
  }
  console.log('=== 按材质类别统计 ===');
  for (const [c, n] of catStat) {
    console.log(`  ${c}: ${n} 条`);
  }

  // 按推断来源统计（V4 新增）
  const sourceStat = { '名称推断': 0, 'DB降级': 0 };
  for (const t of writeTasks) {
    if (t.categorySource === '名称推断') sourceStat['名称推断']++;
    else sourceStat['DB降级']++;
  }
  console.log('\n=== 材质类别来源统计 ===');
  console.log(`  名称推断: ${sourceStat['名称推断']} 条`);
  console.log(`  DB降级（名称无法推断）: ${sourceStat['DB降级']} 条`);

  // 5. 预览前 20 条
  console.log('\n=== 前 20 条写入任务 ===\n');
  writeTasks.slice(0, 20).forEach((t, idx) => {
    console.log(`[${idx + 1}] 单号=${t.orderNo} | ${t.productName} | ${t.materialCategory}(${t.categorySource}) → SKU=${t.skuCode}`);
    const s = t.specData;
    const parts: string[] = [];
    if (s.weight !== undefined) parts.push(`重量=${s.weight}`);
    if (s.metalWeight !== undefined) parts.push(`金重=${s.metalWeight}`);
    if (s.braceletSize) parts.push(`圈口=${s.braceletSize}`);
    if (s.size) parts.push(`大小=${s.size}`);
    if (s.beadDiameter) parts.push(`珠径=${s.beadDiameter}`);
    if (s.beadCount !== undefined) parts.push(`粒数=${s.beadCount}`);
    if (t.diamondNote) parts.push(`备注=${t.diamondNote}`);
    console.log(`    规格: ${parts.join(', ')}\n`);
  });

  // 6. 写入模式
  if (isWriteMode) {
    console.log('\n=== 写入模式 ===\n');

    // 6.1 清空 ItemSpec
    console.log('清空 ItemSpec...');
    const deleted = await prisma.itemSpec.deleteMany({});
    console.log(`已删除 ${deleted.count} 条旧记录\n`);

    // 6.2 回滚 V2 追加的钻石备注（从 notes 中移除"镶嵌X只钻石"）
    console.log('清理 V2 追加的钻石备注...');
    const itemsWithDiamond = await prisma.item.findMany({
      where: { notes: { contains: '镶嵌' } },
      select: { id: true, notes: true },
    });
    let notesCleaned = 0;
    for (const item of itemsWithDiamond) {
      const cleanedNotes = (item.notes || '').replace(/\s*镶嵌\d+只钻石\s*/g, '').trim();
      if (cleanedNotes !== item.notes) {
        await prisma.item.update({ where: { id: item.id }, data: { notes: cleanedNotes } });
        notesCleaned++;
      }
    }
    console.log(`已清理 ${notesCleaned} 条旧钻石备注\n`);

    // 6.3 upsert ItemSpec + 更新钻石备注
    console.log('开始 upsert ItemSpec...');
    let upserted = 0;
    let failed = 0;
    let notesUpdated = 0;

    for (const t of writeTasks) {
      try {
        await prisma.itemSpec.upsert({
          where: { itemId: t.itemId },
          create: { itemId: t.itemId, ...t.specData },
          update: { ...t.specData },
        });
        upserted++;

        if (t.diamondNote) {
          const item = await prisma.item.findUnique({
            where: { id: t.itemId },
            select: { notes: true },
          });
          const oldNotes = (item?.notes || '').trim();
          if (oldNotes && !oldNotes.includes(t.diamondNote)) {
            await prisma.item.update({
              where: { id: t.itemId },
              data: { notes: `${oldNotes} ${t.diamondNote}` },
            });
            notesUpdated++;
          }
        }

        if (upserted % 100 === 0) console.log(`  进度: ${upserted}/${writeTasks.length}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  失败: itemId=${t.itemId} SKU=${t.skuCode} - ${msg}`);
        failed++;
      }
    }

    console.log(`\n写入完成: ItemSpec 成功 ${upserted} 条, 失败 ${failed} 条`);
    console.log(`钻石备注更新: ${notesUpdated} 条\n`);
  } else {
    console.log('\n（dry-run 模式，未写入数据库。加 --write 参数执行实际写入）\n');
  }

  // 7. 输出报告
  const report = {
    mode: isWriteMode ? 'write' : 'dry-run',
    excelPath,
    totalExcelRows: rows.length,
    matchStats: {
      matched: writeTasks.length,
      zero: skippedZero.length,
      multi: skippedMulti.length,
      noSpec: skippedNoSpec.length,
    },
    fieldStats,
    writeTasks: writeTasks.map(t => ({
      itemId: t.itemId,
      skuCode: t.skuCode,
      orderNo: t.orderNo,
      productName: t.productName,
      materialCategory: t.materialCategory,
      categorySource: t.categorySource,
      specData: t.specData,
      diamondNote: t.diamondNote,
    })),
    skippedZero,
    skippedMulti,
  };
  const reportPath = 'scripts/fix-spec-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`完整报告已写入: ${reportPath}`);
}

main()
  .catch(e => {
    console.error('脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
