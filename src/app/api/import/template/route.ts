import { NextResponse } from 'next/server';

const ITEMS_TEMPLATE = `名称,数量,材质,器型,成本价,零售价,柜台,采购日期,产地,证书号,匹配码,备注
翡翠手镯,1,翡翠,手镯,5000,8000,1,2024-01-15,缅甸,,A001,好货
和田玉吊坠,1,和田玉,吊坠,3000,5500,2,2024-02-20,新疆,CERT001,A002,
南红手串,3,南红,手链,800,2500,1,2024-03-10,云南,,A003,热门款
古董摆件,1,,,3800,,1,,,,,无材质器型会自动推断`;

const SALES_TEMPLATE = `名称,匹配码,材质,器型,成本价,成交价,销售日期,渠道,客户姓名,客户电话,备注
翡翠手镯,A001,翡翠,手镯,5000,7500,2024-06-15,门店,张三,13800138000,老客户优惠
和田玉吊坠,A002,和田玉,吊坠,3000,5000,2024-06-20,微信,李四,13900139000,`;

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
