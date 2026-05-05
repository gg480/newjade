import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * 种子数据入口 — 根据环境自动选择：
 * - NODE_ENV=production → 仅初始化基础配置（材质/器型/标签/系统配置/贵金属市价）
 * - NODE_ENV=development 或未设置 → 初始化基础配置 + 演示数据（供应商/批次/货品/客户/销售记录）
 */
async function seedBase() {
  console.log('🌱 初始化基础配置数据...');

  // 1. 系统配置
  const configs = [
    { key: 'operating_cost_rate', value: '0.05', description: '经营成本率' },
    { key: 'markup_rate', value: '0.30', description: '零售价上浮比例' },
    { key: 'aging_threshold_days', value: '90', description: '压货预警天数(旧)' },
    { key: 'warning_days', value: '90', description: '压货预警天数' },
    { key: 'default_alloc_method', value: 'equal', description: '默认分摊算法' },
  ];
  for (const c of configs) {
    await prisma.sysConfig.upsert({
      where: { key: c.key },
      update: { value: c.value, description: c.description },
      create: c,
    });
  }
  console.log('✅ 系统配置已插入/更新 (5条)');

  // 管理员用户 — bcrypt 哈希存储默认密码
  const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: { username: 'admin', passwordHash: defaultPasswordHash, mustChangePwd: false },
    update: { passwordHash: defaultPasswordHash },
  });
  console.log('✅ 管理员用户已创建');

  // 2. 材质 (36种)
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

  // 3. 器型 (9种)
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

  // 按 category 分组 materialIds
  const categoryMatIds: Record<string, number[]> = {};
  for (const m of allMaterials) {
    const cat = m.category || '其他';
    if (!categoryMatIds[cat]) categoryMatIds[cat] = [];
    categoryMatIds[cat].push(m.id);
  }

  // 构建标签名→id 缓存
  const tagCache = new Map<string, number>();
  const allDbTags = await prisma.dictTag.findMany({ select: { id: true, name: true } });
  for (const t of allDbTags) tagCache.set(t.name, t.id);

  // 清空旧关联并重建
  await prisma.dictTagMaterial.deleteMany();

  const associations: { tagId: number; materialId: number }[] = [];
  const matIds = {
    jade: categoryMatIds['玉'] || [],
    metal: categoryMatIds['贵金属'] || [],
    crystal: categoryMatIds['水晶'] || [],
    wenwan: categoryMatIds['文玩'] || [],
    other: categoryMatIds['其他'] || [],
  };

  // 翡翠标签 → 所有玉类材质
  for (const t of jadeTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.jade) associations.push({ tagId, materialId: mid });
  }
  // 贵金属标签 → 所有贵金属材质
  for (const t of metalTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.metal) associations.push({ tagId, materialId: mid });
  }
  // 水晶标签 → 所有水晶材质
  for (const t of crystalTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.crystal) associations.push({ tagId, materialId: mid });
  }
  // 文玩标签 → 所有文玩材质
  for (const t of wenwanTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.wenwan) associations.push({ tagId, materialId: mid });
  }
  // 其他标签 → 其他类材质
  for (const t of otherTags) {
    const tagId = tagCache.get(t.name);
    if (tagId) for (const mid of matIds.other) associations.push({ tagId, materialId: mid });
  }

  if (associations.length > 0) {
    await prisma.dictTagMaterial.createMany({
      data: associations,
    });
  }
  console.log(`✅ 标签-材质关联已建立 (${associations.length}条: 玉${matIds.jade.length}材x${jadeTags.length}标 + 贵金属${matIds.metal.length}x${metalTags.length} + 水晶${matIds.crystal.length}x${crystalTags.length} + 文玩${matIds.wenwan.length}x${wenwanTags.length} + 其他${matIds.other.length}x${otherTags.length})`);

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
}

