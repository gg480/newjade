import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

function normalizeDateInput(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[年./]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '');
  const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[3], 10)).padStart(2, '0')}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const saleId = parseInt(id);
    if (isNaN(saleId)) {
      return NextResponse.json({ code: 400, data: null, message: '销售记录ID无效' }, { status: 400 });
    }

    const body = await req.json();
    const { actualPrice, channel, saleDate, customerId, note } = body;
    const parsedActualPrice = parseFloat(actualPrice);
    const parsedCustomerId = customerId ? parseInt(customerId) : null;

    if (actualPrice === '' || actualPrice === undefined || actualPrice === null || isNaN(parsedActualPrice)) {
      return NextResponse.json({ code: 400, data: null, message: '请输入有效的成交价' }, { status: 400 });
    }
    if (!channel) {
      return NextResponse.json({ code: 400, data: null, message: '请选择销售渠道' }, { status: 400 });
    }
    const normalizedSaleDate = normalizeDateInput(saleDate);
    if (!normalizedSaleDate) {
      return NextResponse.json({ code: 400, data: null, message: '请选择销售日期' }, { status: 400 });
    }
    if (customerId && isNaN(parsedCustomerId as number)) {
      return NextResponse.json({ code: 400, data: null, message: '客户ID无效' }, { status: 400 });
    }

    const original = await db.saleRecord.findUnique({ where: { id: saleId } });
    if (!original) {
      return NextResponse.json({ code: 404, data: null, message: '销售记录不存在' }, { status: 404 });
    }

    const updated = await db.saleRecord.update({
      where: { id: saleId },
      data: {
        actualPrice: parsedActualPrice,
        channel,
        saleDate: normalizedSaleDate,
        customerId: parsedCustomerId,
        note: note ?? null,
      },
      include: { item: { include: { material: true, type: true } }, customer: true, bundle: true },
    });

    await logAction('edit_sale', 'sale', saleId, {
      saleNo: updated.saleNo,
      before: {
        actualPrice: original.actualPrice,
        channel: original.channel,
        saleDate: original.saleDate,
        customerId: original.customerId,
        note: original.note,
      },
      after: {
        actualPrice: updated.actualPrice,
        channel: updated.channel,
        saleDate: updated.saleDate,
        customerId: updated.customerId,
        note: updated.note,
      },
    });

    return NextResponse.json({ code: 0, data: updated, message: '销售记录已更新' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `更新销售记录失败: ${e.message}` }, { status: 500 });
  }
}
