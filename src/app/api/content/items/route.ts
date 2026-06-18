// 安全内容API — 供 OpenClaw 调用，返回商品公开信息（无底价/成本/供应商）
// 使用 guardOpenClawAPI 守卫，只允许 OpenClaw API Key 调用

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardOpenClawAPI, safeErrorMessage } from '@/lib/api/permission-guard';
import type { SafeContentItem } from '@/types/promotion';

/** Prisma select 白名单 — 绝不返回敏感字段 */
const SAFE_ITEM_SELECT = {
  id: true,
  sku: true,
  name: true,
  materialId: true,
  typeId: true,
  status: true,
  description: true,
  retailPrice: true,
  createdAt: true,
  images: { select: { url: true, isCover: true }, orderBy: { isCover: 'desc' } },
  itemTags: { select: { tag: { select: { name: true } } } },
} as const;

/** 敏感字段黑名单（注释说明，实际通过 select 白名单保证不返回） */
// 禁止返回：costPrice, allocatedCost, floorPrice, estimatedCost, batch.totalCost, supplierId

async function contentItemsGet(req: Request) {
  // 只允许 OpenClaw 调用
  const denied = guardOpenClawAPI(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const status = searchParams.get('status') || undefined;
  const hasImages = searchParams.get('has_images');
  const materialId = searchParams.get('material_id');
  const typeId = searchParams.get('type_id');
  const minPrice = searchParams.get('min_price');
  const maxPrice = searchParams.get('max_price');

  try {
    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (materialId) where.materialId = parseInt(materialId);
    if (typeId) where.typeId = parseInt(typeId);
    if (minPrice || maxPrice) {
      where.retailPrice = {};
      if (minPrice) (where.retailPrice as Record<string, unknown>).gte = parseFloat(minPrice);
      if (maxPrice) (where.retailPrice as Record<string, unknown>).lte = parseFloat(maxPrice);
    }
    if (hasImages === 'true') {
      where.images = { some: {} };
    }

    const [total, items] = await Promise.all([
      db.item.count({ where }),
      db.item.findMany({
        where,
        select: SAFE_ITEM_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // 查询材质和器型名称
    const materialIds = [...new Set(items.map(i => i.materialId).filter(Boolean))] as number[];
    const typeIds = [...new Set(items.map(i => i.typeId).filter(Boolean))] as number[];

    const [materials, types] = await Promise.all([
      materialIds.length > 0
        ? db.dictMaterial.findMany({ where: { id: { in: materialIds } }, select: { id: true, name: true } })
        : [],
      typeIds.length > 0
        ? db.dictType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const materialMap = new Map(materials.map(m => [m.id, m.name] as [number, string]));
    const typeMap = new Map(types.map(t => [t.id, t.name] as [number, string]));

    // 转换为安全内容商品（确保无敏感字段）
    const safeItems: SafeContentItem[] = (items as any[]).map(item => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      materialName: item.materialId ? materialMap.get(item.materialId) ?? null : null,
      typeName: item.typeId ? typeMap.get(item.typeId) ?? null : null,
      tags: item.itemTags?.map((it: any) => it.tag.name) || [],
      images: item.images?.map((img: any) => img.url) || [],
      retailPrice: item.retailPrice,
      status: item.status,
      description: item.description,
      createdAt: item.createdAt?.toISOString?.() || '',
    }));

    return NextResponse.json({
      code: 0,
      data: {
        items: safeItems,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      message: 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('content:items:GET', contentItemsGet);
