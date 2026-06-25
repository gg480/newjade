/**
 * 规格数据修正 + 组合型货品标记
 *
 * 1. 按用户批注修正 27 条规格数据
 * 2. 标记 100 条组合型货品（notes 字段加 [COMBO] 前缀）
 *
 * 用法：
 *   预览：npx tsx scripts/fix-spec-suggestions.ts
 *   写入：npx tsx scripts/fix-spec-suggestions.ts --write
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const isWriteMode = process.argv.includes('--write');

interface SpecSuggestion {
  sku: string;
  name: string;
  materialName: string;
  materialCategory: string;
  labelSpec: string;
  weight: string | number;
  metalWeight: string | number;
  braceletSize: string;
  size: string;
  beadDiameter: string;
  beadCount: string | number;
  suggestion: string;
}

interface ComboItem {
  sku: string;
  name: string;
  materialName: string;
  materialCategory: string;
  comboCategories: string[];
}

/**
 * 解析修正建议，生成规格更新数据
 */
function parseSuggestion(s: SpecSuggestion) {
  const sug = s.suggestion.trim();
  const isPreciousMetal = s.materialCategory === '贵金属';
  const result: {
    weight?: number;
    metalWeight?: number;
    braceletSize?: string;
    size?: string;
    beadDiameter?: string;
    beadCount?: number;
    action: string;
  } = { action: '' };

  // "珠径10 克重17.1" → beadDiameter=10, weight=17.1
  const beadMatch = sug.match(/珠径\s*(\d+(?:\.\d+)?)/);
  const weightMatch = sug.match(/克重\s*(\d+(?:\.\d+)?)/);
  if (beadMatch && weightMatch) {
    result.beadDiameter = beadMatch[1];
    result.weight = parseFloat(weightMatch[1]);
    result.action = 'beadDiameter+weight';
    return result;
  }

  // "4g" 或纯数字+g → 金属克重（贵金属）或货品重量（非贵金属）
  const gMatch = sug.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  if (gMatch) {
    const val = parseFloat(gMatch[1]);
    if (isPreciousMetal) {
      result.metalWeight = val;
      result.action = 'metalWeight';
    } else {
      result.weight = val;
      result.action = 'weight';
    }
    return result;
  }

  // 纯数字 → 贵金属时为金属克重，非贵金属时为货品重量
  const numMatch = sug.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (isPreciousMetal) {
      result.metalWeight = val;
      result.action = 'metalWeight';
    } else {
      result.weight = val;
      result.action = 'weight';
    }
    return result;
  }

  result.action = 'unknown';
  return result;
}