async function seedDemo() {
  console.log('🌱 初始化演示数据 (仅开发环境)...');

  // 6. 示例供应商
  const supplier1 = await prisma.supplier.create({ data: { name: '云南瑞丽翡翠行', contact: '张经理 13800001111', notes: '长期合作，主供翡翠' } });
  const supplier2 = await prisma.supplier.create({ data: { name: '广州华林银饰批发', contact: '李总 13900002222', notes: '银饰批发' } });
  const supplier3 = await prisma.supplier.create({ data: { name: '东海水晶城', contact: '王姐 13700003333', notes: '水晶手串类' } });
  console.log('✅ 示例供应商已插入 (3条)');

  // 7. 示例批次
  const jadeMat = await prisma.dictMaterial.findFirst({ where: { name: '翡翠' } });
  const hetianMat = await prisma.dictMaterial.findFirst({ where: { name: '和田玉' } });
  const pinkCrystalMat = await prisma.dictMaterial.findFirst({ where: { name: '粉晶' } });
  const braceletType = await prisma.dictType.findUnique({ where: { name: '手镯' } });
  const pendantType = await prisma.dictType.findUnique({ where: { name: '吊坠' } });
  const braceletStrandType = await prisma.dictType.findUnique({ where: { name: '手串/手链' } });

  const batch1 = jadeMat ? await prisma.batch.upsert({
    where: { batchCode: 'FC-20260101-001' },
    update: {},
    create: {
      batchCode: 'FC-20260101-001',
      materialId: jadeMat.id,
      typeId: braceletType?.id || null,
      quantity: 5,
      totalCost: 50000,
      costAllocMethod: 'equal',
      supplierId: supplier1.id,
      purchaseDate: '2026-01-15',
      notes: '冰种翡翠手镯，缅甸料',
    },
  }) : null;

  const batch2 = hetianMat ? await prisma.batch.upsert({
    where: { batchCode: 'HTY-20260201-001' },
    update: {},
    create: {
      batchCode: 'HTY-20260201-001',
      materialId: hetianMat.id,
      typeId: pendantType?.id || null,
      quantity: 3,
      totalCost: 18000,
      costAllocMethod: 'equal',
      supplierId: supplier1.id,
      purchaseDate: '2026-02-10',
      notes: '和田玉籽料吊坠',
    },
  }) : null;

  const batch3 = pinkCrystalMat ? await prisma.batch.upsert({
    where: { batchCode: 'FJ-20260301-001' },
    update: {},
    create: {
      batchCode: 'FJ-20260301-001',
      materialId: pinkCrystalMat.id,
      typeId: braceletStrandType?.id || null,
      quantity: 10,
      totalCost: 5000,
      costAllocMethod: 'equal',
      supplierId: supplier3.id,
      purchaseDate: '2026-03-05',
      notes: '粉晶手串，莫桑比克料',
    },
  }) : null;

  console.log('✅ 示例批次已插入 (3条)');

  // 8. 创建货品
  const itemsData: any[] = [];

  if (batch1 && jadeMat) {
    itemsData.push(
      { skuCode: 'FC-20260101-001-01', name: '冰种飘花手镯', batchId: batch1.id, batchCode: batch1.batchCode, materialId: jadeMat.id, typeId: braceletType?.id || null, costPrice: 10000, allocatedCost: null, sellingPrice: 18000, counter: 1, purchaseDate: '2026-01-15', status: 'in_stock' },
      { skuCode: 'FC-20260101-001-02', name: '冰种满绿手镯', batchId: batch1.id, batchCode: batch1.batchCode, materialId: jadeMat.id, typeId: braceletType?.id || null, costPrice: 10000, allocatedCost: null, sellingPrice: 22000, counter: 1, purchaseDate: '2026-01-15', status: 'in_stock' },
      { skuCode: 'FC-20260101-001-03', name: '糯冰种紫罗兰手镯', batchId: batch1.id, batchCode: batch1.batchCode, materialId: jadeMat.id, typeId: braceletType?.id || null, costPrice: 10000, allocatedCost: null, sellingPrice: 15000, counter: 2, purchaseDate: '2026-01-15', status: 'in_stock' },
    );
  }

  if (batch2 && hetianMat) {
    itemsData.push(
      { skuCode: 'HTY-20260201-001-01', name: '和田玉籽料观音吊坠', batchId: batch2.id, batchCode: batch2.batchCode, materialId: hetianMat.id, typeId: pendantType?.id || null, costPrice: 6000, allocatedCost: null, sellingPrice: 12000, counter: 1, purchaseDate: '2026-02-10', status: 'in_stock' },
      { skuCode: 'HTY-20260201-001-02', name: '和田玉平安扣吊坠', batchId: batch2.id, batchCode: batch2.batchCode, materialId: hetianMat.id, typeId: pendantType?.id || null, costPrice: 6000, allocatedCost: null, sellingPrice: 9800, counter: 3, purchaseDate: '2026-02-10', status: 'in_stock' },
    );
  }

  if (batch3 && pinkCrystalMat) {
    for (let i = 1; i <= 5; i++) {
      itemsData.push({
        skuCode: `FJ-20260301-001-${String(i).padStart(2, '0')}`,
        name: `粉晶手串 #${i}`,
        batchId: batch3.id,
        batchCode: batch3.batchCode,
        materialId: pinkCrystalMat.id,
        typeId: braceletStrandType?.id || null,
        costPrice: 500,
        allocatedCost: null,
        sellingPrice: 880 + i * 20,
        counter: 2,
        purchaseDate: '2026-03-05',
        status: 'in_stock' as string,
      });
    }
  }

  if (jadeMat) {
    itemsData.push(
      { skuCode: 'HV-20260101-001', name: '帝王绿翡翠挂件', materialId: jadeMat.id, typeId: pendantType?.id || null, costPrice: 80000, sellingPrice: 150000, counter: 1, purchaseDate: '2025-12-20', status: 'in_stock', origin: '缅甸', certNo: 'NGTC-2026-001' },
      { skuCode: 'HV-20260101-002', name: '老坑冰种翡翠手镯', materialId: jadeMat.id, typeId: braceletType?.id || null, costPrice: 45000, sellingPrice: 88000, counter: 1, purchaseDate: '2025-12-25', status: 'in_stock', origin: '缅甸' },
    );
  }
  if (hetianMat) {
    itemsData.push(
      { skuCode: 'HV-20260101-003', name: '和田玉白玉佛公', materialId: hetianMat.id, typeId: pendantType?.id || null, costPrice: 25000, sellingPrice: 48000, counter: 3, purchaseDate: '2025-11-10', status: 'in_stock' },
    );
  }
  if (await prisma.dictMaterial.findFirst({ where: { name: '18K金' } })) {
    const gold18k = (await prisma.dictMaterial.findFirst({ where: { name: '18K金' } }))!;
    itemsData.push(
      { skuCode: 'GOLD-20260201-001', name: '18K金钻石戒指', materialId: gold18k.id, typeId: (await prisma.dictType.findUnique({ where: { name: '戒指' } }))?.id || null, costPrice: 12000, sellingPrice: 22000, counter: 4, purchaseDate: '2026-02-01', status: 'in_stock' },
    );
  }

  for (const itemData of itemsData) {
    await prisma.item.upsert({
      where: { skuCode: itemData.skuCode },
      update: {},
      create: itemData,
    });
  }
  console.log(`✅ 示例货品已插入 (${itemsData.length}条, 含批次关联)`);

  // 9. 示例客户
  const customer1 = await prisma.customer.upsert({ where: { customerCode: 'VIP001' }, update: {}, create: { customerCode: 'VIP001', name: '张女士', phone: '13900001001', wechat: 'zhang_vip', notes: '老客户，偏好翡翠' } });
  const customer2 = await prisma.customer.upsert({ where: { customerCode: 'VIP002' }, update: {}, create: { customerCode: 'VIP002', name: '李先生', phone: '13900001002', wechat: 'li_collector', notes: '收藏家，高端和田玉' } });
  const customer3 = await prisma.customer.upsert({ where: { customerCode: 'C003' }, update: {}, create: { customerCode: 'C003', name: '王小姐', phone: '13900001003', notes: '年轻客户，喜欢水晶' } });
  console.log('✅ 示例客户已插入/更新 (3条)');

  // 10. 示例销售记录
  const today = new Date().toISOString().split('T')[0];
  const soldItems = await prisma.item.findMany({ where: { status: 'in_stock' }, take: 3 });
  for (let i = 0; i < Math.min(soldItems.length, 3); i++) {
    const item = soldItems[i];
    await prisma.item.update({ where: { id: item.id }, data: { status: 'sold' } });
    await prisma.saleRecord.create({
      data: {
        saleNo: `SALE-2026-${String(i + 1).padStart(4, '0')}`,
        itemId: item.id,
        actualPrice: item.sellingPrice * (0.9 + Math.random() * 0.1),
        channel: i % 2 === 0 ? 'store' : 'wechat',
        saleDate: today,
        customerId: i === 0 ? customer1.id : i === 1 ? customer2.id : customer3.id,
      },
    });
  }
  console.log('✅ 示例销售记录已插入 (3条)');
}

async function main() {
  await seedBase();

  // 仅在非生产环境插入演示数据
  if (process.env.NODE_ENV !== 'production') {
    await seedDemo();
    console.log('🎉 完整种子数据（基础+演示）初始化完成！');
  } else {
    console.log('🎉 基础配置数据初始化完成！(生产环境，跳过演示数据)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
