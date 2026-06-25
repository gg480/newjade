/**
 * 材质修正脚本 V2（基于用户审核批注）
 *
 * 流程：
 *   1. 新增系统缺失的材质（东凌玉）
 *   2. 解析用户批注的"修正建议"列
 *   3. 映射到系统材质 ID
 *   4. dry-run 预览 / --write 执行
 *
 * 用法：
 *   预览：npx tsx scripts/fix-material-id.ts
 *   写入：npx tsx scripts/fix-material-id.ts --write
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const isWriteMode = process.argv.includes('--write');

// 修正建议 → 系统材质名映射表
// 处理用户批注中的各种写法
const SUGGESTION_TO_MATERIAL: Record<string, string> = {
  // 直接材质名
  '黄金999足金': '黄金999足金',
  '玛瑙': '玛瑙',
  '足银990': '足银990',
  '碧玺': '碧玺',
  '粉晶': '粉晶',
  '925银': '925银',
  '钛晶': '钛晶',
  '黄水晶': '黄水晶',
  '斑彩螺': '斑彩螺',
  '玫瑰金': '玫瑰金',
  '金发晶': '金发晶',
  '海蓝宝': '海蓝宝',
  '金曜石': '金曜石',
  // 需要映射的写法
  '银990': '足银990',
  '黄翡': '翡翠',
  '翡翠': '翡翠',
  '东凌玉': '东凌玉',
  // 带说明的特殊情况
  '925银属贵金属(命中:925银)': '925银',
  '朱砂 关键词帝皇砂': '朱砂',
  '翡翠 关键词是白底青': '翡翠',
  '在铂金中有钻石字样实际就是铂金里面的钻石多反光面工艺 材质还是铂金来的': '铂金',
};

// 需要跳过的修正建议（不修改 materialId）
const SKIP_SUGGESTIONS = new Set([
  '组合型',
  '这种是组合型的有玉又有银',
  '这个名称还包含了尺寸你需要记录',
]);

// "按DB"类建议：保持 DB 材质不变
function isKeepDb(suggestion: string): boolean {
  return suggestion.startsWith('按DB') || suggestion === '按DB';
}

// "按推断修复"类建议：用推断的材质
function isUseInfer(suggestion: string): boolean {
  return suggestion.includes('按推断');
}

interface SuggestionRow {
  itemId: number;
  sku: string;
  name: string;
  dbMaterialId: number | '';
  dbMaterialName: string;
  dbCategory: string;
  inferMaterialId: number | '';
  inferMaterialName: string;
  inferCategory: string;
  suggestion: string;
}

async function main() {
  console.log(`=== 材质修正脚本 V2（基于用户批注）===`);
  console.log(`模式: ${isWriteMode ? '写入（--write）' : '预览（dry-run）'}\n`);

  // 1. 加载系统材质表
  const materials = await prisma.dictMaterial.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true },
  });
  const materialByName = new Map<string, { id: number; name: string; category: string | null }>();
  for (const m of materials) {
    materialByName.set(m.name, m);
  }
  console.log(`系统材质: ${materials.length} 个`);

  // 2. 新增"东凌玉"材质（如不存在）
  if (!materialByName.has('东凌玉')) {
    console.log('\n新增材质: 东凌玉 (类别=玉)');
    if (isWriteMode) {
      const newMat = await prisma.dictMaterial.create({
        data: { name: '东凌玉', category: '玉', sortOrder: 0, isActive: true },
      });
      materialByName.set('东凌玉', newMat);
      console.log(`  已创建 id=${newMat.id}`);
    } else {
      console.log('  (dry-run 模式，未实际创建，使用临时 id=999)');
      materialByName.set('东凌玉', { id: 999, name: '东凌玉', category: '玉' });
    }
  }

  // 3. 读取用户批注
  const suggestions: SuggestionRow[] = JSON.parse(
    fs.readFileSync('scripts/user-suggestions.json', 'utf8')
  );
  console.log(`\n用户批注: ${suggestions.length} 条`);

  // 4. 解析批注，生成修正任务
  interface FixTask {
    itemId: number;
    sku: string;
    name: string;
    oldMaterialId: number;
    oldMaterialName: string;
    newMaterialId: number;
    newMaterialName: string;
    newCategory: string;
    suggestion: string;
    action: 'update' | 'keep_db' | 'use_infer' | 'skip';
  }

  const fixTasks: FixTask[] = [];
  const skipped: Array<{ sku: string; name: string; suggestion: string; reason: string }> = [];

  for (const s of suggestions) {
    const sug = s.suggestion.trim();

    // 跳过组合型等
    if (SKIP_SUGGESTIONS.has(sug)) {
      skipped.push({ sku: s.sku, name: s.name, suggestion: sug, reason: '组合型/特殊，跳过' });
      continue;
    }

    // 按DB：保持不变
    if (isKeepDb(sug)) {
      fixTasks.push({
        itemId: s.itemId,
        sku: s.sku,
        name: s.name,
        oldMaterialId: Number(s.dbMaterialId),
        oldMaterialName: s.dbMaterialName,
        newMaterialId: Number(s.dbMaterialId),
        newMaterialName: s.dbMaterialName,
        newCategory: s.dbCategory,
        suggestion: sug,
        action: 'keep_db',
      });
      continue;
    }

    // 按推断修复
    if (isUseInfer(sug)) {
      if (!s.inferMaterialId) {
        skipped.push({ sku: s.sku, name: s.name, suggestion: sug, reason: '无推断材质' });
        continue;
      }
      fixTasks.push({
        itemId: s.itemId,
        sku: s.sku,
        name: s.name,
        oldMaterialId: Number(s.dbMaterialId),
        oldMaterialName: s.dbMaterialName,
        newMaterialId: Number(s.inferMaterialId),
        newMaterialName: s.inferMaterialName,
        newCategory: s.inferCategory,
        suggestion: sug,
        action: 'use_infer',
      });
      continue;
    }

    // 直接材质名或映射
    const targetMaterialName = SUGGESTION_TO_MATERIAL[sug];
    if (targetMaterialName) {
      const mat = materialByName.get(targetMaterialName);
      if (!mat) {
        skipped.push({ sku: s.sku, name: s.name, suggestion: sug, reason: `系统无材质"${targetMaterialName}"` });
        continue;
      }
      fixTasks.push({
        itemId: s.itemId,
        sku: s.sku,
        name: s.name,
        oldMaterialId: Number(s.dbMaterialId),
        oldMaterialName: s.dbMaterialName,
        newMaterialId: mat.id,
        newMaterialName: mat.name,
        newCategory: mat.category || '',
        suggestion: sug,
        action: 'update',
      });
      continue;
    }

    // 无法识别的建议
    skipped.push({ sku: s.sku, name: s.name, suggestion: sug, reason: '无法识别的修正建议' });
  }

  // 5. 统计
  const toUpdate = fixTasks.filter(t => t.action === 'update' && t.oldMaterialId !== t.newMaterialId);
  const keepDb = fixTasks.filter(t => t.action === 'keep_db');
  const useInfer = fixTasks.filter(t => t.action === 'use_infer');

  console.log(`\n=== 解析结果 ===`);
  console.log(`  需更新 materialId: ${toUpdate.length} 条`);
  console.log(`  保持 DB（按DB）: ${keepDb.length} 条`);
  console.log(`  按推断修复: ${useInfer.length} 条`);
  console.log(`  跳过（组合型/无法识别）: ${skipped.length} 条`);

  // 按目标材质统计
  const byTarget = new Map<string, number>();
  for (const t of [...toUpdate, ...useInfer]) {
    const key = `${t.newMaterialName}(${t.newCategory})`;
    byTarget.set(key, (byTarget.get(key) || 0) + 1);
  }
  console.log(`\n更新目标分布:`);
  for (const [k, n] of [...byTarget.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n} 条`);
  }

  // 跳过原因统计
  if (skipped.length > 0) {
    console.log(`\n跳过原因分布:`);
    const byReason = new Map<string, number>();
    for (const s of skipped) {
      byReason.set(s.reason, (byReason.get(s.reason) || 0) + 1);
    }
    for (const [r, n] of byReason) {
      console.log(`  ${r}: ${n} 条`);
    }
    // 输出无法识别的样例
    const unknown = skipped.filter(s => s.reason === '无法识别的修正建议');
    if (unknown.length > 0) {
      console.log(`\n无法识别的修正建议样例:`);
      for (const u of unknown.slice(0, 10)) {
        console.log(`  ${u.sku} | ${u.name} | 建议="${u.suggestion}"`);
      }
    }
  }

  // 6. 预览前20条更新
  console.log(`\n=== 更新预览（前20条）===`);
  for (const t of toUpdate.slice(0, 20)) {
    console.log(`  ${t.sku} | ${t.name} | ${t.oldMaterialName} → ${t.newMaterialName}(${t.newCategory}) | 建议="${t.suggestion}"`);
  }
  if (toUpdate.length > 20) {
    console.log(`  ... 还有 ${toUpdate.length - 20} 条`);
  }

  // 7. 执行写入
  if (isWriteMode) {
    console.log(`\n=== 执行写入 ===`);
    let updated = 0;
    let errors = 0;
    for (const t of [...toUpdate, ...useInfer]) {
      if (t.oldMaterialId === t.newMaterialId) continue;
      try {
        await prisma.item.update({
          where: { id: t.itemId },
          data: { materialId: t.newMaterialId },
        });
        updated++;
      } catch (e) {
        errors++;
        console.error(`  ✗ ${t.sku} 更新失败: ${(e as Error).message}`);
      }
    }
    console.log(`\n写入完成: 更新 ${updated} 条, 失败 ${errors} 条`);
  } else {
    console.log(`\n（dry-run 模式，未实际写入。加 --write 执行写入）`);
  }

  // 8. 导出报告
  const report = {
    mode: isWriteMode ? 'write' : 'dry-run',
    total: suggestions.length,
    toUpdate: toUpdate.length,
    keepDb: keepDb.length,
    useInfer: useInfer.length,
    skipped: skipped.length,
    fixTasks: [...toUpdate, ...useInfer].map(t => ({
      itemId: t.itemId,
      sku: t.sku,
      name: t.name,
      oldMaterialName: t.oldMaterialName,
      newMaterialName: t.newMaterialName,
      newCategory: t.newCategory,
      suggestion: t.suggestion,
    })),
    skippedItems: skipped,
  };
  fs.writeFileSync('scripts/fix-material-report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n报告已导出: scripts/fix-material-report.json`);
}

main().finally(() => prisma.$disconnect());
