import { NextResponse } from 'next/server';
import * as supplierService from '@/services/supplier.service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/suppliers/stats
 * 两种模式：
 *   1. 无 supplierId → 返回所有供应商的进货汇总统计
 *   2. 有 supplierId → 返回指定供应商的进货批次明细（支持分页 + 日期筛选）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get('supplierId');

  try {
    // ── 模式1：供应商进货汇总 ──
    if (!supplierId) {
      const data = await supplierService.getSupplierStats();
      return NextResponse.json({ code: 0, data, message: 'ok' });
    }

    // ── 模式2：指定供应商进货明细 ──
    const id = parseInt(supplierId, 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError('supplierId 必须为正整数');
    }

    // 先确保供应商存在
    await supplierService.getSupplier(id);

    const data = await supplierService.getSupplierPurchases(id, {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10) || 1,
      size: parseInt(searchParams.get('size') || '20', 10) || 20,
    });

    return NextResponse.json({ code: 0, data, message: 'ok' });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json(
        { code: e.code, data: null, message: e.message },
        { status: e.statusCode },
      );
    }
    const msg = e instanceof Error ? e.message : '查询失败';
    return NextResponse.json(
      { code: 500, data: null, message: msg },
      { status: 500 },
    );
  }
}
