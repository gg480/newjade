import { NextResponse } from 'next/server';

const ITEMS_TEMPLATE = `SKU编号,名称,材质,器型,成本价,售价,柜台号,克重,圈口,珠径,颗数,戒圈,产地,证书号,标签,备注,底价,供应商,入库日期
J001,和田玉手镯,和田玉,手镯,5000,8000,1,52.3,58,,,,新疆,,限定款,好货,,
J002,翡翠戒指,翡翠,戒指,3000,5500,2,3.5,,,12,,缅甸,A12345,,,,
J003,南红手串,南红,手串,800,2500,1,25,,8,18,,,云南,,热门,`;

const SALES_TEMPLATE = `SKU编号,成交价,销售日期,渠道,客户姓名,客户电话,备注
J001,7500,2024-06-15,门店,张三,13800138000,老客户优惠
J002,5000,2024-06-20,微信,李四,13900139000,`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'items';

  let csvContent: string;
  let filename: string;

  if (type === 'sales') {
    csvContent = SALES_TEMPLATE;
    filename = '销售数据导入模板.csv';
  } else {
    csvContent = ITEMS_TEMPLATE;
    filename = '库存数据导入模板.csv';
  }

  // Add UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  const csvWithBom = bom + csvContent;

  return new NextResponse(csvWithBom, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
