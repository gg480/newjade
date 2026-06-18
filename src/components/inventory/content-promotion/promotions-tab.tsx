'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { promotionApi } from '@/lib/api';
import { toast } from 'sonner';
import { LoadingSkeleton } from '../shared';
import type {
  ContentPromotion,
  PromotionStatus,
  PromotionChannel,
  PromotionListParams,
  PromotionStats,
} from '@/types/promotion';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, Send, Archive, Link2 } from 'lucide-react';

import PromotionCreateDialog from './promotion-create-dialog';

// 渠道中文映射
const CHANNEL_LABELS: Record<PromotionChannel, string> = {
  xiaohongshu: '小红书',
  wechat: '微信',
  douyin: '抖音',
  weibo: '微博',
  other: '其他',
};

// 状态中文映射
const STATUS_LABELS: Record<PromotionStatus, string> = {
  scheduled: '已排期',
  published: '已发布',
  offline: '已下线',
  archived: '已归档',
};

// 状态徽章颜色：按业务语义区分（排期蓝/发布绿/下线灰/归档暗灰）
const STATUS_BADGE_CLASS: Record<PromotionStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  offline: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

const CHANNEL_OPTIONS: Array<{ value: PromotionChannel; label: string }> = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '微信' },
  { value: 'douyin', label: '抖音' },
  { value: 'weibo', label: '微博' },
  { value: 'other', label: '其他' },
];

// 日期格式化：统一中文格式，空值返回 -
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('zh-CN');
  } catch {
    return '-';
  }
}