async function main() {
  console.log(`=== 规格数据修正 + 组合型标记 ===`);
  console.log(`模式: ${isWriteMode ? '写入（--write）' : '预览（dry-run）'}\n`);

  // 1. 读取规格修正建议
  const suggestions: SpecSuggestion[] = JSON.parse(
    fs.readFileSync('scripts/spec-suggestions.json', 'utf8')
  );
  console.log(`规格修正建议: ${suggestions.length} 条`);

  // 2. 读取组合型货品
  const comboItems: ComboItem[] = JSON.parse(
    fs.readFileSync('scripts/combo-items.json', 'utf8')
  );
  console.log(`组合型货品: ${comboItems.length} 条`);

  // 3. 解析修正建议
  interface SpecFix {
    sku: string;
    name: string;
    suggestion: string;
    action: string;
    update: Record<string, unknown>;
  }
  const specFixes: SpecFix[] = [];
  const unknownFixes: SpecFix[] = [];

  for (const s of suggestions) {
    const parsed = parseSuggestion(s);
    if (parsed.action === 'unknown') {
      unknownFixes.push({
        sku: s.sku,
        name: s.name,
        suggestion: s.suggestion,
        action: parsed.action,
        update: {},
      });
      continue;
    }
    const { action, ...update } = parsed;
    specFixes.push({
      sku: s.sku,
      name: s.name,
      suggestion: s.suggestion,
      action,
      update,
    });
  }

  console.log(`\n=== 规格修正解析 ===`);
  console.log(`  可修正: ${specFixes.length} 条`);
  console.log(`  无法识别: ${unknownFixes.length} 条`);

  // 按动作统计
  const byAction = new Map<string, number>();
  for (const f of specFixes) {
    byAction.set(f.action, (byAction.get(f.action) || 0) + 1);
  }
  console.log(`  动作分布:`);
  for (const [a, n] of byAction) {
    console.log(`    ${a}: ${n} 条`);
  }

  // 预览
  console.log(`\n=== 修正预览 ===`);
  for (const f of specFixes) {
    console.log(`  ${f.sku} | ${f.name} | ${f.suggestion} → ${JSON.stringify(f.update)}`);
  }
  if (unknownFixes.length > 0) {
    console.log(`\n无法识别的:`);
    for (const f of unknownFixes) {
      console.log(`  ${f.sku} | ${f.name} | "${f.suggestion}"`);
    }
  }

  // 4. 执行规格修正
  if (isWriteMode) {
    console.log(`\n=== 执行规格修正 ===`);
    let updated = 0;
    let errors = 0;
    for (const f of specFixes) {
      try {
        // 查找 item
        const item = await prisma.item.findFirst({
          where: { skuCode: f.sku, isDeleted: false },
          include: { spec: true },
        });
        if (!item) {
          console.error(`  ✗ ${f.sku} 未找到货品`);
          errors++;
          continue;
        }
        // upsert spec
        await prisma.itemSpec.upsert({
          where: { itemId: item.id },
          create: { itemId: item.id, ...f.update },
          update: f.update,
        });
        updated++;
      } catch (e) {
        errors++;
        console.error(`  ✗ ${f.sku} 更新失败: ${(e as Error).message}`);
      }
    }
    console.log(`规格修正完成: 更新 ${updated} 条, 失败 ${errors} 条`);
  }

  // 5. 标记组合型货品（notes 字段加 [COMBO] 前缀）
  console.log(`\n=== 组合型货品标记 ===`);
  console.log(`待标记: ${comboItems.length} 条`);

  if (isWriteMode) {
    let marked = 0;
    let alreadyMarked = 0;
    let errors2 = 0;
    for (const c of comboItems) {
      try {
        const item = await prisma.item.findFirst({
          where: { skuCode: c.sku, isDeleted: false },
        });
        if (!item) {
          errors2++;
          continue;
        }
        // 检查是否已标记
        if (item.notes && item.notes.includes('[COMBO]')) {
          alreadyMarked++;
          continue;
        }
        // 在 notes 前加 [COMBO:玉+贵金属] 标记
        const comboTag = `[COMBO:${c.comboCategories.join('+')}]`;
        const newNotes = item.notes ? `${comboTag} ${item.notes}` : comboTag;
        await prisma.item.update({
          where: { id: item.id },
          data: { notes: newNotes },
        });
        marked++;
      } catch (e) {
        errors2++;
        console.error(`  ✗ ${c.sku} 标记失败: ${(e as Error).message}`);
      }
    }
    console.log(`组合型标记完成: 新标记 ${marked} 条, 已标记 ${alreadyMarked} 条, 失败 ${errors2} 条`);
  } else {
    console.log(`（dry-run 模式，未实际写入）`);
    // 预览前10条
    for (const c of comboItems.slice(0, 10)) {
      console.log(`  ${c.sku} | ${c.name} → [COMBO:${c.comboCategories.join('+')}]`);
    }
  }

  // 6. 导出报告
  const report = {
    mode: isWriteMode ? 'write' : 'dry-run',
    specFixes: specFixes.length,
    unknownFixes: unknownFixes.length,
    comboItems: comboItems.length,
    specDetails: specFixes,
    unknownDetails: unknownFixes,
    comboDetails: comboItems,
  };
  fs.writeFileSync('scripts/fix-spec-suggestions-report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n报告已导出: scripts/fix-spec-suggestions-report.json`);
}

main().finally(() => prisma.$disconnect());
