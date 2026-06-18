'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { promotionApi } from '@/lib/api';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { LoadingSkeleton } from '../shared';
import type {
  ContentPromotion,
  PromotionChannel,
  PromotionStatus,
  ContentMetric,
  MetricSummary,
  MetricTrendPoint,
} from '@/types/promotion';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { BarChart3, Eye, Heart, Bookmark, MessageCircle, Share2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import MetricsInputDialog from './metrics-input-dialog';

// 渠道中文映射：用于选择器和表格展示
const CHANNEL_MAP: Record<PromotionChannel, string> = {
  xiaohongshu: '小红书',
  wechat: '微信',
  douyin: '抖音',
  weibo: '微博',
  other: '其他',
};

// 状态中文映射 + 徽章配色：按业务语义区分（排期蓝/发布绿/下线灰/归档淡灰）
const STATUS_MAP: Record<PromotionStatus, { label: string; className: string }> = {
  scheduled: { label: '已排期', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  published: { label: '已发布', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  offline: { label: '已下线', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  archived: { label: '已归档', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

// 图表线条颜色：固定配色便于用户辨识各指标
const CHART_COLORS = {
  view: '#3b82f6',    // blue-500 浏览
  like: '#ef4444',    // red-500 点赞
  collect: '#eab308', // yellow-500 收藏
  comment: '#22c55e', // green-500 评论
  share: '#a855f7',   // purple-500 分享
};

// 数据来源中文映射
const DATA_SOURCE_MAP: Record<'browser' | 'manual', string> = {
  browser: '抓取',
  manual: '手动',
};

// 主组件：反馈追踪 Tab
export default function MetricsTab() {
  const { handleError } = useErrorHandler();
  const [promotions, setPromotions] = useState<Array<ContentPromotion & { contentTitle: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [metrics, setMetrics] = useState<ContentMetric[]>([]);
  const [summary, setSummary] = useState<MetricSummary | null>(null);
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // 加载推广列表：拉取所有推广记录供选择，默认选中第一条
  useEffect(() => {
    let cancelled = false;
    const loadPromotions = async () => {
      setLoadingPromotions(true);
      try {
        const data = await promotionApi.promotions.list({ page: 1, limit: 100 });
        if (!cancelled) {
          setPromotions(data.items || []);
          if (data.items && data.items.length > 0) {
            setSelectedId(prev => prev || data.items[0].id);
          }
        }
      } catch (error) {
        if (!cancelled) handleError(error, { title: '加载推广列表失败' });
      } finally {
        if (!cancelled) setLoadingPromotions(false);
      }
    };
    loadPromotions();
    return () => { cancelled = true; };
  }, [handleError]);

  // 选择推广或刷新后加载反馈明细 + 汇总趋势
  useEffect(() => {
    if (!selectedId) {
      setMetrics([]);
      setSummary(null);
      return;
    }
    let cancelled = false;
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [metricsData, summaryData] = await Promise.all([
          promotionApi.metrics.get(selectedId),
          promotionApi.metrics.summary(selectedId),
        ]);
        if (!cancelled) {
          setMetrics(metricsData || []);
          setSummary(summaryData);
        }
      } catch (error) {
        if (!cancelled) handleError(error, { title: '加载反馈数据失败' });
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [selectedId, refreshKey, handleError]);

  if (loadingPromotions) return <LoadingSkeleton />;

  // 空状态：无推广记录时引导用户先创建推广
  if (promotions.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">暂无推广记录，请先在「推广管理」中创建推广</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 推广选择器 + 录入按钮 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">选择推广记录</label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="请选择推广记录" /></SelectTrigger>
                <SelectContent>
                  {promotions.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.contentTitle} - {CHANNEL_MAP[p.channel]} - {STATUS_MAP[p.status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowInput(true)} disabled={!selectedId}>
              <Plus className="h-4 w-4 mr-1" />录入数据
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数值汇总卡片 */}
      {loadingData ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <MetricSummaryCards summary={summary} />
      )}

      {/* 趋势图 */}
      <MetricTrendChart trend={summary?.trend || []} loading={loadingData} />

      {/* 反馈记录表格 */}
      <MetricTable metrics={metrics} loading={loadingData} />

      {/* 手动录入对话框 */}
      <MetricsInputDialog
        open={showInput}
        onOpenChange={setShowInput}
        promotionId={selectedId}
        onSaved={refresh}
      />
    </div>
  );
}

// 数值汇总卡片行：总浏览/总点赞/总收藏/总评论/总分享
function MetricSummaryCards({ summary }: { summary: MetricSummary | null }) {
  const cards = [
    { label: '总浏览', value: summary?.totalViews ?? 0, icon: Eye, color: 'text-blue-600' },
    { label: '总点赞', value: summary?.totalLikes ?? 0, icon: Heart, color: 'text-red-600' },
    { label: '总收藏', value: summary?.totalCollects ?? 0, icon: Bookmark, color: 'text-yellow-600' },
    { label: '总评论', value: summary?.totalComments ?? 0, icon: MessageCircle, color: 'text-green-600' },
    { label: '总分享', value: summary?.totalShares ?? 0, icon: Share2, color: 'text-purple-600' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <Icon className={cn('h-4 w-4', c.color)} />
              </div>
              <div className={cn('text-2xl font-bold mt-2', c.color)}>
                {c.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// 趋势图：Recharts LineChart，5 条线对应 5 个指标
function MetricTrendChart({ trend, loading }: {
  trend: MetricTrendPoint[];
  loading: boolean;
}) {
  // X 轴日期格式化：截取前 10 位（YYYY-MM-DD），避免时间过长挤压刻度
  const formatDateTick = (v: string | number): string => String(v).slice(0, 10);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>反馈趋势</CardTitle></CardHeader>
        <CardContent><div className="h-72 bg-muted/30 rounded-lg animate-pulse" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>反馈趋势</CardTitle></CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">暂无趋势数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatDateTick} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={formatDateTick} />
              <Legend />
              <Line type="monotone" dataKey="viewCount" name="浏览" stroke={CHART_COLORS.view} dot={false} />
              <Line type="monotone" dataKey="likeCount" name="点赞" stroke={CHART_COLORS.like} dot={false} />
              <Line type="monotone" dataKey="collectCount" name="收藏" stroke={CHART_COLORS.collect} dot={false} />
              <Line type="monotone" dataKey="commentCount" name="评论" stroke={CHART_COLORS.comment} dot={false} />
              <Line type="monotone" dataKey="shareCount" name="分享" stroke={CHART_COLORS.share} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// 反馈记录表格：按时间倒序展示每次录入/抓取的明细
function MetricTable({ metrics, loading }: {
  metrics: ContentMetric[];
  loading: boolean;
}) {
  // 按时间倒序排列：最新数据在前
  const sorted = [...metrics].sort(
    (a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime()
  );

  return (
    <Card>
      <CardHeader><CardTitle>反馈记录</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">暂无反馈记录</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>浏览</TableHead>
                  <TableHead>点赞</TableHead>
                  <TableHead>收藏</TableHead>
                  <TableHead>评论</TableHead>
                  <TableHead>分享</TableHead>
                  <TableHead>来源</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(m.syncedAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>{m.viewCount.toLocaleString()}</TableCell>
                    <TableCell>{m.likeCount.toLocaleString()}</TableCell>
                    <TableCell>{m.collectCount.toLocaleString()}</TableCell>
                    <TableCell>{m.commentCount.toLocaleString()}</TableCell>
                    <TableCell>{m.shareCount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{DATA_SOURCE_MAP[m.dataSource]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
