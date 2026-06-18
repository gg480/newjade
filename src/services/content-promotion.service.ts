// 推广记录 + 反馈数据服务层

import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type {
  PromotionListParams,
  CreatePromotionRequest,
  UpdatePromotionStatusRequest,
  CreateMetricRequest,
  ContentPromotion,
  ContentMetric,
  ItemPromotionHistory,
  MetricSummary,
  MetricTrendPoint,
} from '@/types/promotion';

/** 将 Prisma 记录转换为前端类型 */
function toPromotion(
  row: {
    id: string;
    contentId: string;
    channel: string;
    externalNoteId: string | null;
    externalNoteUrl: string | null;
    status: string;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    offlineAt: Date | null;
    offlineReason: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{ itemId: number }>;
  },
): ContentPromotion {
  return {
    id: row.id,
    contentId: row.contentId,
    channel: row.channel as ContentPromotion['channel'],
    externalNoteId: row.externalNoteId,
    externalNoteUrl: row.externalNoteUrl,
    status: row.status as ContentPromotion['status'],
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    offlineAt: row.offlineAt?.toISOString() ?? null,
    offlineReason: row.offlineReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    itemIds: row.items?.map(i => i.itemId),
  };
}

/** 推广列表查询 */
export async function listPromotions(params: PromotionListParams) {
  const page = params.page ?? 1;
  const limit = Math.min(100, params.limit ?? 20);

  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.channel) where.channel = params.channel;
  if (params.contentId) where.contentId = params.contentId;

  const [total, rows] = await Promise.all([
    db.contentPromotion.count({ where }),
    db.contentPromotion.findMany({
      where,
      include: {
        items: { select: { itemId: true } },
        content: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(r => ({
      ...toPromotion(r),
      contentTitle: r.content.title,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** 创建推广记录 */
export async function createPromotion(
  data: CreatePromotionRequest,
  createdBy: string,
): Promise<ContentPromotion> {
  if (!data.contentId) throw new ValidationError('文案 ID 不能为空');
  if (!data.channel) throw new ValidationError('推广渠道不能为空');

  // 校验文案存在且已审核通过
  const content = await db.contentDraft.findUnique({ where: { id: data.contentId } });
  if (!content) throw new NotFoundError('文案不存在');
  if (content.status !== 'approved') {
    throw new ValidationError('只有已审核通过的文案才能创建推广');
  }

  const row = await db.contentPromotion.create({
    data: {
      contentId: data.contentId,
      channel: data.channel,
      status: 'scheduled',
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      createdBy,
      items: data.itemIds?.length
        ? { create: data.itemIds.map(itemId => ({ itemId })) }
        : undefined,
    },
    include: { items: { select: { itemId: true } } },
  });

  return toPromotion(row);
}

/** 更新推广状态 */
export async function updatePromotionStatus(
  id: string,
  data: UpdatePromotionStatusRequest,
): Promise<ContentPromotion> {
  const existing = await db.contentPromotion.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('推广记录不存在');

  const now = new Date();
  const updateData: Record<string, unknown> = { status: data.status };

  // 状态流转时自动设置时间戳
  if (data.status === 'published') {
    updateData.publishedAt = now;
    if (data.externalNoteId) updateData.externalNoteId = data.externalNoteId;
    if (data.externalNoteUrl) updateData.externalNoteUrl = data.externalNoteUrl;
  } else if (data.status === 'offline') {
    updateData.offlineAt = now;
    if (data.offlineReason) updateData.offlineReason = data.offlineReason;
  }

  const row = await db.contentPromotion.update({
    where: { id },
    data: updateData,
    include: { items: { select: { itemId: true } } },
  });

  return toPromotion(row);
}

/** 查询推广反馈数据 */
export async function getMetrics(promotionId: string): Promise<ContentMetric[]> {
  const promotion = await db.contentPromotion.findUnique({ where: { id: promotionId } });
  if (!promotion) throw new NotFoundError('推广记录不存在');

  const rows = await db.contentMetric.findMany({
    where: { promotionId },
    orderBy: { syncedAt: 'desc' },
  });

  return rows.map(r => ({
    id: r.id,
    promotionId: r.promotionId,
    viewCount: r.viewCount,
    likeCount: r.likeCount,
    collectCount: r.collectCount,
    commentCount: r.commentCount,
    shareCount: r.shareCount,
    syncedAt: r.syncedAt.toISOString(),
    dataSource: r.dataSource as ContentMetric['dataSource'],
  }));
}

/** 录入反馈数据 */
export async function createMetric(
  promotionId: string,
  data: CreateMetricRequest,
): Promise<ContentMetric> {
  const promotion = await db.contentPromotion.findUnique({ where: { id: promotionId } });
  if (!promotion) throw new NotFoundError('推广记录不存在');

  const row = await db.contentMetric.create({
    data: {
      promotionId,
      viewCount: data.viewCount,
      likeCount: data.likeCount,
      collectCount: data.collectCount,
      commentCount: data.commentCount,
      shareCount: data.shareCount,
      dataSource: data.dataSource || 'manual',
    },
  });

  return {
    id: row.id,
    promotionId: row.promotionId,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    collectCount: row.collectCount,
    commentCount: row.commentCount,
    shareCount: row.shareCount,
    syncedAt: row.syncedAt.toISOString(),
    dataSource: row.dataSource as ContentMetric['dataSource'],
  };
}

/** 查询商品推广历史 */
export async function getItemPromotionHistory(itemId: number): Promise<ItemPromotionHistory[]> {
  const promotions = await db.contentPromotion.findMany({
    where: { items: { some: { itemId } } },
    include: {
      content: { select: { title: true } },
      metrics: { orderBy: { syncedAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return promotions.map(p => ({
    promotionId: p.id,
    contentTitle: p.content.title,
    channel: p.channel as ItemPromotionHistory['channel'],
    status: p.status as ItemPromotionHistory['status'],
    publishedAt: p.publishedAt?.toISOString() ?? null,
    metrics: p.metrics[0]
      ? {
          id: p.metrics[0].id,
          promotionId: p.metrics[0].promotionId,
          viewCount: p.metrics[0].viewCount,
          likeCount: p.metrics[0].likeCount,
          collectCount: p.metrics[0].collectCount,
          commentCount: p.metrics[0].commentCount,
          shareCount: p.metrics[0].shareCount,
          syncedAt: p.metrics[0].syncedAt.toISOString(),
          dataSource: p.metrics[0].dataSource as ContentMetric['dataSource'],
        }
      : null,
  }));
}

/** 获取反馈汇总（用于反馈追踪 Tab） */
export async function getMetricsSummary(promotionId: string): Promise<MetricSummary> {
  const metrics = await db.contentMetric.findMany({
    where: { promotionId },
    orderBy: { syncedAt: 'asc' },
  });

  const trend: MetricTrendPoint[] = metrics.map(m => ({
    date: m.syncedAt.toISOString(),
    viewCount: m.viewCount,
    likeCount: m.likeCount,
    collectCount: m.collectCount,
    commentCount: m.commentCount,
    shareCount: m.shareCount,
  }));

  return {
    totalViews: metrics.reduce((sum, m) => sum + m.viewCount, 0),
    totalLikes: metrics.reduce((sum, m) => sum + m.likeCount, 0),
    totalCollects: metrics.reduce((sum, m) => sum + m.collectCount, 0),
    totalComments: metrics.reduce((sum, m) => sum + m.commentCount, 0),
    totalShares: metrics.reduce((sum, m) => sum + m.shareCount, 0),
    trend,
  };
}
