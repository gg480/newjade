/**
 * ADR-020 Phase 4: 导出迁移审核 Excel（含主石校验）
 *
 * 校验规则：
 *   - 镶嵌型主石不能是贵金属（必须是玉/水晶/文玩等）
 *   - 镶材必须是贵金属
 *   - 主石 = 镶材 时报错
 *
 * 对于名称以"K白金/玫瑰金/18K白金"开头但器型明显的货品，
 * 主石统一修正为翡翠(id=1)。
 *
 * 用法: npx tsx scripts/migrate-adr020-history.ts           # dry-run + 导出 Excel
 *       npx tsx scripts/migrate-adr020-history.ts --write    # 写入数据库
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

const MATERIAL_NAME_TO_ID: Record<string, number> = {
  '翡翠': 1, '朱砂': 2, '人工黄水晶': 3, '玛瑙': 4, '锆石': 5,
  '斑彩螺': 6, '足银990': 7, '珍珠': 8, '未分类': 9, '碧玉': 10,
  '青玉': 11, '18K金': 12, '铂金999': 14, '黄水晶': 15, '紫水晶': 16,
  '蜜蜡': 17, '琥珀': 18, '发晶': 19, '金发晶': 20, '钛晶': 21,
  '绿幽灵': 22, '红幽灵': 23, '蓝晶石': 24, '红绿宝石共生': 25,
  '天河石': 26, '海蓝宝': 27, '巴西黄水晶': 28, '车花透辉石': 29,
  '碧玺': 30, '珊瑚': 31, '金虎眼': 32, '虎眼': 33, '青金石': 34,
  '金曜石': 35, '黑曜石': 36, '黄金999足金': 37, '和田玉': 38,
  '粉晶': 40, '莹石': 41, '白幽灵': 42, '彩幽灵': 43,
  '铂金': 44, 'K白金': 46, '925银': 47, '银': 49, '东凌玉': 52,
  '玫瑰金': 12, 'K黄金': 12, 'K金': 12, '18K': 12, '18K白金': 46, 'k铂': 44,
  '足金': 37, '黄金': 37, '银990': 7,
};

const SETTING_KEYWORDS: [string, number][] = [
  ['K白金', 46], ['18K白金', 46],
  ['K黄金', 12], ['K金', 12], ['18K', 12], ['18K金', 12],
  ['玫瑰金', 12],
  ['铂金', 44], ['铂', 44], ['k铂', 44],
  ['足金', 37], ['黄金', 37], ['黄金999', 37],
  ['足银', 7], ['银990', 7], ['925银', 47], ['银', 49],
];

// 贵金属材质 ID（只能作为镶材，不能作为主石）
const METAL_IDS = new Set([7, 12, 14, 37, 44, 46, 47, 49]);

// 镶材计价映射：无定价的贵金属 → 有定价的等价材质
// K白金/18K白金本质都是18K金，玫瑰金也是18K金的一种
// 铂金(足铂) → 铂金999, 925银 → 银
const SETTING_TO_PRICE_MAP: Record<number, { toId: number; toName: string }> = {
  // K白金(id=46) 有自己的 pricing 配置（ratio=0.75, labor=70, subType=Au9999），保持原ID
  // 铂金(id=44) 无 ratio/labor 配置，映射到铂金999
  44: { toId: 14, toName: '铂金999' },  // 铂金 → 铂金999(¥493.8/克)
};

// 翡翠器型关键词（用于推断主石为翡翠）
const JADE_ITEM_KEYWORDS = [
  '葫芦', '水滴', '蝴蝶', '寿桃', '马鞍', '旦', '树叶', '观音',
  '如意', '平安扣', '佛公', '佛', '心形', '心', '方牌', '牌',
  '戒指', '耳环', '耳钉', '手链', '项链', '吊坠', '手镯',
  '榄尖', '马眼', '蛋', '豆', '竹福', '椒财', '鱼', '余',
  '兰花', '莲叶', '石榴石', '红宝石', '钻石', '围钻', '伴钻',
  '墨翠', '绿', '紫', '红', '冰', '油', '飘', '花件',
  '柱形', '欢色', '双色', '双拼', '随形', '榄形',
];

function isPureComposite(name: string): boolean {
  const hasSetting = SETTING_KEYWORDS.some(([kw]) => name.includes(kw));
  if (hasSetting) return false;
  if (name.includes('十')) return true;
  return false;
}

function inferSetting(name: string): number | null {
  for (const [kw, id] of SETTING_KEYWORDS) {
    if (name.includes(kw)) return id;
  }
  return null;
}

function inferSettingName(name: string): string {
  for (const [kw] of SETTING_KEYWORDS) {
    if (name.includes(kw)) return kw;
  }
  return '';
}

/** 判断名称是否暗示主石为翡翠 */
function looksLikeJadeItem(name: string): boolean {
  return JADE_ITEM_KEYWORDS.some(kw => name.includes(kw));
}

