const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const materials = await prisma.dictMaterial.findMany();
    console.log('Materials found:', materials.length);
    await prisma.$disconnect();
    console.log('Connection test successful!');
  } catch (e) {
    console.error('Error:', e);
    await prisma.$disconnect();
  }
}

testConnection();