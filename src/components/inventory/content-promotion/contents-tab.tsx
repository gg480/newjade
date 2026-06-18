'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { promotionApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { LoadingSkeleton } from '../shared';
import type { ContentDraft, DraftStatus, ContentMode, ViolationCheckResult } from '@/types/promotion';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, ChevronLeft, ChevronRight, FileText, ShieldAlert, Image as ImageIcon, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

// 文案状态徽章映射：草稿灰/待审蓝/通过绿/拒绝红/已发布绿
const DRAFT_STATUS_MAP: Record<DraftStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  pending_review: { label: '待审核', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  published: { label: '已发布', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
};

// 格式化日期为简短显示
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

// 文案列表项：标题/状态徽章/文案模式/创建时间
function ContentListItem({ draft, selected, onSelect }: {
  draft: ContentDraft;
  selected: boolean;
  onSelect: () => void;
}) {
  const statusInfo = DRAFT_STATUS_MAP[draft.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm truncate flex-1">{draft.title}</h4>
        <Badge className={cn('shrink-0', statusInfo.className)}>{statusInfo.label}</Badge>
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />{draft.contentMode}
        </span>
        <span>·</span>
        <span>{formatDate(draft.createdAt)}</span>
      </div>
    </button>
  );
}

// 违禁词检测结果展示
function ViolationResultDisplay({ result }: { result: ViolationCheckResult }) {
  if (!result.hasViolation) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
        <Check className="h-4 w-4" />
        未检测到违禁词
      </div>
    );
  }
  return (
    <div className="space-y-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm font-medium">
        <ShieldAlert className="h-4 w-4" />
        检测到 {result.violations.length} 个违禁词
      </div>
      <div className="space-y-1">
        {result.violations.map((v, i) => (
          <div key={i} className="text-xs text-red-600 dark:text-red-400">
            <span className="font-medium">「{v.word}」</span>
            {v.suggestion && <span className="ml-1">→ 建议: {v.suggestion}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// 文案详情面板：标题/正文/标签/图片 + 审核操作 + 违禁词检测
function ContentDetail({ draft, onReview, onCheck, violationResult, checking }: {
  draft: ContentDraft;
  onReview: (action: 'approve' | 'reject', note: string) => void;
  onCheck: () => void;
  violationResult: ViolationCheckResult | null;
  checking: boolean;
}) {
  const [reviewNote, setReviewNote] = useState('');
  const statusInfo = DRAFT_STATUS_MAP[draft.status];
  const isPending = draft.status === 'pending_review';

  return (
    <Card className="h-full">
      <CardContent className="p-5 space-y-4 h-full flex flex-col">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold flex-1">{draft.title}</h3>
          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
        </div>

        {/* 元信息 */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>模式: {draft.contentMode}</span>
          <span>·</span>
          <span>版本: v{draft.version}</span>
          <span>·</span>
          <span>创建: {formatDate(draft.createdAt)}</span>
          {draft.aiModel && (
            <>
              <span>·</span>
              <span>AI: {draft.aiModel}</span>
            </>
          )}
        </div>

        {/* 正文 */}
        <div className="flex-1 overflow-auto">
          <Label className="text-xs text-muted-foreground">正文</Label>
          <div className="mt-1 p-3 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-auto">
            {draft.body}
          </div>
        </div>

        {/* 标签 */}
        {draft.tags.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">标签</Label>
            <div className="flex flex-wrap gap-1">
              {draft.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 图片预览 */}
        {(draft.coverImage || draft.images.length > 0) && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">图片</Label>
            <div className="flex flex-wrap gap-2">
              {draft.coverImage && (
                <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted">
                  <img src={`/api/images/${draft.coverImage}`} alt="封面" className="w-full h-full object-cover" />
                </div>
              )}
              {draft.images.map((img, i) => (
                <div key={i} className="w-20 h-20 rounded-lg border overflow-hidden bg-muted">
                  <img src={`/api/images/${img}`} alt={`图片${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 违禁词检测结果 */}
        {violationResult && <ViolationResultDisplay result={violationResult} />}

        {/* 操作区：违禁词检测 + 审核 */}
        <div className="space-y-3 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={onCheck} disabled={checking} className="h-8">
            <ShieldAlert className="h-3.5 w-3.5 mr-1" />
            {checking ? '检测中...' : '违禁词检测'}
          </Button>

          {isPending && (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">审核意见</Label>
                <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  placeholder="输入审核意见（可选）" rows={2} className="text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8"
                  onClick={() => onReview('approve', reviewNote)}>
                  <Check className="h-3.5 w-3.5 mr-1" />通过
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 h-8"
                  onClick={() => onReview('reject', reviewNote)}>
                  <X className="h-3.5 w-3.5 mr-1" />拒绝
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 主组件：文案工坊 Tab
export default function ContentsTab() {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<ContentDraft | null>(null);
  const [violationResult, setViolationResult] = useState<ViolationCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // 加载文案列表
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = { page: pagination.page, limit: pagination.limit };
        if (statusFilter) params.status = statusFilter;
        const data = await promotionApi.contents.list(params);
        if (!cancelled) {
          setDrafts(data.items || []);
          setPagination(prev => ({ ...prev, total: data.pagination?.total || 0, pages: data.pagination?.pages || 0 }));
          // 列表刷新后清空选中的违禁词结果
          setViolationResult(null);
        }
      } catch (error) {
        if (!cancelled) handleError(error, { title: '加载文案列表失败' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.limit, statusFilter, refreshKey]);

  // 选中文案时加载详情
  useEffect(() => {
    if (!selectedId) {
      setSelectedDraft(null);
      return;
    }
    let cancelled = false;
    const loadDetail = async () => {
      try {
        const data = await promotionApi.contents.get(selectedId);
        if (!cancelled) {
          setSelectedDraft(data);
          setViolationResult(null);
        }
      } catch (error) {
        if (!cancelled) handleError(error, { title: '加载文案详情失败' });
      }
    };
    loadDetail();
    return () => { cancelled = true; };
  }, [selectedId]);

  // 审核处理
  const handleReview = useCallback(async (action: 'approve' | 'reject', note: string) => {
    if (!selectedDraft) return;
    try {
      await promotionApi.contents.review(selectedDraft.id, { action, reviewNote: note || undefined });
      toast({ title: action === 'approve' ? '审核通过' : '已拒绝', description: `文案「${selectedDraft.title}」${action === 'approve' ? '已通过审核' : '已被拒绝'}` });
      refresh();
    } catch (error) {
      handleError(error, { title: '审核操作失败' });
    }
  }, [selectedDraft, toast, handleError, refresh]);

  // 违禁词检测
  const handleCheck = useCallback(async () => {
    if (!selectedDraft) return;
    setChecking(true);
    try {
      const result = await promotionApi.contents.check(selectedDraft.id);
      setViolationResult(result);
      if (result.hasViolation) {
        toast({ title: '检测到违禁词', description: `共 ${result.violations.length} 个`, variant: 'destructive' });
      } else {
        toast({ title: '违禁词检测通过', description: '未检测到违禁词' });
      }
    } catch (error) {
      handleError(error, { title: '违禁词检测失败' });
    } finally {
      setChecking(false);
    }
  }, [selectedDraft, toast, handleError]);

  if (loading && drafts.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* 状态筛选 */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">状态筛选</Label>
          <Select value={statusFilter || 'all'} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPagination(p => ({ ...p, page: 1 })); }}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="pending_review">待审核</SelectItem>
              <SelectItem value="approved">已通过</SelectItem>
              <SelectItem value="rejected">已拒绝</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">共 {pagination.total} 条</span>
        </CardContent>
      </Card>

      {/* 左右布局：列表 + 详情 */}
      {drafts.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无文案数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左侧列表 */}
          <Card className="lg:col-span-1">
            <CardContent className="p-2">
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="space-y-1">
                  {drafts.map(draft => (
                    <ContentListItem
                      key={draft.id}
                      draft={draft}
                      selected={selectedId === draft.id}
                      onSelect={() => setSelectedId(draft.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
              {/* 分页 */}
              <div className="flex items-center justify-between p-2 border-t mt-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pagination.page <= 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
                  <ChevronLeft className="h-3 w-3" />上一页
                </Button>
                <span className="text-xs text-muted-foreground">{pagination.page}/{pagination.pages || 1}</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pagination.page >= pagination.pages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
                  下一页<ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 右侧详情 */}
          <div className="lg:col-span-2">
            {selectedDraft ? (
              <ContentDetail
                draft={selectedDraft}
                onReview={handleReview}
                onCheck={handleCheck}
                violationResult={violationResult}
                checking={checking}
              />
            ) : (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-[calc(100vh-350px)] text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">从左侧选择文案查看详情</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
