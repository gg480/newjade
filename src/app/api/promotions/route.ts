import { withApiLogging } from '@/lib/api/with-api-logging';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';

async function promotionsListGet(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const keyword = searchParams.get('keyword');

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
    ];
  }

  const [total, promotions] = await Promise.all([
    db.promotion.count({ where }),
    db.promotion.findMany({
      where,
      include: {
        items: {
          include: {
            item: {
              include: {
                material: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  const promotionsWithExtras = promotions.map(promotion => ({
    ...promotion,
    itemCount: promotion.items.length,
  }));

  return NextResponse.json({
    code: 0,
    data: {
      promotions: promotionsWithExtras,
      pagination: { total, page, size, pages: Math.ceil(total / size) },
    },
    message: 'ok',
  });
}

async function promotionsCreatePost(req: Request) {
  const body = await req.json();
  const { name, type, discountValue, condition, startDate, endDate, recurrence, status, targetMaterials, targetTypes } = body;

  try {
    // Validate required fields
    if (!name) {
      return NextResponse.json({ code: 400, data: null, message: '请输入促销名称' }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ code: 400, data: null, message: '请选择促销类型' }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ code: 400, data: null, message: '请选择开始日期' }, { status: 400 });
    }
    if (!endDate) {
      return NextResponse.json({ code: 400, data: null, message: '请选择结束日期' }, { status: 400 });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ code: 400, data: null, message: '开始日期不能晚于结束日期' }, { status: 400 });
    }

    // Validate recurrence
    const validRecurrences = ['none', 'daily', 'weekly', 'monthly', 'quarterly'];
    if (recurrence && !validRecurrences.includes(recurrence)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的周期类型' }, { status: 400 });
    }

    const promotion = await db.promotion.create({
      data: {
        name,
        type,
        discountValue: discountValue != null ? parseFloat(discountValue) : null,
        condition: condition != null ? parseFloat(condition) : null,
        startDate,
        endDate,
        recurrence: recurrence || 'none',
        status: status || 'draft',
      },
      include: {
        items: true,
      },
    });

    // Log create_promotion
    await logAction('create_promotion', 'promotion', promotion.id, {
      name: promotion.name,
      type: promotion.type,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      recurrence: promotion.recurrence,
    });

    return NextResponse.json({ code: 0, data: promotion, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `创建失败: ${e.message}` }, { status: 500 });
  }
}

async function promotionsUpdatePut(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ code: 400, data: null, message: '缺少促销ID' }, { status: 400 });
  }

  const body = await req.json();
  const { name, type, discountValue, condition, startDate, endDate, recurrence, status, targetMaterials, targetTypes } = body;

  try {
    // Validate required fields
    if (!name) {
      return NextResponse.json({ code: 400, data: null, message: '请输入促销名称' }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ code: 400, data: null, message: '请选择促销类型' }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ code: 400, data: null, message: '请选择开始日期' }, { status: 400 });
    }
    if (!endDate) {
      return NextResponse.json({ code: 400, data: null, message: '请选择结束日期' }, { status: 400 });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ code: 400, data: null, message: '开始日期不能晚于结束日期' }, { status: 400 });
    }

    // Validate recurrence
    const validRecurrences = ['none', 'daily', 'weekly', 'monthly', 'quarterly'];
    if (recurrence && !validRecurrences.includes(recurrence)) {
      return NextResponse.json({ code: 400, data: null, message: '无效的周期类型' }, { status: 400 });
    }

    const promotion = await db.promotion.update({
      where: { id: parseInt(id) },
      data: {
        name,
        type,
        discountValue: discountValue != null ? parseFloat(discountValue) : null,
        condition: condition != null ? parseFloat(condition) : null,
        startDate,
        endDate,
        recurrence: recurrence || 'none',
        status: status || 'draft',
      },
      include: {
        items: true,
      },
    });

    // Log update_promotion
    await logAction('update_promotion', 'promotion', promotion.id, {
      name: promotion.name,
      type: promotion.type,
      status: promotion.status,
      recurrence: promotion.recurrence,
    });

    return NextResponse.json({ code: 0, data: promotion, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Record to update not found')) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    return NextResponse.json({ code: 500, data: null, message: `更新失败: ${e.message}` }, { status: 500 });
  }
}

async function promotionsDeleteDelete(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ code: 400, data: null, message: '缺少促销ID' }, { status: 400 });
  }

  try {
    // First delete associated promotion items
    await db.promotionItem.deleteMany({
      where: { promotionId: parseInt(id) },
    });

    // Then delete the promotion
    await db.promotion.delete({
      where: { id: parseInt(id) },
    });

    // Log delete_promotion
    await logAction('delete_promotion', 'promotion', parseInt(id), {});

    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Record to delete not found')) {
      return NextResponse.json({ code: 404, data: null, message: '促销活动不存在' }, { status: 404 });
    }
    return NextResponse.json({ code: 500, data: null, message: `删除失败: ${e.message}` }, { status: 500 });
  }
}

export const GET = withApiLogging('promotions:GET', promotionsListGet);
export const POST = withApiLogging('promotions:POST', promotionsCreatePost);
export const PUT = withApiLogging('promotions:PUT', promotionsUpdatePut);
export const DELETE = withApiLogging('promotions:DELETE', promotionsDeleteDelete);
