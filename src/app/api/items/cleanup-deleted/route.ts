import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE() {
  try {
    // Count how many will be deleted first
    const count = await db.item.count({
      where: { isDeleted: true },
    });

    if (count === 0) {
      return NextResponse.json({
        code: 0,
        data: { deleted: 0 },
        message: '没有需要清除的已删除货品',
      });
    }

    // Delete item_tags, item_spec, item_images related to these items
    const itemIds = await db.item.findMany({
      where: { isDeleted: true },
      select: { id: true },
    });
    const ids = itemIds.map(i => i.id);

    // Delete related records
    await db.itemTag.deleteMany({
      where: { itemId: { in: ids } },
    });
    await db.itemSpec.deleteMany({
      where: { itemId: { in: ids } },
    });
    await db.itemImage.deleteMany({
      where: { itemId: { in: ids } },
    });

    // Delete the items
    const result = await db.item.deleteMany({
      where: { isDeleted: true },
    });

    return NextResponse.json({
      code: 0,
      data: { deleted: result.count },
      message: `已清除 ${result.count} 条已删除货品`,
    });
  } catch (error) {
    console.error('Cleanup deleted items error:', error);
    return NextResponse.json({
      code: -1,
      message: '清除已删除货品失败',
      data: { deleted: 0 },
    });
  }
}

export async function GET() {
  try {
    const count = await db.item.count({
      where: { isDeleted: true },
    });
    return NextResponse.json({
      code: 0,
      data: { count },
      message: 'ok',
    });
  } catch (error) {
    console.error('Count deleted items error:', error);
    return NextResponse.json({
      code: -1,
      message: '查询失败',
      data: { count: 0 },
    });
  }
}
