import { withApiLogging } from '@/lib/api/with-api-logging';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

async function promotionItemsGet(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;

  try {
    const promotion = await db.promotion.findUnique({
      where: { id: parseInt(promotionId) },
      include: {
        items: {
          include: {
            item: {
              include: {
                material: true,
                type: true,
                spec: true,
                images: { where: { isCover: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!promotion) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }

    const itemsWithExtras = promotion.items.map(({ item }) => ({
      ...item,
      materialName: item.material?.name,
      typeName: item.type?.name,
      coverImage: item.images[0]?.filename || null,
    }));

    return NextResponse.json({
      code: 0,
      data: {
        items: itemsWithExtras,
        promotionId: promotion.id,
        promotionName: promotion.name,
      },
      message: 'ok',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `获取失败: ${e.message}` }, { status: 500 });
  }
}

async function promotionItemsPost(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;
  const body = await req.json();
  const { itemIds } = body;

  try {
    // Validate promotion exists
    const promotion = await db.promotion.findUnique({
      where: { id: parseInt(promotionId) },
    });

    if (!promotion) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }

    // Validate itemIds
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: '请选择要添加的商品' }, { status: 400 });
    }

    // Check if items exist
    const existingItems = await db.item.findMany({
      where: { id: { in: itemIds } },
    });

    if (existingItems.length !== itemIds.length) {
      return NextResponse.json({ code: 400, data: null, message: '部分商品不存在' }, { status: 400 });
    }

    // Check existing associations
    const existingAssociations = await db.promotionItem.findMany({
      where: {
        promotionId: parseInt(promotionId),
        itemId: { in: itemIds },
      },
    });

    const existingItemIds = new Set(existingAssociations.map(assoc => assoc.itemId));
    const newItemIds = itemIds.filter(itemId => !existingItemIds.has(itemId));

    // Create new associations
    if (newItemIds.length > 0) {
      await db.promotionItem.createMany({
        data: newItemIds.map(itemId => ({
          promotionId: parseInt(promotionId),
          itemId,
        })),
      });

      // Log add_promotion_items
      await logAction('add_promotion_items', 'promotion', parseInt(promotionId), {
        itemIds: newItemIds,
        count: newItemIds.length,
      });
    }

    // Get updated items
    const updatedItems = await db.promotionItem.findMany({
      where: { promotionId: parseInt(promotionId) },
      include: {
        item: {
          include: {
            material: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({
      code: 0,
      data: {
        items: updatedItems.map(({ item }) => ({
          ...item,
          materialName: item.material?.name,
          typeName: item.type?.name,
        })),
        addedCount: newItemIds.length,
        totalCount: updatedItems.length,
      },
      message: 'ok',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `添加失败: ${e.message}` }, { status: 500 });
  }
}

async function promotionItemsDelete(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: promotionId } = await params;
  const body = await req.json();
  const { itemIds } = body;

  try {
    // Validate promotion exists
    const promotion = await db.promotion.findUnique({
      where: { id: parseInt(promotionId) },
    });

    if (!promotion) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }

    // Validate itemIds
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: '请选择要移除的商品' }, { status: 400 });
    }

    // Delete associations
    await db.promotionItem.deleteMany({
      where: {
        promotionId: parseInt(promotionId),
        itemId: { in: itemIds },
      },
    });

    // Log remove_promotion_items
    await logAction('remove_promotion_items', 'promotion', parseInt(promotionId), {
      itemIds,
      count: itemIds.length,
    });

    // Get updated items
    const updatedItems = await db.promotionItem.findMany({
      where: { promotionId: parseInt(promotionId) },
      include: {
        item: {
          include: {
            material: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({
      code: 0,
      data: {
        items: updatedItems.map(({ item }) => ({
          ...item,
          materialName: item.material?.name,
          typeName: item.type?.name,
        })),
        removedCount: itemIds.length,
        totalCount: updatedItems.length,
      },
      message: 'ok',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `移除失败: ${e.message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('promotions:items:GET', promotionItemsGet);
export const POST = withApiLogging('promotions:items:POST', promotionItemsPost);
export const DELETE = withApiLogging('promotions:items:DELETE', promotionItemsDelete);
