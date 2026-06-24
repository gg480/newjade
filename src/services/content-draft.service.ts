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

/** 基础违禁词库（P1 增强版 50+词，覆盖广告法/玉石行业敏感词） */
const VIOLATION_WORDS: Array<{ word: string; suggestion: string }> = [
  // 广告法极限词
  { word: '最好', suggestion: '品质卓越' },
  { word: '第一', suggestion: '领先' },
  { word: '唯一', suggestion: '独家' },
  { word: '绝对', suggestion: '非常' },
  { word: '顶级', suggestion: '高品质' },
  { word: '极品', suggestion: '精品' },
  { word: '最便宜', suggestion: '实惠' },
  { word: '最低价', suggestion: '优惠' },
  { word: '全网最低', suggestion: '性价比高' },
  { word: '国家级', suggestion: '优质' },
  { word: '世界级', suggestion: '出色' },
  { word: '最高级', suggestion: '高等级' },
  { word: '最先进', suggestion: '先进' },
  { word: '最完美', suggestion: '完美' },
  { word: '100%', suggestion: '高纯度' },
  { word: '百分百', suggestion: '高比例' },
  // 玉石行业禁用语
  { word: '天然A货', suggestion: '天然翡翠' },
  { word: 'B货翡翠', suggestion: '翡翠' },
  { word: 'C货翡翠', suggestion: '翡翠' },
  { word: '假一赔十', suggestion: '品质保证' },
  { word: '保证升值', suggestion: '值得珍藏' },
  { word: '稳赚不赔', suggestion: '收藏佳品' },
  { word: '包赚', suggestion: '值得入手' },
  { word: '投资首选', suggestion: '收藏推荐' },
  { word: '一定升值', suggestion: '有升值潜力' },
  { word: '保证正品', suggestion: '正品货源' },
  // 医疗/功效词（禁止用于普通商品）
  { word: '治疗', suggestion: '佩戴舒适' },
  { word: '治病', suggestion: '美观大方' },
  { word: '抗癌', suggestion: '优雅气质' },
  { word: '防癌', suggestion: '经典设计' },
  { word: '疗效', suggestion: '舒适体验' },
  { word: '治愈', suggestion: '提升气质' },
  { word: '养生', suggestion: '雅致品味' },
  { word: '辟邪', suggestion: '寓意美好' },
  { word: '驱邪', suggestion: '传统纹饰' },
  { word: '护身', suggestion: '精致饰品' },
  { word: '保平安', suggestion: '吉祥如意' },
  { word: '转运', suggestion: '幸运之选' },
  { word: '改运', suggestion: '美好祝愿' },
  { word: '招财', suggestion: '富贵典雅' },
  { word: '旺财', suggestion: '华贵大方' },
  // 虚假宣传词
  { word: '假货', suggestion: '' },
  { word: '高仿', suggestion: '' },
  { word: '精仿', suggestion: '' },
  { word: 'A货', suggestion: '翡翠' },
  { word: '原单', suggestion: '精品' },
  { word: '尾单', suggestion: '限量款' },
  { word: '代购', suggestion: '精选' },
  // 价格欺诈词
  { word: '原价', suggestion: '市场参考价' },
  { word: '跳楼价', suggestion: '特惠价' },
  { word: '亏本', suggestion: '让利' },
  { word: '血亏', suggestion: '折扣' },
  { word: '清仓', suggestion: '限时优惠' },
  { word: '甩卖', suggestion: '促销' },
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
