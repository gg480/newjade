import { PrismaClient } from '@prisma/client';

async function main() {
  process.env.DATABASE_URL = 'file:./db/custom.db';
  const p = new PrismaClient();

  try {
    const r = await p.promotion.findMany({ take: 1 });
    console.log('promotion OK:', r.length);
  } catch (e: any) {
    console.log('promotion ERROR:', JSON.stringify({code: e.code, message: e.message, meta: e.meta}));
  }

  try {
    const r = await p.stocktaking.findMany({ take: 1 });
    console.log('stocktaking OK:', r.length);
  } catch (e: any) {
    console.log('stocktaking ERROR:', JSON.stringify({code: e.code, message: e.message}));
  }

  try {
    const r = await p.customerSegment.findMany({ take: 1 });
    console.log('customerSegment OK:', r.length);
  } catch (e: any) {
    console.log('customerSegment ERROR:', JSON.stringify({code: e.code, message: e.message}));
  }

  try {
    const r = await p.seasonalFactor.findMany({ take: 1 });
    console.log('seasonalFactor OK:', r.length);
  } catch (e: any) {
    console.log('seasonalFactor ERROR:', JSON.stringify({code: e.code, message: e.message}));
  }

  await p.$disconnect();
}

main().catch(e => console.error('FATAL:', e));
