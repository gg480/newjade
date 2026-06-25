import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // 查找所有批次（按创建时间倒序）
  const batches = await prisma.batch.findMany({ 
    orderBy: { createdAt: 'desc' },
    include: { material: true, items: true }
  });
  console.log('=== 所有批次 ===');
  for (const b of batches) {
    console.log(`ID:${b.id} | 编码:${b.batchCode} | 材质:${b.material?.name} | 数量:${b.quantity} | 总价:${b.totalCost} | 日期:${b.purchaseDate} | 备注:${b.notes}`);
    console.log(`  货品数:${b.items.length}`);
    for (const item of b.items) {
      console.log(`  - SKU:${item.skuCode} | 名称:${item.name} | 售价:${item.sellingPrice} | 状态:${item.status}`);
    }
  }
  
  // 查找铂金材质
  const ptMat = await prisma.dictMaterial.findFirst({ where: { name: { contains: '铂金' } } });
  console.log(`\n=== 铂金材质 === ID:${ptMat?.id} 名称:${ptMat?.name}`);
  
  // 搜索 BM06031
  console.log('\n=== 搜索 BM06031 ===');
  const bmBatch = await prisma.batch.findFirst({ where: { batchCode: { contains: 'BM06031' } }, include: { material: true, items: true } });
  if (bmBatch) {
    console.log('找到批次:', JSON.stringify(bmBatch, null, 2));
  } else {
    console.log('未找到 BM06031 批次');
  }
  
  // 搜索"五五"
  console.log('\n=== 搜索"五五" ===');
  const wuBatches = await prisma.batch.findMany({ where: { notes: { contains: '五五' } }, include: { material: true, items: true } });
  if (wuBatches.length > 0) {
    for (const b of wuBatches) console.log(JSON.stringify(b, null, 2));
  } else {
    console.log('未找到含"五五"的批次');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
