import { NextResponse } from 'next/server';
import { cleanupDeletedItems, countDeletedItems } from '@/services/items-extra.service';

export async function DELETE() {
  try {
    const data = await cleanupDeletedItems();

    return NextResponse.json({
      code: 0,
      data,
      message: data.deleted > 0 ? `已清除 ${data.deleted} 条已删除货品` : '没有需要清除的已删除货品',
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
    const data = await countDeletedItems();
    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (error) {
    console.error('Count deleted items error:', error);
    return NextResponse.json({
      code: -1,
      message: '查询失败',
      data: { count: 0 },
    });
  }
}
