import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tagId = parseInt(id, 10);
  if (Number.isNaN(tagId)) {
    return NextResponse.json({ code: 400, data: null, message: '标签ID无效' }, { status: 400 });
  }

  const body = await req.json();
  const isGlobal = Boolean(body?.isGlobal);
  const materialIdsRaw = Array.isArray(body?.materialIds) ? body.materialIds : [];
  const materialIds = Array.from(
    new Set(
      materialIdsRaw
        .map((v: unknown) => parseInt(String(v), 10))
        .filter((v: number) => !Number.isNaN(v)),
    ),
  );

  const tag = await db.dictTag.findUnique({ where: { id: tagId }, select: { id: true } });
  if (!tag) {
    return NextResponse.json({ code: 404, data: null, message: '标签不存在' }, { status: 404 });
  }

  if (!isGlobal && materialIds.length === 0) {
    return NextResponse.json(
      { code: 400, message: 'NON_GLOBAL_TAG_REQUIRES_MATERIALS', data: { tagId } },
      { status: 400 },
    );
  }

  await db.$transaction(async tx => {
    await tx.dictTag.update({
      where: { id: tagId },
      data: { isGlobal },
    });
    await tx.dictTagMaterial.deleteMany({ where: { tagId } });
    if (!isGlobal) {
      await tx.dictTagMaterial.createMany({
        data: materialIds.map(materialId => ({ tagId, materialId })),
        skipDuplicates: true,
      });
    }
  });

  return NextResponse.json({
    code: 0,
    message: 'ok',
    data: { id: tagId, isGlobal, materialIds: isGlobal ? [] : materialIds },
  });
}