async function main() {
  const buf = fs.readFileSync('C:\\Users\\1\\Desktop\\玉器店经营\\综合治理审核V2.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets['全量材质核对'];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '', raw: false });

  const comboRows = rows.filter(r => {
    const s = String(r['修正建议'] || '').trim();
    return s.includes('组合型') || s.includes('镶嵌') || s.includes('有玉又有银') || s.includes('有贵金属');
  });

  const allMats = await prisma.dictMaterial.findMany({ where: { isActive: true } });
  const matMap = new Map(allMats.map(m => [m.id, m]));

  const exportRows: any[] = [];
  let fixed = 0;

  for (const row of comboRows) {
    const itemId = parseInt(String(row['货品ID']), 10);
    const name = String(row['货品名称'] || '');
    const sku = String(row['SKU'] || '');
    const dbMaterialName = String(row['DB材质名'] || '');
    const inferredName = String(row['推断材质名'] || '');
    const dbCategory = String(row['DB材质类别'] || '');

    let type = '镶嵌型';
    let mainStoneName = '';
    let mainStoneId = '';
    let settingName = '';
    let settingId = '';
    let originalMainStone = '';
    let fixNote = '';

    if (isPureComposite(name)) {
      type = '组合型';
      const matId = MATERIAL_NAME_TO_ID[inferredName];
      if (matId) {
        mainStoneName = inferredName;
        mainStoneId = String(matId);
      }
    } else {
      type = '镶嵌型';
      let msId: number | null = MATERIAL_NAME_TO_ID[inferredName] || null;
      if (!msId) msId = MATERIAL_NAME_TO_ID[dbMaterialName] || null;
      if (!msId) {
        for (const [kw, id] of Object.entries(MATERIAL_NAME_TO_ID)) {
          if (name.includes(kw)) { msId = id; break; }
        }
      }

      // ── 校验：主石不能是贵金属 ──
      if (msId && METAL_IDS.has(msId)) {
        originalMainStone = matMap.get(msId)?.name || `id=${msId}`;
        // 名称含翡翠器型关键词 → 修正为翡翠
        if (looksLikeJadeItem(name)) {
          msId = 1; // 翡翠
          fixNote = `主石由${originalMainStone}修正为翡翠（器型推断）`;
          fixed++;
        } else {
          // 无法推断，标记问题
          fixNote = `⚠️ 主石为贵金属${originalMainStone}，需人工确认`;
        }
      }

      if (msId) {
        const mat = matMap.get(msId);
        mainStoneName = mat?.name || `id=${msId}`;
        mainStoneId = String(msId);
      }

      const sId = inferSetting(name);
      let sIdFinal = sId;
      let sPriceFixNote = '';
      if (sId && SETTING_TO_PRICE_MAP[sId]) {
        const map = SETTING_TO_PRICE_MAP[sId];
        sIdFinal = map.toId;
        sPriceFixNote = `镶材${inferSettingName(name)}→${map.toName}(计价)`;
        if (!fixNote) fixNote = '';
        if (fixNote) fixNote += '；';
        fixNote += sPriceFixNote;
      }
      if (sIdFinal) {
        settingName = inferSettingName(name);
        // 用映射后的名字
        if (sPriceFixNote) {
          settingName = SETTING_TO_PRICE_MAP[sId!]!.toName;
        }
        settingId = String(sIdFinal);
      }

      // ── 校验：主石 = 镶材 ──
      if (msId && sIdFinal && msId === sIdFinal) {
        if (!fixNote) fixNote = `⚠️ 主石与镶材相同（${mainStoneName}），需人工确认`;
      }
    }

    exportRows.push({
      '货品ID': itemId,
      'SKU': sku,
      '货品名称': name,
      'DB材质名': dbMaterialName,
      'DB材质类别': dbCategory,
      '推断材质名': inferredName,
      '迁移类型': type,
      '主石材质': mainStoneName,
      '主石材质ID': mainStoneId,
      '镶材/组件': settingName,
      '镶材/组件ID': settingId,
      '修正说明': fixNote,
    });
  }

  // ── 人工修正覆盖（用户审核确认的异常数据） ──
  const manualOverrides = new Map<number, { type?: string; mainStone?: number; skip?: boolean }>([
    // #11205 K白金梅花 — 纯K白金制品，不迁移
    [11205, { skip: true }],
    // #11226 K白金福在眼钱 — 主石翡翠，镶材K白金
    [11226, { mainStone: 1 }],
    // #13217 小珍珠碧玺吊坠项链 — 珍珠+碧玺混搭，组合型
    [13217, { type: 'composite' }],
  ]);

  for (const row of exportRows) {
    const override = manualOverrides.get(row['货品ID']);
    if (!override) continue;
    if (override.skip) {
      row['迁移类型'] = '不迁移';
      row['主石材质'] = '';
      row['主石材质ID'] = '';
      row['镶材/组件'] = '';
      row['镶材/组件ID'] = '';
      row['修正说明'] = '用户确认：纯K白金制品，不迁移';
      continue;
    }
    if (override.mainStone) {
      const mat = matMap.get(override.mainStone);
      row['主石材质'] = mat?.name || `id=${override.mainStone}`;
      row['主石材质ID'] = String(override.mainStone);
      row['修正说明'] = '用户确认：主石为翡翠';
    }
    if (override.type === 'composite') {
      row['迁移类型'] = '组合型';
      row['镶材/组件'] = '';
      row['镶材/组件ID'] = '';
      // 用推断材质名作为主组件
      const mat = matMap.get(30); // 碧玺
      row['主石材质'] = mat?.name || '碧玺';
      row['主石材质ID'] = '30';
      row['修正说明'] = '用户确认：珍珠+碧玺混搭，组合型';
    }
  }

  // 输出组合型明细
  console.log('\n=== 组合型明细 ===');

  // 创建 Excel
  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.json_to_sheet(exportRows);
  outWs['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 32 },
    { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(outWb, outWs, '迁移审核');

  const outPath = 'C:\\Users\\1\\Desktop\\玉器店经营\\adr020-migration-review-v4.xlsx';
  XLSX.writeFile(outWb, outPath);

  // 统计
  const inlay = exportRows.filter(r => r['迁移类型'] === '镶嵌型').length;
  const composite = exportRows.filter(r => r['迁移类型'] === '组合型').length;
  const autoFixed = exportRows.filter(r => r['修正说明'] && !r['修正说明'].includes('⚠️')).length;
  const needManual = exportRows.filter(r => r['修正说明'] && r['修正说明'].includes('⚠️')).length;

  console.log(`✅ 已导出迁移审核 Excel: ${outPath}`);
  console.log(`   共 ${exportRows.length} 条记录`);
  console.log(`   镶嵌型: ${inlay} | 组合型: ${composite}`);
  console.log(`   主石自动修正（贵金属→翡翠）: ${autoFixed} 条`);
  console.log(`   需人工确认: ${needManual} 条`);

  // 主石材质分布
  const mainStoneStats = new Map<string, number>();
  exportRows.filter(r => r['主石材质']).forEach(r => {
    const k = r['主石材质'];
    mainStoneStats.set(k, (mainStoneStats.get(k) || 0) + 1);
  });
  console.log('\n=== 主石材质分布 ===');
  [...mainStoneStats.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} 条`);
  });

  // ─── 执行写入（--write 模式） ─────────────────────
  const isWrite = process.argv.includes('--write');
  if (isWrite) {
    console.log('\n🟢 开始执行数据库迁移...');
    let updated = 0;
    let created = 0;
    let errors = 0;

    for (const row of exportRows) {
      const itemId = row['货品ID'];
      const type = row['迁移类型'];
      const msId = row['主石材质ID'] ? parseInt(row['主石材质ID']) : null;
      const settingId = row['镶材/组件ID'] ? parseInt(row['镶材/组件ID']) : null;

      if (type === '不迁移') {
        console.log(`  ⏭️  跳过 #${itemId} ${row['货品名称']}`);
        continue;
      }

      try {
        // 更新货品
        const updateData: any = {};
        if (type === '镶嵌型') {
          updateData.compositeType = 'inlay';
          if (msId) updateData.materialId = msId;
        } else if (type === '组合型') {
          updateData.compositeType = 'composite';
          if (msId) updateData.materialId = msId;
        }

        // 追加 notes 标记
        const existing = await prisma.item.findUnique({ where: { id: itemId }, select: { notes: true } });
        const tag = type === '镶嵌型' ? '镶嵌' : '组合';
        const tagStr = `[ADR-020:${tag}]`;
        const existingNotes = existing?.notes || '';
        if (!existingNotes.includes(tagStr)) {
          updateData.notes = `${existingNotes} ${tagStr}`.trim();
        }

        await prisma.item.update({ where: { id: itemId }, data: updateData });
        updated++;

        // 先删除已有材质组件（防止重复执行）
        await prisma.itemMaterialComponent.deleteMany({ where: { itemId } });

        // 创建材质组件
        if (type === '镶嵌型' && msId && settingId) {
          await prisma.itemMaterialComponent.create({
            data: { itemId, materialId: msId, role: 'main_stone', sortOrder: 0 },
          });
          await prisma.itemMaterialComponent.create({
            data: { itemId, materialId: settingId, role: 'setting_material', sortOrder: 1 },
          });
          created += 2;
        } else if (type === '组合型' && msId) {
          await prisma.itemMaterialComponent.create({
            data: { itemId, materialId: msId, role: 'component', sortOrder: 0 },
          });
          // #13217 小珍珠碧玺吊坠项链：增加珍珠组件
          if (itemId === 13217) {
            await prisma.itemMaterialComponent.create({
              data: { itemId, materialId: 8, role: 'component', sortOrder: 1, notes: '珍珠' },
            });
            created++;
          }
          created++;
        }
      } catch (e: any) {
        console.error(`  ❌ 写入失败 #${itemId} ${row['货品名称']}: ${e.message}`);
        errors++;
      }
    }

    console.log(`\n✅ 迁移完成:`);
    console.log(`   更新货品: ${updated} 条`);
    console.log(`   创建组件: ${created} 条`);
    console.log(`   失败: ${errors} 条`);
  } else {
    console.log('\n🟡 Dry-run 模式，仅导出 Excel。执行 --write 写入数据库');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
