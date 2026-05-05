const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const items = await prisma.item.findMany({ 
      where: { status: 'in_stock' }, 
      take: 2 
    });
    console.log('Items:', JSON.stringify(items, null, 2));
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e);
    await prisma.$disconnect();
  }
}

test();