import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sales = await db.saleRecord.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        item: {
          select: {
            name: true,
            skuCode: true,
            material: { select: { name: true } },
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    const result = sales.map(sale => ({
      id: sale.id,
      item: sale.item ? {
        name: sale.item.name || sale.item.skuCode,
        skuCode: sale.item.skuCode,
        materialName: sale.item.material?.name || null,
      } : null,
      customerName: sale.customer?.name || '散客',
      actualPrice: sale.actualPrice,
      channel: sale.channel,
      saleDate: sale.saleDate,
      createdAt: sale.createdAt.toISOString(),
    }));

    return NextResponse.json({
      code: 0,
      data: result,
      message: 'ok',
    });
  } catch (error) {
    console.error('Recent sales API error:', error);
    return NextResponse.json({
      code: -1,
      message: '获取最近销售记录失败',
      data: [],
    });
  }
}
