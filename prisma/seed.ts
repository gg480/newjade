import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始种子数据...');

  // 1. 系统配置
  const configs = [
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
  console.log('✅ 系统配置已插入/更新 (6条)');

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
  ];
  for (const m of materials) {
    await prisma.dictMaterial.upsert({
      where: { name: m.name },
      update: { category: m.category },
      create: m,
    });
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
  ];
  for (const t of types) {
    await prisma.dictType.upsert({
      where: { name: t.name },
      update: { specFields: t.specFields },
      create: t,
    });
  }
  console.log('✅ 器型已插入/更新 (9种, 新格式)');

  // 4. 标签 (20个, 4组)
  const tags = [
    // 种水
    { name: '玻璃种', groupName: '种水' },
    { name: '冰种', groupName: '种水' },
    { name: '糯冰种', groupName: '种水' },
    { name: '糯种', groupName: '种水' },
    { name: '豆种', groupName: '种水' },
    // 颜色
    { name: '满绿', groupName: '颜色' },
    { name: '飘花', groupName: '颜色' },
    { name: '紫罗兰', groupName: '颜色' },
    { name: '黄翡', groupName: '颜色' },
    { name: '墨翠', groupName: '颜色' },
    { name: '无色', groupName: '颜色' },
    // 工艺
    { name: '手工雕', groupName: '工艺' },
    { name: '机雕', groupName: '工艺' },
    { name: '素面', groupName: '工艺' },
    // 题材
    { name: '观音', groupName: '题材' },
    { name: '佛公', groupName: '题材' },
    { name: '平安扣', groupName: '题材' },
    { name: '如意', groupName: '题材' },
    { name: '山水', groupName: '题材' },
    { name: '花鸟', groupName: '题材' },
  ];
  for (const t of tags) {
    await prisma.dictTag.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }
  console.log('✅ 标签已插入 (20个, 4组)');

  // 5. 初始贵金属市价
  const silver = await prisma.dictMaterial.findUnique({ where: { name: '银' } });
  const gold18k = await prisma.dictMaterial.findUnique({ where: { name: '18K金' } });
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

  // 6. 示例供应商
  const supplier1 = await prisma.supplier.create({ data: { name: '云南瑞丽翡翠行', contact: '张经理 13800001111', notes: '长期合作，主供翡翠' } });
  const supplier2 = await prisma.supplier.create({ data: { name: '广州华林银饰批发', contact: '李总 13900002222', notes: '银饰批发' } });
  const supplier3 = await prisma.supplier.create({ data: { name: '东海水晶城', contact: '王姐 13700003333', notes: '水晶手串类' } });
  console.log('✅ 示例供应商已插入 (3条)');

  // 7. 示例批次 — 创建3个批次
  const jadeMat = await prisma.dictMaterial.findUnique({ where: { name: '翡翠' } });
  const hetianMat = await prisma.dictMaterial.findUnique({ where: { name: '和田玉' } });
  const pinkCrystalMat = await prisma.dictMaterial.findUnique({ where: { name: '粉晶' } });
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

  // 8. 创建货品 — 部分关联批次，部分独立高货
  const itemsData: any[] = [];

  // Batch 1 items (翡翠手镯, 3/5 entered)
  if (batch1 && jadeMat) {
    itemsData.push(
      { skuCode: 'FC-20260101-001-01', name: '冰种飘花手镯', batchId: batch1.id, batchCode: batch1.batchCode, materialId: jadeMat.id, typeId: braceletType?.id || null, costPrice: 10000, allocatedCost: null, sellingPrice: 18000, counter: 1, purchaseDate: '2026-01-15', status: 'in_stock' },
      { skuCode: 'FC-20260101-001-02', name: '冰种满绿手镯', batchId: batch1.id, batchCode: batch1.batchCode, materialId: jadeMat.id, typeId: braceletType?.id || null, costPrice: 10000, allocatedCost: null, sellingPrice: 22000, counter: 1, purchaseDate: '2026-01-15', status: 'in_stock' },
      { skuCode: 'FC-20260101-001-03', name: '糯冰种紫罗兰手镯', batchId: batch1.id, batchCode: batch1.batchCode, materialId: jadeMat.id, typeId: braceletType?.id || null, costPrice: 10000, allocatedCost: null, sellingPrice: 15000, counter: 2, purchaseDate: '2026-01-15', status: 'in_stock' },
    );
  }

  // Batch 2 items (和田玉吊坠, 2/3 entered)
  if (batch2 && hetianMat) {
    itemsData.push(
      { skuCode: 'HTY-20260201-001-01', name: '和田玉籽料观音吊坠', batchId: batch2.id, batchCode: batch2.batchCode, materialId: hetianMat.id, typeId: pendantType?.id || null, costPrice: 6000, allocatedCost: null, sellingPrice: 12000, counter: 1, purchaseDate: '2026-02-10', status: 'in_stock' },
      { skuCode: 'HTY-20260201-001-02', name: '和田玉平安扣吊坠', batchId: batch2.id, batchCode: batch2.batchCode, materialId: hetianMat.id, typeId: pendantType?.id || null, costPrice: 6000, allocatedCost: null, sellingPrice: 9800, counter: 3, purchaseDate: '2026-02-10', status: 'in_stock' },
    );
  }

  // Batch 3 items (粉晶手串, 5/10 entered)
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

  // Independent high-value items (no batch)
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
  if (gold18k) {
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

  // 10. 示例销售记录 — 一些批次中的货品已售出
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

  console.log('🎉 种子数据完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
