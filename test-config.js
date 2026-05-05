const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConfig() {
  try {
    console.log('Testing sysConfig...');
    const configs = await prisma.sysConfig.findMany();
    console.log('Configs found:', configs.length);
    await prisma.$disconnect();
    console.log('Config test successful!');
  } catch (e) {
    console.error('Error:', e);
    await prisma.$disconnect();
  }
}

testConfig();