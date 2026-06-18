// 内容推广模块类型定义
// 对应 prisma/schema.prisma 中的 Content* 模型
// 所有者：@Architect

// ========== 实体类型（对应 Prisma 模型，前端使用精简版） ==========

/** 选题状态 */
export type TopicStatus = 'draft' | 'analyzed' | 'pending' | 'approved' | 'rejected' | 'archived';

/** 选题来源 */
export type TopicSource = 'ai' | 'manual' | 'web_fetch';

/** 选题类型 */
export type TopicType = 'product' | 'category' | 'season' | 'trend';

/** 文案状态 */
export type DraftStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';

/** 文案模式 */
export type ContentMode = '种草' | '科普' | '故事' | '对比';

/** 推广状态 */
export type PromotionStatus = 'scheduled' | 'published' | 'offline' | 'archived';

/** 推广渠道 */
export type PromotionChannel = 'xiaohongshu' | 'wechat' | 'douyin' | 'weibo' | 'other';

/** 反馈数据来源 */
export type MetricDataSource = 'browser' | 'manual';

/** 选题实体（前端精简版，不含 Prisma 关系对象的嵌套） */
export interface ContentTopic {
  id: string;
  title: string;
  description: string | null;
  topicType: TopicType;
  status: TopicStatus;
  source: TopicSource;
  sourceUrl: string | null;
  keywords: string[];
  aiMetadata: Record<string, unknown> | null;
  rating: number | null;
  ratingNote: string | null;
  ratedBy: string | null;
  ratedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** 关联商品 ID 列表（列表查询时可选返回） */
  itemIds?: number[];
}

/** 文案实体 */
export interface ContentDraft {
  id: string;
  topicId: string | null;
  title: string;
  body: string;
  tags: string[];
  coverImage: string | null;
  images: string[];
  contentMode: ContentMode;
  version: number;
  status: DraftStatus;
  reviewNote: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  aiModel: string | null;
  aiPrompt: string | null;
  violationFlags: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** 关联商品 ID 列表 */
  itemIds?: number[];
}

/** 推广记录实体 */
export interface ContentPromotion {
  id: string;
  contentId: string;
  channel: PromotionChannel;
  externalNoteId: string | null;
  externalNoteUrl: string | null;
  status: PromotionStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  offlineAt: string | null;
  offlineReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** 关联商品 ID 列表 */
  itemIds?: number[];
}

/** 反馈数据实体（时序） */
export interface ContentMetric {
  id: string;
  promotionId: string;
  viewCount: number;
  likeCount: number;
  collectCount: number;
  commentCount: number;
  shareCount: number;
  syncedAt: string;
  dataSource: MetricDataSource;
}

// ========== API 请求类型 ==========

/** 选题列表查询参数 */
export interface TopicListParams {
  page?: number;
  limit?: number;
  status?: TopicStatus;
  source?: TopicSource;
  topicType?: TopicType;
  minRating?: number;
  maxRating?: number;
  keyword?: string;
}

/** 创建选题请求 */
export interface CreateTopicRequest {
  title: string;
  description?: string;
  topicType: TopicType;
  source: TopicSource;
  sourceUrl?: string;
  keywords: string[];
  itemIds?: number[];
  aiMetadata?: Record<string, unknown>;
}

/** 选题评分请求 */
export interface RateTopicRequest {
  rating: number; // 1-5
  ratingNote?: string;
}

/** 选题审核请求 */
export interface ReviewTopicRequest {
  action: 'approve' | 'reject';
  reviewNote?: string;
}

/** 文案列表查询参数 */
export interface DraftListParams {
  page?: number;
  limit?: number;
  status?: DraftStatus;
  topicId?: string;
  contentMode?: ContentMode;
  keyword?: string;
}

/** 创建文案请求 */
export interface CreateDraftRequest {
  topicId?: string;
  title: string;
  body: string;
  tags: string[];
  coverImage?: string;
  images?: string[];
  contentMode: ContentMode;
  itemIds?: number[];
  aiModel?: string;
  aiPrompt?: string;
}

/** 更新文案请求 */
export interface UpdateDraftRequest {
  title?: string;
  body?: string;
  tags?: string[];
  coverImage?: string;
  images?: string[];
  contentMode?: ContentMode;
  itemIds?: number[];
}

/** 文案审核请求 */
export interface ReviewDraftRequest {
  action: 'approve' | 'reject';
  reviewNote?: string;
}

