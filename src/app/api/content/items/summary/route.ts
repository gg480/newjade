// 库存摘要API — 供 OpenClaw Phase 2 调用，约束选题生成范围
// 返回轻量库存快照，不含具体商品信息（无价格/规格/图片）
// 只允许 OpenClaw API Key 调用

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardPermissionOrOpenClaw, safeErrorMessage } from '@/lib/api/permission-guard';

interface MaterialSummary {
  materialId: number;
  name: string;
  category: string | null;
  count: number;
}

interface TypeSummary {
  typeId: number | null;
  name: string | null;
  count: number;
}

interface InventorySummary {
  totalInStock: number;
  byMaterial: MaterialSummary[];
  byType: TypeSummary[];
  newArrivals7d: number;
}

async function summaryGet(req: Request) {
  const denied = await guardPermissionOrOpenClaw(req, 'action:item_view');
  if (denied) return denied;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalInStock, materialGroups, typeGroups, newArrivals7d] = await Promise.all([
      db.item.count({ where: { status: 'in_stock', isDeleted: false } }),

      db.item.groupBy({
        by: ['materialId'],
        where: { status: 'in_stock', isDeleted: false },
        _count: { id: true },
      }).then(async (groups) => {
        const materials = await db.dictMaterial.findMany({
          where: { id: { in: groups.map(g => g.materialId) } },
          select: { id: true, name: true, category: true },
        });
        const matMap = new Map(materials.map(m => [m.id, m]));
        return groups
          .map(g => ({
            materialId: g.materialId,
            name: matMap.get(g.materialId)?.name ?? '未知',
            category: matMap.get(g.materialId)?.category ?? null,
            count: g._count.id,
          }))
          .sort((a, b) => b.count - a.count);
      }),

      db.item.groupBy({
        by: ['typeId'],
        where: { status: 'in_stock', isDeleted: false },
        _count: { id: true },
      }).then(async (groups) => {
        const types = await db.dictType.findMany({
          where: { id: { in: groups.filter(g => g.typeId != null).map(g => g.typeId!) } },
          select: { id: true, name: true },
        });
        const typeMap = new Map(types.map(t => [t.id, t]));
        return groups
          .map(g => ({
            typeId: g.typeId,
            name: g.typeId != null ? (typeMap.get(g.typeId)?.name ?? '未知') : '未分类',
            count: g._count.id,
          }))
          .sort((a, b) => b.count - a.count);
      }),

      db.item.count({
        where: { status: 'in_stock', isDeleted: false, createdAt: { gte: sevenDaysAgo } },
      }),
    ]);

    const summary: InventorySummary = {
      totalInStock,
      byMaterial: materialGroups,
      byType: typeGroups,
      newArrivals7d,
    };

    return NextResponse.json({ code: 0, data: summary, message: 'ok' });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('content:items:summary:GET', summaryGet);
