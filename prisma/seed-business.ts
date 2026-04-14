import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get material IDs
  const gold = await prisma.dictMaterial.findFirst({ where: { name: '黄金' } });
  const silver = await prisma.dictMaterial.findFirst({ where: { name: '银' } });
  const k18 = await prisma.dictMaterial.findFirst({ where: { name: '18K金' } });
  const jadeite = await prisma.dictMaterial.findFirst({ where: { name: '翡翠' } });
  const hetian = await prisma.dictMaterial.findFirst({ where: { name: '和田玉' } });

  // Get type IDs
  const bracelet = await prisma.dictType.findFirst({ where: { name: '手镯' } });
  const pendant = await prisma.dictType.findFirst({ where: { name: '挂件' } });
  const necklace = await prisma.dictType.findFirst({ where: { name: '项链' } });
  const ring = await prisma.dictType.findFirst({ where: { name: '戒指' } });
  const beads = await prisma.dictType.findFirst({ where: { name: '手串/手链' } });
  const ornament = await prisma.dictType.findFirst({ where: { name: '摆件' } });

  // Get supplier IDs
  const suppliers = await prisma.supplier.findMany();
  const s1 = suppliers[0], s2 = suppliers[1], s3 = suppliers[2];

  // Create 20 items
  const items = [];
  for (let i = 1; i <= 20; i++) {
    const mat = [gold, silver, k18, jadeite, hetian][i % 5]!;
    const typ = [bracelet, pendant, necklace, ring, beads, ornament][i % 6]!;
    const cost = Math.round((1000 + Math.random() * 9000) * 100) / 100;
    const price = Math.round(cost * (1.2 + Math.random() * 0.8) * 100) / 100;
    const counter = (i % 5) + 1;
    const daysAgo = Math.floor(Math.random() * 200);
    const purchaseDate = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

    const item = await prisma.item.create({
      data: {
        skuCode: `JD${String(i).padStart(4, '0')}`,
        name: `${mat.name}${typ.name}#${i}`,
        materialId: mat.id,
        typeId: typ.id,
        costPrice: cost,
        sellingPrice: price,
        floorPrice: Math.round(cost * 0.9 * 100) / 100,
        counter: i <= 15 ? counter : null,
        supplierId: [s1, s2, s3][i % 3]?.id,
        status: 'in_stock',
        purchaseDate,
        origin: mat.origin || '国内',
      },
    });
    items.push(item);
  }
  console.log(`✅ ${items.length} items created`);

  // Create 5 sales
  for (let i = 0; i < 5; i++) {
    const item = items[i];
    const saleDate = new Date(Date.now() - (30 + i * 15) * 86400000).toISOString().slice(0, 10);
    await prisma.saleRecord.create({
      data: {
        saleNo: `s${saleDate.replace(/-/g, '')}${String(i + 1).padStart(3, '0')}`,
        itemId: item.id,
        actualPrice: item.sellingPrice * (0.9 + Math.random() * 0.1),
        channel: i % 2 === 0 ? 'store' : 'wechat',
        saleDate,
      },
    });
    await prisma.item.update({ where: { id: item.id }, data: { status: 'sold' } });
  }
  console.log('✅ 5 sales created');

  // Create 3 batches
  const batchMat = [silver, k18, jadeite];
  const batchType = [necklace, ring, bracelet];
  for (let i = 0; i < 3; i++) {
    const totalCost = Math.round((5000 + Math.random() * 15000) * 100) / 100;
    const qty = 5 + i;
    await prisma.batch.create({
      data: {
        batchCode: `B2026${String(i + 1).padStart(3, '0')}`,
        materialId: batchMat[i].id,
        typeId: batchType[i].id,
        quantity: qty,
        totalCost,
        costAllocMethod: ['equal', 'by_weight', 'by_price'][i],
        supplierId: [s1, s2, s3][i]?.id,
        purchaseDate: new Date(Date.now() - (60 + i * 30) * 86400000).toISOString().slice(0, 10),
      },
    });
  }
  console.log('✅ 3 batches created');

  // Create 3 customers
  const customers = [
    { customerCode: 'C001', name: '张女士', phone: '138****1234', wechat: 'zhang_nn' },
    { customerCode: 'C002', name: '李先生', phone: '139****5678', wechat: 'li_xiansheng' },
    { customerCode: 'C003', name: '王太太', phone: '137****9012' },
  ];
  for (const c of customers) {
    await prisma.customer.create({ data: c });
  }
  console.log('✅ 3 customers created');

  console.log('🎉 Business seed data complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