/** 推广列表查询参数 */
export interface PromotionListParams {
  page?: number;
  limit?: number;
  status?: PromotionStatus;
  channel?: PromotionChannel;
  contentId?: string;
}

/** 创建推广请求 */
export interface CreatePromotionRequest {
  contentId: string;
  channel: PromotionChannel;
  scheduledAt?: string;
  itemIds?: number[];
}

/** 推广状态变更请求 */
export interface UpdatePromotionStatusRequest {
  status: PromotionStatus;
  externalNoteId?: string;
  externalNoteUrl?: string;
  offlineReason?: string;
}

/** 反馈数据录入请求 */
export interface CreateMetricRequest {
  viewCount: number;
  likeCount: number;
  collectCount: number;
  commentCount: number;
  shareCount: number;
  dataSource?: MetricDataSource;
}

/** 安全内容查询参数（OpenClaw 调用） */
export interface ContentItemListParams {
  page?: number;
  limit?: number;
  status?: string;
  hasImages?: boolean;
  materialId?: number;
  typeId?: number;
  minPrice?: number;
  maxPrice?: number;
}

/** OpenClaw 回写选题请求 */
export interface OpenClawCreateTopicRequest {
  title: string;
  description?: string;
  topicType: TopicType;
  sourceUrl?: string;
  keywords: string[];
  itemIds?: number[];
  aiMetadata?: Record<string, unknown>;
}

/** OpenClaw 回写文案请求 */
export interface OpenClawCreateDraftRequest {
  topicId?: string;
  title: string;
  body: string;
  tags: string[];
  coverImage?: string;
  images?: string[];
  contentMode: ContentMode;
  itemIds?: number[];
  aiModel?: string;
  aiPrompt?: string;
}

/** OpenClaw 回写拆解结果请求 */
export interface OpenClawAnalyzeRequest {
  topicId: string;
  analysisResult: Record<string, unknown>;
}

/** AI 配置 */
export interface AIConfig {
  openclawApiKey: string;
  openclawBaseUrl: string;
  baiduApiKey: string;
}

/** 更新 AI 配置请求 */
export interface UpdateAIConfigRequest {
  openclawApiKey?: string;
  openclawBaseUrl?: string;
  baiduApiKey?: string;
}

// ========== API 响应类型 ==========

/** 商品推广历史记录 */
export interface ItemPromotionHistory {
  promotionId: string;
  contentTitle: string;
  channel: PromotionChannel;
  status: PromotionStatus;
  publishedAt: string | null;
  metrics: ContentMetric | null;
}

/** 违禁词检测结果 */
export interface ViolationCheckResult {
  hasViolation: boolean;
  violations: Array<{
    word: string;
    position: number;
    suggestion?: string;
  }>;
}

/** 安全内容商品（OpenClaw 可见，无敏感字段） */
export interface SafeContentItem {
  id: number;
  sku: string;
  name: string;
  materialName: string | null;
  typeName: string | null;
  tags: string[];
  images: string[];
  retailPrice: number | null;
  status: string;
  description: string | null;
  createdAt: string;
}

/** 健康检查响应 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  openclawEnabled: boolean;
  version: string;
}

// ========== 前端组件状态类型 ==========

/** 选题中心筛选状态 */
export interface TopicFilterState {
  status: TopicStatus | 'all';
  source: TopicSource | 'all';
  minRating: number | null;
  keyword: string;
}

/** 文案工坊筛选状态 */
export interface DraftFilterState {
  status: DraftStatus | 'all';
  contentMode: ContentMode | 'all';
  keyword: string;
}

/** 推广管理筛选状态 */
export interface PromotionFilterState {
  status: PromotionStatus | 'all';
  channel: PromotionChannel | 'all';
}

/** 推广统计卡片数据 */
export interface PromotionStats {
  scheduled: number;
  published: number;
  offline: number;
  archived: number;
  total: number;
}

/** 反馈追踪趋势数据点 */
export interface MetricTrendPoint {
  date: string;
  viewCount: number;
  likeCount: number;
  collectCount: number;
  commentCount: number;
  shareCount: number;
}

/** 反馈汇总数据 */
export interface MetricSummary {
  totalViews: number;
  totalLikes: number;
  totalCollects: number;
  totalComments: number;
  totalShares: number;
  trend: MetricTrendPoint[];
}
