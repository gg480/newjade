// 内容文案服务层 — 文案 CRUD + 审核 + 违禁词检测

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type {
  DraftListParams,
  CreateDraftRequest,
  UpdateDraftRequest,
  ReviewDraftRequest,
  ContentDraft,
  ViolationCheckResult,
} from '@/types/promotion';

/** 基础违禁词库（P0 简化版，P1 可接入第三方 API） */
const VIOLATION_WORDS = [
  { word: '违禁词1', suggestion: '建议词1' },
  { word: '违禁词2', suggestion: '建议词2' },
];

/** 将 Prisma 记录转换为前端类型 */
function toDraft(
  row: {
    id: string;
    topicId: string | null;
    title: string;
    body: string;
    tags: Prisma.JsonValue;
    coverImage: string | null;
    images: Prisma.JsonValue;
    contentMode: string;
    version: number;
    status: string;
    reviewNote: string | null;
    reviewerId: string | null;
    reviewedAt: Date | null;
    aiModel: string | null;
    aiPrompt: string | null;
    violationFlags: Prisma.JsonValue | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{ itemId: number }>;
  },
): ContentDraft {
  return {
    id: row.id,
    topicId: row.topicId,
    title: row.title,
    body: row.body,
    tags: Array.isArray(row.tags) ? (row.tags as unknown as string[]) : [],
    coverImage: row.coverImage,
    images: Array.isArray(row.images) ? (row.images as unknown as string[]) : [],
    contentMode: row.contentMode as ContentDraft['contentMode'],
    version: row.version,
    status: row.status as ContentDraft['status'],
    reviewNote: row.reviewNote,
    reviewerId: row.reviewerId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    aiModel: row.aiModel,
    aiPrompt: row.aiPrompt,
    violationFlags: row.violationFlags as Record<string, unknown> | null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    itemIds: row.items?.map(i => i.itemId),
  };
}

/** 文案列表查询 */
export async function listDrafts(params: DraftListParams) {
  const page = params.page ?? 1;
  const limit = Math.min(100, params.limit ?? 20);

  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.topicId) where.topicId = params.topicId;
  if (params.contentMode) where.contentMode = params.contentMode;
  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword } },
      { body: { contains: params.keyword } },
    ];
  }

  const [total, rows] = await Promise.all([
    db.contentDraft.count({ where }),
    db.contentDraft.findMany({
      where,
      include: {
        items: { select: { itemId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(toDraft),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** 创建文案 */
export async function createDraft(
  data: CreateDraftRequest,
  createdBy: string,
): Promise<ContentDraft> {
  if (!data.title?.trim()) throw new ValidationError('标题不能为空');
  if (!data.body?.trim()) throw new ValidationError('正文不能为空');

  const row = await db.contentDraft.create({
    data: {
      topicId: data.topicId || null,
      title: data.title.trim(),
      body: data.body,
      tags: data.tags || [],
      coverImage: data.coverImage || null,
      images: data.images || [],
      contentMode: data.contentMode,
      aiModel: data.aiModel || null,
      aiPrompt: data.aiPrompt || null,
      createdBy,
      items: data.itemIds?.length
        ? { create: data.itemIds.map(itemId => ({ itemId })) }
        : undefined,
    },
    include: { items: { select: { itemId: true } } },
  });

  return toDraft(row);
}

/** 获取文案详情 */
export async function getDraft(id: string): Promise<ContentDraft> {
  const row = await db.contentDraft.findUnique({
    where: { id },
    include: { items: { select: { itemId: true } } },
  });

  if (!row) throw new NotFoundError('文案不存在');

  return toDraft(row);
}

/** 更新文案 */
export async function updateDraft(
  id: string,
  data: UpdateDraftRequest,
): Promise<ContentDraft> {
  const existing = await db.contentDraft.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('文案不存在');
  if (existing.status !== 'draft') {
    throw new ValidationError('只有草稿状态的文案才能编辑');
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.body !== undefined) updateData.body = data.body;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
  if (data.images !== undefined) updateData.images = data.images;
  if (data.contentMode !== undefined) updateData.contentMode = data.contentMode;

  const row = await db.contentDraft.update({
    where: { id },
    data: {
      ...updateData,
      version: { increment: 1 },
      items: data.itemIds
        ? {
            deleteMany: {},
            create: data.itemIds.map(itemId => ({ itemId })),
          }
        : undefined,
    },
    include: { items: { select: { itemId: true } } },
  });

  return toDraft(row);
}

/** 提交审核（draft → pending_review） */
export async function submitForReview(id: string): Promise<ContentDraft> {
  const existing = await db.contentDraft.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('文案不存在');
  if (existing.status !== 'draft') {
    throw new ValidationError('只有草稿状态的文案才能提交审核');
  }

  const row = await db.contentDraft.update({
    where: { id },
    data: { status: 'pending_review' },
    include: { items: { select: { itemId: true } } },
  });

  return toDraft(row);
}

/** 审核文案 */
export async function reviewDraft(
  id: string,
  data: ReviewDraftRequest,
  reviewerId: string,
): Promise<ContentDraft> {
  const existing = await db.contentDraft.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('文案不存在');
  if (existing.status !== 'pending_review') {
    throw new ValidationError('只有待审核的文案才能审核');
  }

  const row = await db.contentDraft.update({
    where: { id },
    data: {
      status: data.action === 'approve' ? 'approved' : 'rejected',
      reviewNote: data.reviewNote || null,
      reviewerId,
      reviewedAt: new Date(),
    },
    include: { items: { select: { itemId: true } } },
  });

  return toDraft(row);
}

/** 违禁词检测 */
export async function checkViolations(id: string): Promise<ViolationCheckResult> {
  const draft = await db.contentDraft.findUnique({ where: { id } });
  if (!draft) throw new NotFoundError('文案不存在');

  const violations: ViolationCheckResult['violations'] = [];

  for (const { word, suggestion } of VIOLATION_WORDS) {
    const pos = draft.body.indexOf(word);
    if (pos !== -1) {
      violations.push({ word, position: pos, suggestion });
    }
  }

  const result: ViolationCheckResult = {
    hasViolation: violations.length > 0,
    violations,
  };

  // 保存检测结果到 violationFlags
  await db.contentDraft.update({
    where: { id },
    data: { violationFlags: result as unknown as Prisma.InputJsonValue },
  });

  return result;
}
