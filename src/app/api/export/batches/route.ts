import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const batches = await db.batch.findMany({
    include: { material: true, items: { where: { isDeleted: false }, include: { saleRecords: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['批次编号', '材质', '数量', '总成本', '分摊方式', '已售数', '已回款', '利润', '回本率', '状态'];
  const rows = batches.map(b => {
    const soldItems = b.items.filter(i => i.status === 'sold');
    const soldCount = soldItems.length;
    const revenue = soldItems.reduce((sum, item) => sum + item.saleRecords.reduce((s, sr) => s + sr.actualPrice, 0), 0);
    const profit = revenue - b.totalCost;
    const paybackRate = b.totalCost > 0 ? revenue / b.totalCost : 0;
    let status = '未开始';
    if (soldCount === 0) status = '未开始';
    else if (soldCount === b.quantity) status = '清仓完毕';
    else if (paybackRate >= 1) status = '已回本';
    else status = '销售中';
    return [
      b.batchCode,
      b.material?.name || '',
      b.quantity.toString(),
      b.totalCost.toFixed(2),
      { equal: '均摊', by_weight: '按克重', by_price: '按售价' }[b.costAllocMethod] || b.costAllocMethod,
      soldCount.toString(),
      revenue.toFixed(2),
      profit.toFixed(2),
      (paybackRate * 100).toFixed(1) + '%',
      status,
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=batches_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
