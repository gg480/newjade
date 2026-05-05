const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const tags = await prisma.dictTag.findMany({ 
      where: { id: { in: [1, 3] } }, 
      include: { tagMaterials: true }
    });
    console.log('Tags:', JSON.stringify(tags, null, 2));
    
    const material = await prisma.dictMaterial.findUnique({ where: { id: 6 } });
    console.log('Material:', JSON.stringify(material, null, 2));
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e);
    await prisma.$disconnect();
  }
}

test();