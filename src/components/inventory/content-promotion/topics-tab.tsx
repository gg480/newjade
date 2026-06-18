'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { promotionApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { LoadingSkeleton } from '../shared';
import type { ContentTopic, TopicStatus, TopicSource, TopicType } from '@/types/promotion';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Star, Plus, Lightbulb, FileText, Check, X, ChevronLeft, ChevronRight, Search, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

// 选题状态徽章映射：颜色按业务语义区分（草稿灰/待审蓝/通过绿/拒绝红）
const TOPIC_STATUS_MAP: Record<TopicStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  analyzed: { label: '已分析', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  pending: { label: '待审核', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  archived: { label: '已归档', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const TOPIC_SOURCE_MAP: Record<TopicSource, string> = {
  ai: 'AI生成',
  manual: '手动创建',
  web_fetch: '网络抓取',
};

const TOPIC_TYPE_MAP: Record<TopicType, string> = {
  product: '商品',
  category: '品类',
  season: '季节',
  trend: '趋势',
};

// 星级评分组件：支持只读和可点击两种模式
function StarRating({ value, onChange, size = 'sm' }: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md';
}) {
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={cn('transition-transform', onChange && 'cursor-pointer hover:scale-110', !onChange && 'cursor-default')}
          disabled={!onChange}
        >
          <Star
            className={cn(
              starSize,
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-gray-300 dark:text-gray-600'
            )}
          />
        </button>
      ))}
    </div>
  );
}

