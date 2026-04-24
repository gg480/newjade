import { db } from '@/lib/db';

export async function validateTagMaterialCompatibility(tagIds: number[], materialId: number) {
  if (!tagIds.length) return null;

  const uniqueTagIds = Array.from(new Set(tagIds));
  const tags = await db.dictTag.findMany({
    where: { id: { in: uniqueTagIds } },
    select: {
      id: true,
      name: true,
      isActive: true,
      isGlobal: true,
      tagMaterials: { select: { materialId: true } },
    },
  });
  const tagById = new Map(tags.map(tag => [tag.id, tag]));

  const invalidTagIds: number[] = [];
  const invalidTagNames: string[] = [];

  for (const tagId of uniqueTagIds) {
    const tag = tagById.get(tagId);
    if (!tag) {
      invalidTagIds.push(tagId);
      invalidTagNames.push(`标签#${tagId}`);
      continue;
    }
    const materialMatched = tag.isGlobal || tag.tagMaterials.some(rel => rel.materialId === materialId);
    if (!tag.isActive || !materialMatched) {
      invalidTagIds.push(tag.id);
      invalidTagNames.push(tag.name);
    }
  }

  if (!invalidTagIds.length) return null;
  return { materialId, invalidTagIds, invalidTagNames };
}