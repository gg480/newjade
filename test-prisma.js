const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPrisma() {
  try {
    console.log('Testing Prisma connection...');
    
    // Test materials
    console.log('\nTesting materials...');
    const materials = await prisma.dictMaterial.findMany();
    console.log('Materials found:', materials.length);
    
    // Test types
    console.log('\nTesting types...');
    const types = await prisma.dictType.findMany();
    console.log('Types found:', types.length);
    
    // Test items
    console.log('\nTesting items...');
    const items = await prisma.item.findMany({ take: 5 });
    console.log('Items found:', items.length);
    
    // Test sales
    console.log('\nTesting sales...');
    const sales = await prisma.saleRecord.findMany({ take: 5 });
    console.log('Sales found:', sales.length);
    
    console.log('\nAll tests passed!');
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e);
    await prisma.$disconnect();
  }
}

testPrisma();