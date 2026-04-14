import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  const where: any = {};
  if (startDate) where.saleDate = { ...where.saleDate, gte: startDate };
  if (endDate) where.saleDate = { ...where.saleDate, lte: endDate };

  const sales = await db.saleRecord.findMany({
    where,
    include: { item: { include: { material: true } }, customer: true },
    orderBy: { saleDate: 'desc' },
  });

  const headers = ['销售单号', 'SKU', '货品名称', '材质', '成交价', '渠道', '销售日期', '客户', '成本', '毛利'];
  const rows = sales.map(s => [
    s.saleNo,
    s.item?.skuCode || '',
    s.item?.name || '',
    s.item?.material?.name || '',
    s.actualPrice.toFixed(2),
    { store: '门店', wechat: '微信' }[s.channel] || s.channel,
    s.saleDate,
    s.customer?.name || '',
    (s.item?.allocatedCost || s.item?.costPrice || 0).toFixed(2),
    (s.actualPrice - (s.item?.allocatedCost || s.item?.costPrice || 0)).toFixed(2),
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=sales_${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
