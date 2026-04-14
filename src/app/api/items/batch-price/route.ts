import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { ids, adjustmentType, value, direction } = body as {
      ids: string[];
      adjustmentType: 'percentage' | 'fixed';
      value: number;
      direction: 'increase' | 'decrease';
    };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ code: 400, message: '请选择要调价的货品' }, { status: 400 });
    }

    if (!['percentage', 'fixed'].includes(adjustmentType)) {
      return NextResponse.json({ code: 400, message: '调整方式无效' }, { status: 400 });
    }

    if (typeof value !== 'number' || isNaN(value) || value < 0) {
      return NextResponse.json({ code: 400, message: '调整值无效' }, { status: 400 });
    }

    if (!['increase', 'decrease'].includes(direction)) {
      return NextResponse.json({ code: 400, message: '调整方向无效' }, { status: 400 });
    }

    if (ids.length > 500) {
      return NextResponse.json({ code: 400, message: '单次最多调整500件货品' }, { status: 400 });
    }

    // Fetch all items
    const items = await db.item.findMany({
      where: { id: { in: ids.map(Number) } },
      select: { id: true, skuCode: true, sellingPrice: true, name: true },
    });

    if (items.length === 0) {
      return NextResponse.json({ code: 400, message: '未找到选中货品' }, { status: 400 });
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const oldPrice = item.sellingPrice || 0;
        let newPrice: number;

        if (adjustmentType === 'percentage') {
          if (direction === 'increase') {
            newPrice = Math.round(oldPrice * (1 + value / 100));
          } else {
            newPrice = Math.round(oldPrice * (1 - value / 100));
          }
        } else {
          if (direction === 'increase') {
            newPrice = Math.round(oldPrice + value);
          } else {
            newPrice = Math.round(oldPrice - value);
          }
        }

        // Ensure price never goes below 0
        newPrice = Math.max(0, newPrice);

        await db.item.update({
          where: { id: item.id },
          data: { sellingPrice: newPrice },
        });

        successCount++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`${item.skuCode}: ${message}`);
      }
    }

    await logAction('batch_price_adjust', 'item', 0, {
      count: successCount,
      adjustmentType,
      value,
      direction,
    });

    return NextResponse.json({
      code: 0,
      data: { success: successCount, total: items.length, errors },
      message: `批量调价完成: 成功${successCount}件`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, message: `批量调价失败: ${message}` }, { status: 500 });
  }
}