// 选题卡片：展示标题/来源/状态/评分/关键词/关联商品，含审核与生成文案操作
function TopicCard({ topic, onRate, onReview, onGenerate }: {
  topic: ContentTopic;
  onRate: (topic: ContentTopic) => void;
  onReview: (topic: ContentTopic, action: 'approve' | 'reject') => void;
  onGenerate: (topic: ContentTopic) => void;
}) {
  const statusInfo = TOPIC_STATUS_MAP[topic.status];
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{topic.title}</h4>
            {topic.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topic.description}</p>
            )}
          </div>
          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />{TOPIC_SOURCE_MAP[topic.source]}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />{TOPIC_TYPE_MAP[topic.topicType]}
          </span>
          {topic.itemIds && topic.itemIds.length > 0 && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />{topic.itemIds.length} 个商品
            </span>
          )}
        </div>

        {topic.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topic.keywords.map((kw, i) => (
              <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">评分:</span>
          <StarRating value={topic.rating || 0} onChange={() => onRate(topic)} />
          {topic.ratingNote && (
            <span className="text-xs text-muted-foreground italic truncate">「{topic.ratingNote}」</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          {topic.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50" onClick={() => onReview(topic, 'approve')}>
                <Check className="h-3 w-3 mr-1" />通过
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => onReview(topic, 'reject')}>
                <X className="h-3 w-3 mr-1" />拒绝
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => onGenerate(topic)}>
            <FileText className="h-3 w-3 mr-1" />生成文案
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 筛选栏：状态/来源/评分范围/关键词 + 新建按钮
function TopicsFilterBar({ filters, setFilters, onSearch, onReset, onCreate }: {
  filters: { status: string; source: string; minRating: string; maxRating: string; keyword: string };
  setFilters: React.Dispatch<React.SetStateAction<{ status: string; source: string; minRating: string; maxRating: string; keyword: string }>>;
  onSearch: () => void;
  onReset: () => void;
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">关键词</Label>
            <Input placeholder="搜索标题..." value={filters.keyword}
              onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">状态</Label>
            <Select value={filters.status || 'all'}
              onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="analyzed">已分析</SelectItem>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">来源</Label>
            <Select value={filters.source || 'all'}
              onValueChange={v => setFilters(f => ({ ...f, source: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部来源" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                <SelectItem value="ai">AI生成</SelectItem>
                <SelectItem value="manual">手动创建</SelectItem>
                <SelectItem value="web_fetch">网络抓取</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">评分范围</Label>
            <div className="flex items-center gap-1">
              <Select value={filters.minRating || 'all'}
                onValueChange={v => setFilters(f => ({ ...f, minRating: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="最低" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">不限</SelectItem>
                  {[1, 2, 3, 4, 5].map(r => <SelectItem key={r} value={String(r)}>{r}星</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">—</span>
              <Select value={filters.maxRating || 'all'}
                onValueChange={v => setFilters(f => ({ ...f, maxRating: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="最高" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">不限</SelectItem>
                  {[1, 2, 3, 4, 5].map(r => <SelectItem key={r} value={String(r)}>{r}星</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={onCreate}>
            <Plus className="h-3 w-3 mr-1" />新建选题
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={onSearch}>
              <Search className="h-3 w-3 mr-1" />搜索
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={onReset}>重置</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 新建选题对话框：标题/描述/类型/关键词/关联商品ID
function CreateTopicDialog({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [form, setForm] = useState({
    title: '', description: '', topicType: 'product' as TopicType, keywords: '', itemIds: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: '请输入标题', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
      const itemIds = form.itemIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
      await promotionApi.topics.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        topicType: form.topicType,
        source: 'manual',
        keywords,
        itemIds: itemIds.length > 0 ? itemIds : undefined,
      });
      toast({ title: '创建选题成功' });
      setForm({ title: '', description: '', topicType: 'product', keywords: '', itemIds: '' });
      onSuccess();
    } catch (error) {
      handleError(error, { title: '创建选题失败' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建选题</DialogTitle>
          <DialogDescription>手动创建一个内容选题</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>标题 *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="输入选题标题" />
          </div>
          <div className="space-y-1">
            <Label>描述</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="选题描述（可选）" rows={3} />
          </div>
          <div className="space-y-1">
            <Label>类型</Label>
            <Select value={form.topicType} onValueChange={v => setForm(f => ({ ...f, topicType: v as TopicType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">商品</SelectItem>
                <SelectItem value="category">品类</SelectItem>
                <SelectItem value="season">季节</SelectItem>
                <SelectItem value="trend">趋势</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>关键词</Label>
            <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="多个关键词用逗号分隔" />
          </div>
          <div className="space-y-1">
            <Label>关联商品ID</Label>
            <Input value={form.itemIds} onChange={e => setForm(f => ({ ...f, itemIds: e.target.value }))} placeholder="多个ID用逗号分隔，如: 1,2,3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? '创建中...' : '创建'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 评分对话框：星级选择 + 备注
function RateTopicDialog({ topic, onClose, onSubmit }: {
  topic: ContentTopic;
  onClose: () => void;
  onSubmit: (rating: number, note: string) => void;
}) {
  const [rating, setRating] = useState(topic.rating || 0);
  const [note, setNote] = useState(topic.ratingNote || '');

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>评分</DialogTitle>
          <DialogDescription>{topic.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>星级评分</Label>
            <div className="flex items-center gap-2">
              <StarRating value={rating} onChange={setRating} size="md" />
              <span className="text-sm text-muted-foreground">{rating > 0 ? `${rating}星` : '未评分'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label>备注</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="评分备注（可选）" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSubmit(rating, note)} disabled={rating === 0}>确认评分</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 主组件：选题中心 Tab
export default function TopicsTab() {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', source: '', minRating: '', maxRating: '', keyword: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [rateTopic, setRateTopic] = useState<ContentTopic | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // 加载选题列表：依赖分页/筛选/刷新键
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = { page: pagination.page, limit: pagination.limit };
        if (filters.status) params.status = filters.status;
        if (filters.source) params.source = filters.source;
        if (filters.minRating) params.minRating = Number(filters.minRating);
        if (filters.maxRating) params.maxRating = Number(filters.maxRating);
        if (filters.keyword) params.keyword = filters.keyword;
        const data = await promotionApi.topics.list(params);
        if (!cancelled) {
          setTopics(data.items || []);
          setPagination(prev => ({ ...prev, total: data.pagination?.total || 0, pages: data.pagination?.pages || 0 }));
        }
      } catch (error) {
        if (!cancelled) handleError(error, { title: '加载选题列表失败' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.limit, refreshKey, filters.status, filters.source, filters.minRating, filters.maxRating, filters.keyword]);

  // 审核处理：通过/拒绝
  const handleReview = useCallback(async (topic: ContentTopic, action: 'approve' | 'reject') => {
    try {
      await promotionApi.topics.review(topic.id, { action });
      toast({ title: action === 'approve' ? '审核通过' : '已拒绝', description: `选题「${topic.title}」${action === 'approve' ? '已通过审核' : '已被拒绝'}` });
      refresh();
    } catch (error) {
      handleError(error, { title: '审核操作失败' });
    }
  }, [toast, handleError, refresh]);

  // 生成文案：P0 阶段仅提示，不实现功能
  const handleGenerate = useCallback((topic: ContentTopic) => {
    toast({ title: '功能开发中', description: `为选题「${topic.title}」生成文案的功能将在后续版本实现` });
  }, [toast]);

  // 提交评分
  const submitRate = useCallback(async (rating: number, note: string) => {
    if (!rateTopic) return;
    try {
      await promotionApi.topics.rate(rateTopic.id, { rating, ratingNote: note || undefined });
      toast({ title: '评分成功' });
      setRateTopic(null);
      refresh();
    } catch (error) {
      handleError(error, { title: '评分失败' });
    }
  }, [rateTopic, toast, handleError, refresh]);

  const resetFilters = useCallback(() => {
    setFilters({ status: '', source: '', minRating: '', maxRating: '', keyword: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  if (loading && topics.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <TopicsFilterBar
        filters={filters}
        setFilters={setFilters}
        onSearch={() => { setPagination(p => ({ ...p, page: 1 })); refresh(); }}
        onReset={resetFilters}
        onCreate={() => setShowCreate(true)}
      />

      {topics.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无选题数据</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map(topic => (
              <TopicCard key={topic.id} topic={topic} onRate={setRateTopic} onReview={handleReview} onGenerate={handleGenerate} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">共 {pagination.total} 条</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
                <ChevronLeft className="h-4 w-4" />上一页
              </Button>
              <span className="text-sm">{pagination.page} / {pagination.pages || 1}</span>
              <Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
                下一页<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <CreateTopicDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); refresh(); }} />
      {rateTopic && <RateTopicDialog topic={rateTopic} onClose={() => setRateTopic(null)} onSubmit={submitRate} />}
    </div>
  );
}
