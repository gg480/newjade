'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { promotionApi } from '@/lib/api';
import type {
  ItemPromotionHistory,
  PromotionChannel,
  PromotionStatus,
  ContentMetric,
} from '@/types/promotion';
import { Megaphone, Eye, Heart, Star, MessageSquare, Share2 } from 'lucide-react';

// 渠道中文映射：用户视角应看到中文渠道名而非原始枚举值
const CHANNEL_LABELS: Record<PromotionChannel, string> = {
  xiaohongshu: '小红书',
  wechat: '微信',
  douyin: '抖音',
  weibo: '微博',
  other: '其他',
};

// 状态中文映射 + 徽章语义配色：按业务状态区分视觉层级
const STATUS_CONFIG: Record<PromotionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  scheduled: { label: '已排期', variant: 'secondary' },
  published: { label: '已发布', variant: 'default' },
  offline: { label: '已下线', variant: 'destructive' },
  archived: { label: '已归档', variant: 'outline' },
};

interface Props {
  itemId: number;
}

// 单条反馈指标展示：图标 + 数值，统一视觉风格便于横向对比
function MetricItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// 反馈数据区块：metrics 可能为 null（尚未同步数据），需独立处理空态
function MetricsBlock({ metrics }: { metrics: ContentMetric | null }) {
  if (!metrics) {
    return <p className="text-xs text-muted-foreground italic">暂无反馈数据</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      <MetricItem icon={<Eye className="h-3 w-3" />} label="浏览" value={metrics.viewCount} />
      <MetricItem icon={<Heart className="h-3 w-3" />} label="点赞" value={metrics.likeCount} />
      <MetricItem icon={<Star className="h-3 w-3" />} label="收藏" value={metrics.collectCount} />
      <MetricItem icon={<MessageSquare className="h-3 w-3" />} label="评论" value={metrics.commentCount} />
      <MetricItem icon={<Share2 className="h-3 w-3" />} label="分享" value={metrics.shareCount} />
    </div>
  );
}

// 单条推广历史卡片：标题、渠道、状态、发布时间、反馈数据
function PromotionHistoryCard({ record }: { record: ItemPromotionHistory }) {
  const channelLabel = CHANNEL_LABELS[record.channel] ?? record.channel;
  const statusConfig = STATUS_CONFIG[record.status] ?? { label: record.status, variant: 'outline' as const };
  const publishedText = record.publishedAt
    ? new Date(record.publishedAt).toLocaleString('zh-CN')
    : '未发布';

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{record.contentTitle || '未命名内容'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{publishedText}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-[10px] h-5">{channelLabel}</Badge>
          <Badge variant={statusConfig.variant} className="text-[10px] h-5">{statusConfig.label}</Badge>
        </div>
      </div>
      <MetricsBlock metrics={record.metrics} />
    </div>
  );
}

// 加载骨架屏：与最终布局结构对应，避免渲染跳动
function HistorySkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-md border border-border/60 px-3 py-2.5 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ItemPromotionHistory({ itemId }: Props) {
  const [records, setRecords] = useState<ItemPromotionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 拉取推广历史：itemId 变化时重新加载，失败时静默降级（不阻塞详情对话框）
  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await promotionApi.items.history(itemId);
        if (!cancelled) setRecords(data);
      } catch (err) {
        console.error('加载推广历史失败:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadHistory();
    return () => { cancelled = true; };
  }, [itemId]);

  return (
    <Card className="border-emerald-100 dark:border-emerald-900/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Megaphone className="h-4 w-4 text-emerald-600" />
          推广历史
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <HistorySkeleton />
        ) : error ? (
          <p className="text-xs text-muted-foreground py-2">推广历史加载失败</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">暂无推广记录</p>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <PromotionHistoryCard key={record.promotionId} record={record} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
