import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * 更新标签的材质关联
 * 事务内：更新 isGlobal 标记 + 全量替换材质关联
 * @throws {ValidationError} 非全局标签必须指定至少一个材质
 * @throws {NotFoundError} 标签不存在
 * 等同于 PUT /api/dicts/tags/:id/materials
 */
export async function updateTagMaterials(
  tagId: number,
  data: {
    isGlobal: boolean;
    materialIds: number[];
  },
): Promise<{
  id: number;
  isGlobal: boolean;
  materialIds: number[];
}> {
  const { isGlobal, materialIds } = data;

  const tag = await db.dictTag.findUnique({ where: { id: tagId }, select: { id: true } });
  if (!tag) {
    throw new NotFoundError('标签不存在');
  }

  const cleanMaterialIds = Array.from(new Set(
    materialIds
      .map(v => parseInt(String(v), 10))
      .filter(v => !Number.isNaN(v)),
  ));

  if (!isGlobal && cleanMaterialIds.length === 0) {
    throw new ValidationError('NON_GLOBAL_TAG_REQUIRES_MATERIALS');
  }

  await db.$transaction(async tx => {
    await tx.dictTag.update({
      where: { id: tagId },
      data: { isGlobal },
    });
    await tx.dictTagMaterial.deleteMany({ where: { tagId } });
    if (!isGlobal) {
      await tx.dictTagMaterial.createMany({
        data: cleanMaterialIds.map(materialId => ({ tagId, materialId })),
        skipDuplicates: true,
      });
    }
  });

  return { id: tagId, isGlobal, materialIds: isGlobal ? [] : cleanMaterialIds };
}