// 统计卡片：展示各状态数量与总数
function StatsCards({ stats }: { stats: PromotionStats }) {
  const cards: Array<{ key: string; label: string; value: number; className: string }> = [
    { key: 'scheduled', label: '已排期', value: stats.scheduled, className: 'text-blue-600' },
    { key: 'published', label: '已发布', value: stats.published, className: 'text-green-600' },
    { key: 'offline', label: '已下线', value: stats.offline, className: 'text-gray-600' },
    { key: 'archived', label: '已归档', value: stats.archived, className: 'text-gray-500' },
    { key: 'total', label: '总数', value: stats.total, className: 'text-emerald-600' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(c => (
        <Card key={c.key}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={`text-2xl font-semibold mt-1 ${c.className}`}>{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// 筛选栏：状态/渠道筛选 + 创建按钮
function FilterBar({ filters, setFilters, onCreate }: {
  filters: { status: PromotionStatus | ''; channel: PromotionChannel | '' };
  setFilters: React.Dispatch<React.SetStateAction<{ status: PromotionStatus | ''; channel: PromotionChannel | '' }>>;
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">状态</Label>
            <Select value={filters.status || 'all'}
              onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v as PromotionStatus }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="scheduled">已排期</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="offline">已下线</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">渠道</Label>
            <Select value={filters.channel || 'all'}
              onValueChange={v => setFilters(f => ({ ...f, channel: v === 'all' ? '' : v as PromotionChannel }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部渠道" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部渠道</SelectItem>
                {CHANNEL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={onCreate}>
            <Plus className="h-3 w-3 mr-1" />创建推广
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 回填笔记URL对话框：published 状态下填入 externalNoteUrl
function UrlFillDialog({ promotion, onClose, onSubmit }: {
  promotion: ContentPromotion;
  onClose: () => void;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState(promotion.externalNoteUrl || '');
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>回填笔记链接</DialogTitle>
          <DialogDescription>填入发布后的笔记 URL，便于后续追踪反馈</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>笔记 URL</Label>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.xiaohongshu.com/note/..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSubmit(url.trim())} disabled={!url.trim()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 下线对话框：填写下线原因，便于复盘
function OfflineDialog({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>下线推广</DialogTitle>
          <DialogDescription>请填写下线原因，便于后续复盘</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>下线原因</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="如：违规下线、活动结束、内容调整..." rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button variant="destructive" onClick={() => onSubmit(reason.trim())} disabled={!reason.trim()}>确认下线</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 操作按钮：根据状态显示不同操作（scheduled→发布, published→下线+回填URL, offline→归档）
function ActionButtons({ promotion, onPublish, onOffline, onArchive, onFillUrl }: {
  promotion: ContentPromotion;
  onPublish: (p: ContentPromotion) => void;
  onOffline: (p: ContentPromotion) => void;
  onArchive: (p: ContentPromotion) => void;
  onFillUrl: (p: ContentPromotion) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {promotion.status === 'scheduled' && (
        <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50" onClick={() => onPublish(promotion)}>
          <Send className="h-3 w-3 mr-1" />发布
        </Button>
      )}
      {promotion.status === 'published' && (
        <>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onFillUrl(promotion)}>
            <Link2 className="h-3 w-3 mr-1" />回填URL
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => onOffline(promotion)}>
            下线
          </Button>
        </>
      )}
      {promotion.status === 'offline' && (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onArchive(promotion)}>
          <Archive className="h-3 w-3 mr-1" />归档
        </Button>
      )}
    </div>
  );
}

// 推广列表行
function PromotionRow({ promotion, onPublish, onOffline, onArchive, onFillUrl }: {
  promotion: ContentPromotion & { contentTitle: string };
  onPublish: (p: ContentPromotion) => void;
  onOffline: (p: ContentPromotion) => void;
  onArchive: (p: ContentPromotion) => void;
  onFillUrl: (p: ContentPromotion) => void;
}) {
  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-3 py-2 max-w-[200px] truncate" title={promotion.contentTitle}>{promotion.contentTitle}</td>
      <td className="px-3 py-2 whitespace-nowrap">{CHANNEL_LABELS[promotion.channel]}</td>
      <td className="px-3 py-2">
        <Badge className={STATUS_BADGE_CLASS[promotion.status]}>{STATUS_LABELS[promotion.status]}</Badge>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(promotion.scheduledAt)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(promotion.publishedAt)}</td>
      <td className="px-3 py-2 text-xs max-w-[140px]">
        {promotion.externalNoteUrl ? (
          <a href={promotion.externalNoteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate inline-block max-w-[120px] align-bottom">
            {promotion.externalNoteUrl}
          </a>
        ) : <span className="text-muted-foreground">-</span>}
      </td>
      <td className="px-3 py-2">
        <ActionButtons
          promotion={promotion}
          onPublish={onPublish}
          onOffline={onOffline}
          onArchive={onArchive}
          onFillUrl={onFillUrl}
        />
      </td>
    </tr>
  );
}

export default function PromotionsTab() {
  const [promotions, setPromotions] = useState<Array<ContentPromotion & { contentTitle: string }>>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ status: PromotionStatus | ''; channel: PromotionChannel | '' }>({ status: '', channel: '' });
  const [stats, setStats] = useState<PromotionStats>({ scheduled: 0, published: 0, offline: 0, archived: 0, total: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [urlFillTarget, setUrlFillTarget] = useState<ContentPromotion | null>(null);
  const [offlineTarget, setOfflineTarget] = useState<ContentPromotion | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // 加载统计：并行查询各状态总数（limit=1 仅取 pagination.total）
  const loadStats = useCallback(async () => {
    try {
      const statuses: PromotionStatus[] = ['scheduled', 'published', 'offline', 'archived'];
      const results = await Promise.all(
        statuses.map(s => promotionApi.promotions.list({ status: s, page: 1, limit: 1 }))
      );
      const counts = results.map(r => r.pagination?.total || 0);
      setStats({
        scheduled: counts[0],
        published: counts[1],
        offline: counts[2],
        archived: counts[3],
        total: counts[0] + counts[1] + counts[2] + counts[3],
      });
    } catch (error) {
      console.error('[PromotionsTab] loadStats failed:', error);
    }
  }, []);

  // 加载列表：依赖分页/筛选/刷新键
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const params: PromotionListParams = { page: pagination.page, limit: pagination.limit };
        if (filters.status) params.status = filters.status;
        if (filters.channel) params.channel = filters.channel;
        const data = await promotionApi.promotions.list(params);
        if (!cancelled) {
          setPromotions(data.items || []);
          setPagination(prev => ({ ...prev, total: data.pagination?.total || 0, pages: data.pagination?.pages || 0 }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[PromotionsTab] loadData failed:', error);
          toast.error('加载推广列表失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.limit, filters.status, filters.channel, refreshKey]);

  // 统计随刷新键同步更新
  useEffect(() => {
    loadStats();
  }, [refreshKey, loadStats]);

  // 发布：scheduled → published
  const handlePublish = useCallback(async (p: ContentPromotion) => {
    try {
      await promotionApi.promotions.updateStatus(p.id, { status: 'published' });
      toast.success('发布成功');
      refresh();
    } catch (error) {
      console.error('[PromotionsTab] publish failed:', error);
      toast.error('发布失败');
    }
  }, [refresh]);

  // 下线：published → offline（需填写原因）
  const handleOffline = useCallback(async (reason: string) => {
    if (!offlineTarget) return;
    try {
      await promotionApi.promotions.updateStatus(offlineTarget.id, { status: 'offline', offlineReason: reason });
      toast.success('已下线');
      setOfflineTarget(null);
      refresh();
    } catch (error) {
      console.error('[PromotionsTab] offline failed:', error);
      toast.error('下线失败');
    }
  }, [offlineTarget, refresh]);

  // 归档：offline → archived
  const handleArchive = useCallback(async (p: ContentPromotion) => {
    try {
      await promotionApi.promotions.updateStatus(p.id, { status: 'archived' });
      toast.success('已归档');
      refresh();
    } catch (error) {
      console.error('[PromotionsTab] archive failed:', error);
      toast.error('归档失败');
    }
  }, [refresh]);

  // 回填笔记URL：保持 published 状态，仅更新 externalNoteUrl
  const handleFillUrl = useCallback(async (url: string) => {
    if (!urlFillTarget) return;
    try {
      await promotionApi.promotions.updateStatus(urlFillTarget.id, { status: 'published', externalNoteUrl: url });
      toast.success('笔记链接已保存');
      setUrlFillTarget(null);
      refresh();
    } catch (error) {
      console.error('[PromotionsTab] fillUrl failed:', error);
      toast.error('保存链接失败');
    }
  }, [urlFillTarget, refresh]);

  if (loading && promotions.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <StatsCards stats={stats} />
      <FilterBar filters={filters} setFilters={setFilters} onCreate={() => setShowCreate(true)} />

      {promotions.length === 0 ? (
        <div className="text-center py-16">
          <Send className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无推广记录</p>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">文案标题</th>
                    <th className="text-left px-3 py-2 font-medium">渠道</th>
                    <th className="text-left px-3 py-2 font-medium">状态</th>
                    <th className="text-left px-3 py-2 font-medium">计划时间</th>
                    <th className="text-left px-3 py-2 font-medium">发布时间</th>
                    <th className="text-left px-3 py-2 font-medium">笔记链接</th>
                    <th className="text-left px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map(p => (
                    <PromotionRow
                      key={p.id}
                      promotion={p}
                      onPublish={handlePublish}
                      onOffline={setOfflineTarget}
                      onArchive={handleArchive}
                      onFillUrl={setUrlFillTarget}
                    />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
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

      <PromotionCreateDialog open={showCreate} onOpenChange={setShowCreate} onCreated={() => { setShowCreate(false); refresh(); }} />
      {urlFillTarget && <UrlFillDialog promotion={urlFillTarget} onClose={() => setUrlFillTarget(null)} onSubmit={handleFillUrl} />}
      {offlineTarget && <OfflineDialog onClose={() => setOfflineTarget(null)} onSubmit={handleOffline} />}
    </div>
  );
}
