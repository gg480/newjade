import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 基础种子数据 — 生产环境必需
 * 包含：系统配置、材质字典、器型字典、标签字典、初始贵金属市价
 * 不包含：供应商、批次、货品、客户、销售记录等业务测试数据
 */
async function main() {
  console.log('🌱 初始化基础配置数据...');

  // 1. 系统配置
  const configs = [
    { key: 'store_name', value: '翡翠珠宝', description: '店铺名称' },
    { key: 'operating_cost_rate', value: '0.05', description: '经营成本率' },
    { key: 'markup_rate', value: '0.30', description: '零售价上浮比例' },
    { key: 'aging_threshold_days', value: '90', description: '压货预警天数(旧)' },
    { key: 'warning_days', value: '90', description: '压货预警天数' },
    { key: 'default_alloc_method', value: 'equal', description: '默认分摊算法' },
    { key: 'admin_password', value: 'admin123', description: '管理员登录密码' },
  ];
  for (const c of configs) {
    await prisma.sysConfig.upsert({
      where: { key: c.key },
      update: { value: c.value, description: c.description },
      create: c,
    });
  }
  console.log('✅ 系统配置已插入/更新 (7条)');

  // 2. 材质 (36种) — 含 category 大类
  const materials = [
    { name: '黄金', category: '贵金属', subType: 'k999', sortOrder: 1 },
    { name: '银', category: '贵金属', subType: '990', costPerGram: 25, sortOrder: 2 },
    { name: 'k铂金', category: '贵金属', sortOrder: 3 },
    { name: '铂金', category: '贵金属', sortOrder: 4 },
    { name: '18K金', category: '贵金属', costPerGram: 780, sortOrder: 5 },
    { name: '翡翠', category: '玉', origin: '缅甸', sortOrder: 6 },
    { name: '和田玉', category: '玉', sortOrder: 7 },
    { name: '珍珠', category: '其他', subType: '淡水珠', origin: '浙江', sortOrder: 8 },
    { name: '朱砂', category: '文玩', sortOrder: 9 },
    { name: '蜜蜡', category: '文玩', sortOrder: 10 },
    { name: '碧玺', category: '水晶', sortOrder: 11 },
    { name: '青金石', category: '水晶', sortOrder: 12 },
    { name: '黑曜石', category: '水晶', sortOrder: 13 },
    { name: '金曜石', category: '水晶', sortOrder: 14 },
    { name: '玛瑙', category: '水晶', sortOrder: 15 },
    { name: '琥珀', category: '文玩', sortOrder: 16 },
    { name: '锆石', category: '其他', origin: '梧州', sortOrder: 17 },
    { name: '斑彩螺', category: '其他', origin: '意大利', sortOrder: 18 },
    { name: '金虎眼', category: '水晶', sortOrder: 19 },
    { name: '虎眼', category: '水晶', sortOrder: 20 },
    { name: '粉晶', category: '水晶', sortOrder: 21 },
    { name: '紫水晶', category: '水晶', sortOrder: 22 },
    { name: '莹石', category: '水晶', sortOrder: 23 },
    { name: '绿幽灵', category: '水晶', sortOrder: 24 },
    { name: '白幽灵', category: '水晶', sortOrder: 25 },
    { name: '彩幽灵', category: '水晶', sortOrder: 26 },
    { name: '金发晶', category: '水晶', sortOrder: 27 },
    { name: '钛晶', category: '水晶', sortOrder: 28 },
    { name: '巴西黄水晶', category: '水晶', sortOrder: 29 },
    { name: '人工黄水晶', category: '水晶', sortOrder: 30 },
    { name: '红幽灵', category: '水晶', sortOrder: 31 },
    { name: '蓝晶石', category: '水晶', sortOrder: 32 },
    { name: '海蓝宝', category: '水晶', sortOrder: 33 },
    { name: '天河石', category: '水晶', sortOrder: 34 },
    { name: '红绿宝石共生', category: '水晶', sortOrder: 35 },
    { name: '车花透辉石', category: '水晶', sortOrder: 36 },
    { name: '未分类', category: '其他', sortOrder: 99 },
  ];
  for (const m of materials) {
    const existing = await prisma.dictMaterial.findFirst({
      where: { name: m.name, subType: m.subType ?? null },
    });
    if (existing) {
      await prisma.dictMaterial.update({
        where: { id: existing.id },
        data: { category: m.category },
      });
    } else {
      await prisma.dictMaterial.create({ data: m });
    }
  }
  console.log('✅ 材质已插入/更新 (36种, 含大类)');

  // 3. 器型 (9种) — 新 specFields 格式
  const types = [
    { name: '手镯', specFields: JSON.stringify({ weight: { required: false }, braceletSize: { required: true } }), sortOrder: 1 },
    { name: '挂件', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 2 },
    { name: '吊坠', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 3 },
    { name: '手串/手链', specFields: JSON.stringify({ weight: { required: false }, beadCount: { required: false }, beadDiameter: { required: true } }), sortOrder: 4 },
    { name: '项链', specFields: JSON.stringify({ weight: { required: false }, beadDiameter: { required: true } }), sortOrder: 5 },
    { name: '脚链', specFields: JSON.stringify({ weight: { required: false }, beadCount: { required: false }, beadDiameter: { required: false } }), sortOrder: 6 },
    { name: '戒指', specFields: JSON.stringify({ weight: { required: false }, metalWeight: { required: false }, ringSize: { required: true } }), sortOrder: 7 },
    { name: '耳饰', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 8 },
    { name: '摆件', specFields: JSON.stringify({ weight: { required: false }, size: { required: false } }), sortOrder: 9 },
    { name: '未分类', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 99 },
  ];
  for (const t of types) {
    await prisma.dictType.upsert({
      where: { name: t.name },
      update: { specFields: t.specFields },
      create: t,
    });
  }
  console.log('✅ 器型已插入/更新 (9种, 新格式)');

  // 4. 标签 — 按材质大类分组，涵盖全部5大品类
  // isGlobal=true 标签：所有材质通用
  const globalTags = [
    { name: '热卖', groupName: '通用', isGlobal: true },
    { name: '新品', groupName: '通用', isGlobal: true },
    { name: '推荐', groupName: '通用', isGlobal: true },
    { name: '促销', groupName: '通用', isGlobal: true },
    { name: '滞销品', groupName: '通用', isGlobal: true },
  ];

  // 翡翠（玉）专用标签
  const jadeTags = [
    { name: '玻璃种', groupName: '种水' },
    { name: '冰种', groupName: '种水' },
    { name: '糯冰种', groupName: '种水' },
    { name: '糯种', groupName: '种水' },
    { name: '豆种', groupName: '种水' },
    { name: '满绿', groupName: '颜色' },
    { name: '飘花', groupName: '颜色' },
    { name: '紫罗兰', groupName: '颜色' },
    { name: '黄翡', groupName: '颜色' },
    { name: '墨翠', groupName: '颜色' },
    { name: '无色', groupName: '颜色' },
    { name: '阳绿', groupName: '颜色' },
    { name: '帝王绿', groupName: '颜色' },
    { name: '手工雕', groupName: '工艺' },
    { name: '机雕', groupName: '工艺' },
    { name: '素面', groupName: '工艺' },
    { name: '观音', groupName: '题材' },
    { name: '佛公', groupName: '题材' },
    { name: '平安扣', groupName: '题材' },
    { name: '如意', groupName: '题材' },
    { name: '山水', groupName: '题材' },
    { name: '花鸟', groupName: '题材' },
    { name: '貔貅', groupName: '题材' },
    { name: '福豆', groupName: '题材' },
    { name: '葫芦', groupName: '题材' },
    { name: '树叶', groupName: '题材' },
  ];

  // 贵金属专用标签
  const metalTags = [
    { name: '足金', groupName: '品类' },
    { name: 'K金', groupName: '品类' },
    { name: '铂金', groupName: '品类' },
    { name: '白银', groupName: '品类' },
    { name: '抛光', groupName: '工艺' },
    { name: '磨砂', groupName: '工艺' },
    { name: '拉丝', groupName: '工艺' },
    { name: '花丝', groupName: '工艺' },
    { name: '镶嵌', groupName: '工艺' },
    { name: '珐琅', groupName: '工艺' },
    { name: '微镶', groupName: '工艺' },
    { name: '镂空', groupName: '工艺' },
    { name: '足金999', groupName: '成色' },
    { name: '18K金', groupName: '成色' },
    { name: 'Pt950', groupName: '成色' },
  ];

  // 水晶专用标签
  const crystalTags = [
    { name: '全净体', groupName: '晶底' },
    { name: '微棉', groupName: '晶底' },
    { name: '冰裂', groupName: '晶底' },
    { name: '共生矿', groupName: '晶底' },
    { name: '浓郁色', groupName: '色泽' },
    { name: '淡色', groupName: '色泽' },
    { name: '发丝明显', groupName: '色泽' },
    { name: '猫眼效应', groupName: '特殊光学' },
    { name: '星光效应', groupName: '特殊光学' },
    { name: '彩虹光', groupName: '特殊光学' },
  ];

  // 文玩专用标签
  const wenwanTags = [
    { name: '满肉', groupName: '质地' },
    { name: '风化纹', groupName: '质地' },
    { name: '玉化', groupName: '质地' },
    { name: '鸡油黄', groupName: '色泽' },
    { name: '白花', groupName: '色泽' },
    { name: '柠檬黄', groupName: '色泽' },
    { name: '老蜡', groupName: '成色' },
  ];

  // 其他类材质标签
  const otherTags = [
    { name: '淡水', groupName: '产地' },
    { name: '海水', groupName: '产地' },
    { name: '天然', groupName: '属性' },
    { name: '人工合成', groupName: '属性' },
  ];

  const allTags = [
    ...globalTags,
    ...jadeTags.map(t => ({ ...t, isGlobal: false })),
    ...metalTags.map(t => ({ ...t, isGlobal: false })),
    ...crystalTags.map(t => ({ ...t, isGlobal: false })),
    ...wenwanTags.map(t => ({ ...t, isGlobal: false })),
    ...otherTags.map(t => ({ ...t, isGlobal: false })),
  ];

  for (const t of allTags) {
    await prisma.dictTag.upsert({
      where: { name: t.name },
      update: { groupName: t.groupName, isGlobal: t.isGlobal },
      create: { name: t.name, groupName: t.groupName, isGlobal: t.isGlobal },
    });
  }
  console.log(`✅ 标签已插入/更新 (${allTags.length}个, 含5大类+通用)`);

  // 4b. 建立标签-材质关联
  const allMaterials = await prisma.dictMaterial.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true },
  });

  const categoryMatIds: Record<string, number[]> = {};
  for (const m of allMaterials) {
    const cat = m.category || '其他';
    if (!categoryMatIds[cat]) categoryMatIds[cat] = [];
    categoryMatIds[cat].push(m.id);
  }

  const tagCache = new Map<string, number>();
  const allDbTags = await prisma.dictTag.findMany({ select: { id: true, name: true } });
  for (const t of allDbTags) tagCache.set(t.name, t.id);

  await prisma.dictTagMaterial.deleteMany();

  const associations: { tagId: number; materialId: number }[] = [];
  const matIds = {
    jade: categoryMatIds['玉'] || [],
    metal: categoryMatIds['贵金属'] || [],
    crystal: categoryMatIds['水晶'] || [],
    wenwan: categoryMatIds['文玩'] || [],
    other: categoryMatIds['其他'] || [],
  };

  for (const t of jadeTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.jade) associations.push({ tagId, materialId: mid });
  }
  for (const t of metalTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.metal) associations.push({ tagId, materialId: mid });
  }
  for (const t of crystalTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.crystal) associations.push({ tagId, materialId: mid });
  }
  for (const t of wenwanTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.wenwan) associations.push({ tagId, materialId: mid });
  }
  for (const t of otherTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.other) associations.push({ tagId, materialId: mid });
  }

  if (associations.length > 0) {
    await prisma.dictTagMaterial.createMany({
      data: associations,
    });
  }
  console.log(`✅ 标签-材质关联已建立 (${associations.length}条)`);

  // 5. 初始贵金属市价
  const silver = await prisma.dictMaterial.findFirst({ where: { name: '银' } });
  const gold18k = await prisma.dictMaterial.findFirst({ where: { name: '18K金' } });
  const today = new Date().toISOString().split('T')[0];

  if (silver) {
    await prisma.metalPrice.create({
      data: { materialId: silver.id, pricePerGram: 25, effectiveDate: today },
    });
  }
  if (gold18k) {
    await prisma.metalPrice.create({
      data: { materialId: gold18k.id, pricePerGram: 780, effectiveDate: today },
    });
  }
  console.log('✅ 贵金属初始市价已插入 (2条)');

  console.log('🎉 基础配置数据初始化完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
