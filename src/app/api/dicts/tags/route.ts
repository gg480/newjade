import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getRuntimeLogger } from '@/lib/runtime-logger';

const log = getRuntimeLogger().child({ layer: 'api', routeTag: 'tags' });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupName = searchParams.get('group_name');
  const materialIdParam = searchParams.get('material_id');
  const materialId = materialIdParam ? parseInt(materialIdParam, 10) : null;
  const includeInactive = searchParams.get('include_inactive') === 'true';
  const where: any = {};

  log.debug({ groupName, materialIdParam, includeInactive }, 'tags GET entry');

  if (groupName) where.groupName = groupName;
  if (!includeInactive) where.isActive = true;
  if (materialId && !Number.isNaN(materialId)) {
    where.OR = [
      { isGlobal: true },
      { tagMaterials: { some: { materialId } } },
    ];
  }
  try {
    if (process.env.NODE_ENV === 'development') {
      const dbList = await db.$queryRawUnsafe<any[]>('PRAGMA database_list');
      const tagCols = await db.$queryRawUnsafe<any[]>('PRAGMA table_info(dict_tag)');
      log.debug({ dbFile: dbList?.[0]?.file ?? null, tagColumns: Array.isArray(tagCols) ? tagCols.map((c: any) => c.name) : [] }, 'sqlite path and columns snapshot');
    }

    const items = await db.dictTag.findMany({
      where,
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
      include: { tagMaterials: { select: { materialId: true } } },
    });
    const scopedMatchedCount = materialId && !Number.isNaN(materialId)
      ? items.filter(tag => tag.tagMaterials.some(rel => rel.materialId === materialId)).length
      : 0;
    const globalCount = items.filter(tag => tag.isGlobal).length;
    log.debug({ count: items.length, materialFiltered: Boolean(materialId && !Number.isNaN(materialId)), globalCount, scopedMatchedCount }, 'dictTag.findMany succeeded');
    return NextResponse.json({
      code: 0,
      data: items.map(item => ({
        ...item,
        materialIds: item.tagMaterials.map(x => x.materialId),
      })),
      message: 'ok',
    });
  } catch (e: any) {
    log.error({ err: e, name: e?.name ?? null, code: e?.code ?? null, message: e?.message ?? null, meta: e?.meta ?? null }, 'dictTag.findMany failed');
    return NextResponse.json({ code: 500, data: null, message: '标签查询失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, groupName } = body;
  try {
    const item = await db.dictTag.create({ data: { name, groupName } });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      return NextResponse.json({ code: 400, data: null, message: '标签名称已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
