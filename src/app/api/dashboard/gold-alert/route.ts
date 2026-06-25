import { NextResponse } from 'next/server';
import { getGoldAlertData, autoTagGoldAlert } from '@/services/gold-alert.service';

/**
 * GET /api/dashboard/gold-alert?auto_tag=1
 *
 * 黄金销售预警：比对融通金行情价与货品成本克重单价
 * 当成本克重单价低于行情价超过 50 元/克时，标记为"好"（好价）
 *
 * Query params:
 *   auto_tag - 如果为 1，自动添加/移除"好"标签（可选，默认 0）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const autoTag = searchParams.get('auto_tag') === '1';

  try {
    // 获取预警数据
    const result = await getGoldAlertData();

    // 可选：自动标记标签
    let tagResult: { tagged: number; untagged: number } | null = null;
    if (autoTag) {
      tagResult = await autoTagGoldAlert();
    }

    return NextResponse.json({
      code: 0,
      data: { ...result, tagResult },
      message: 'ok',
    });
  } catch (e) {
    console.error('[GoldAlert]', e);
    const message = e instanceof Error ? e.message : '获取黄金预警数据失败';
    return NextResponse.json(
      { code: 500, data: null, message },
      { status: 500 },
    );
  }
}
