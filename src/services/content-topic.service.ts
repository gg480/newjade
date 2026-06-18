// 内容选题服务层 — 选题 CRUD + 评分 + 审核
// 业务逻辑隔离，API 路由只做参数解析和响应封装

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';
import type {
  TopicListParams,
  CreateTopicRequest,
  RateTopicRequest,
  ReviewTopicRequest,
  ContentTopic,
} from '@/types/promotion';

/** 将 Prisma 记录转换为前端类型 */
function toTopic(
  row: {
    id: string;
    title: string;
    description: string | null;
    topicType: string;
    status: string;
    source: string;
    sourceUrl: string | null;
    keywords: Prisma.JsonValue;
    aiMetadata: Prisma.JsonValue | null;
    rating: number | null;
    ratingNote: string | null;
    ratedBy: string | null;
    ratedAt: Date | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{ itemId: number }>;
  },
): ContentTopic {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    topicType: row.topicType as ContentTopic['topicType'],
    status: row.status as ContentTopic['status'],
    source: row.source as ContentTopic['source'],
    sourceUrl: row.sourceUrl,
    keywords: Array.isArray(row.keywords) ? (row.keywords as unknown as string[]) : [],
    aiMetadata: row.aiMetadata as Record<string, unknown> | null,
    rating: row.rating,
    ratingNote: row.ratingNote,
    ratedBy: row.ratedBy,
    ratedAt: row.ratedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    itemIds: row.items?.map(i => i.itemId),
  };
}

/** 选题列表查询 */
export async function listTopics(params: TopicListParams) {
  const page = params.page ?? 1;
  const limit = Math.min(100, params.limit ?? 20);

  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.source) where.source = params.source;
  if (params.topicType) where.topicType = params.topicType;
  if (params.minRating != null) where.rating = { gte: params.minRating };
  if (params.maxRating != null) where.rating = { ...(where.rating as Record<string, unknown> ?? {}), lte: params.maxRating };
  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword } },
      { description: { contains: params.keyword } },
    ];
  }

  const [total, rows] = await Promise.all([
    db.contentTopic.count({ where }),
    db.contentTopic.findMany({
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
    items: rows.map(toTopic),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** 创建选题 */
export async function createTopic(
  data: CreateTopicRequest,
  createdBy: string,
): Promise<ContentTopic> {
  if (!data.title?.trim()) throw new ValidationError('标题不能为空');

  const row = await db.contentTopic.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      topicType: data.topicType,
      status: 'draft',
      source: data.source,
      sourceUrl: data.sourceUrl || null,
      keywords: data.keywords || [],
      aiMetadata: (data.aiMetadata ?? Prisma.DbNull) as Prisma.InputJsonValue,
      createdBy,
      items: data.itemIds?.length
        ? { create: data.itemIds.map(itemId => ({ itemId })) }
        : undefined,
    },
    include: { items: { select: { itemId: true } } },
  });

  return toTopic(row);
}

/** 获取选题详情 */
export async function getTopic(id: string): Promise<ContentTopic> {
  const row = await db.contentTopic.findUnique({
    where: { id },
    include: { items: { select: { itemId: true } } },
  });

  if (!row) throw new NotFoundError('选题不存在');

  return toTopic(row);
}

/** 选题评分 */
export async function rateTopic(
  id: string,
  data: RateTopicRequest,
  ratedBy: string,
): Promise<ContentTopic> {
  if (data.rating < 1 || data.rating > 5) {
    throw new ValidationError('评分必须在 1-5 之间');
  }

  const existing = await db.contentTopic.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('选题不存在');

  const row = await db.contentTopic.update({
    where: { id },
    data: {
      rating: data.rating,
      ratingNote: data.ratingNote || null,
      ratedBy,
      ratedAt: new Date(),
    },
    include: { items: { select: { itemId: true } } },
  });

  return toTopic(row);
}

/** 选题审核 */
export async function reviewTopic(
  id: string,
  data: ReviewTopicRequest,
): Promise<ContentTopic> {
  const existing = await db.contentTopic.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('选题不存在');

  if (data.action === 'approve') {
    if (existing.status !== 'draft' && existing.status !== 'analyzed') {
      throw new ValidationError('只有草稿或已分析的选题才能通过审核');
    }
  }

  const row = await db.contentTopic.update({
    where: { id },
    data: {
      status: data.action === 'approve' ? 'approved' : 'rejected',
      ratingNote: data.reviewNote || null,
    },
    include: { items: { select: { itemId: true } } },
  });

  return toTopic(row);
}
