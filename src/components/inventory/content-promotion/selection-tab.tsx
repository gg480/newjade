'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { promotionApi } from '@/lib/api';
import { toast } from 'sonner';
import { LoadingSkeleton } from '../shared';
import type { ProductScore, SceneType, SelectionParams, FestivalTimelineEntry } from '@/types/promotion';
import { SCENE_LABELS } from '@/types/promotion';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Lightbulb, Sparkles, ShoppingBag, Gift, BookOpen, Star,
  ChevronLeft, ChevronRight, Package, Eye, RefreshCw, FileText,
  Calendar, Clock, Tag, DollarSign, Heart, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 场景配置：图标 + 描述
const SCENE_CONFIG: Record<SceneType, { icon: React.ElementType; description: string; color: string }> = {
  new_arrival: { icon: Sparkles, description: '最新入库的商品，适合做新品开箱、首发推荐', color: 'text-blue-600' },
  clearance:   { icon: ShoppingBag, description: '库存时间较长的商品，以价格优势吸引用户', color: 'text-orange-600' },
  content:     { icon: Lightbulb, description: '视觉素材丰富的商品，适合做种草内容', color: 'text-emerald-600' },
  festival:    { icon: Gift, description: '送礼属性强的商品，紧贴节日消费热点', color: 'text-red-600' },
  knowledge:   { icon: BookOpen, description: '有讲头的材质/工艺，适合做知识科普内容', color: 'text-purple-600' },
};

// 节日类型中文
const FESTIVAL_TYPE_LABELS: Record<string, string> = {
  traditional: '传统节日',
  modern: '现代节日',
  commercial: '商业节点',
  seasonal: '季节性消费',
};

// ========== 场景选择器 ==========
function SceneSelector({ selected, onChange }: { selected: SceneType; onChange: (s: SceneType) => void }) {
  const scenes = Object.entries(SCENE_CONFIG) as Array<[SceneType, typeof SCENE_CONFIG[SceneType]]>;
  return (
    <Card>
      <CardContent className="p-4">
        <Label className="text-xs text-muted-foreground mb-3 block">选择推广场景</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {scenes.map(([key, cfg]) => {
            const Icon = cfg.icon;
            const isActive = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all',
                  isActive
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50',
                )}
              >
                <Icon className={cn('h-5 w-5', cfg.color)} />
                <span className="text-xs font-medium">{SCENE_LABELS[key]}</span>
                <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{cfg.description}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ========== 节日信息面板（仅在 festival 场景显示） ==========
function FestivalInfoPanel({ festivals, loading }: {
  festivals: FestivalTimelineEntry[];
  loading: boolean;
}) {
  if (loading) return <div className="h-32 bg-muted/30 rounded-lg animate-pulse" />;
  if (festivals.length === 0) return null;

  return (
    <div className="space-y-3">
      {festivals.map((f, idx) => {
        const isNow = f.daysUntil <= f.leadDays; // 在预热期内
        const isUrgent = f.daysUntil <= 7; // 7天内
        const dateLabel = `${f.month}月${f.day}日`;

        return (
          <Card key={f.id} className={cn('border-l-4', isUrgent ? 'border-l-red-500' : 'border-l-emerald-500')}>
            <CardContent className="p-4 space-y-3">
              {/* 头部：节日名称 + 倒计时 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-red-500" />
                  <div>
                    <h3 className="font-semibold text-base">{f.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{dateLabel}</span>
                      <Badge variant="outline" className="text-[10px]">{FESTIVAL_TYPE_LABELS[f.type]}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('text-lg font-bold', isUrgent ? 'text-red-600' : 'text-emerald-600')}>
                    {f.daysUntil > 0 ? `${f.daysUntil}天` : '进行中'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {f.daysUntil <= f.leadDays ? '预热期' : '尚早'} · 持续{f.duration}天
                  </div>
                </div>
              </div>

              {/* 描述+文化背景 */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{f.description}</p>
                <p className="text-xs italic border-l-2 border-muted pl-2">{f.culturalBackground}</p>
              </div>

              {/* 送礼场景 */}
              {f.giftSuggestions.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Heart className="h-3 w-3 text-red-400" />
                  <span className="text-muted-foreground">送礼场景：</span>
                  {f.giftSuggestions.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              )}

              {/* 推荐材质 */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Tag className="h-3 w-3 text-amber-500" />
                <span className="text-muted-foreground">推荐材质：</span>
                {f.recommendedMaterials.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-amber-200 text-amber-700">{m}</Badge>
                ))}
                <span className="text-muted-foreground ml-2">推荐器型：</span>
                {f.recommendedTypes.map((t, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>

              {/* 价格区间 */}
              <div className="flex items-center gap-2 text-xs">
                <DollarSign className="h-3 w-3 text-green-500" />
                <span className="text-muted-foreground">建议价位：</span>
                <span className="font-medium">¥{f.priceRange[0].toLocaleString()} - ¥{f.priceRange[1].toLocaleString()}</span>
              </div>

              {/* 营销关键词 */}
              <div className="flex flex-wrap gap-1">
                {f.marketingKeywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300">{kw}</Badge>
                ))}
              </div>

              {/* 选题模板 */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">选题模板（点击复制）</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {f.topicTemplates.map((tmpl, i) => (
                    <button
                      key={i}
                      type="button"
                      className="text-xs text-left p-2 rounded border border-dashed border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(tmpl);
                        toast.success('选题模板已复制');
                      }}
                    >
                      {tmpl
                        .replace('{name}', f.recommendedTypes[0] || '首饰')
                        .replace('{priceRange}', `¥${f.priceRange[0]}-¥${f.priceRange[1]}`)
                        .replace('{num}', String(idx * 3 + i + 1))}
                    </button>
                  ))}
                </div>
              </div>

              {/* 分割线（非最后一个） */}
              {idx < festivals.length - 1 && <Separator />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ========== 商品卡片 ==========
function ProductCard({ item, selected, onToggleSelect, onGenerateTopic }: {
  item: ProductScore;
  selected: boolean;
  onToggleSelect: () => void;
  onGenerateTopic: (item: ProductScore) => void;
}) {
  const thumb = item.images[0];
  const scoreColor = item.score >= 80 ? 'text-emerald-600' : item.score >= 60 ? 'text-amber-600' : 'text-gray-500';

  return (
    <Card className={cn('hover:shadow-md transition-shadow', selected && 'ring-2 ring-emerald-500')}>
      <CardContent className="p-0">
        <div className="relative h-40 bg-muted rounded-t-lg overflow-hidden">
          {thumb ? (
            <img src={`/api/content/images/${thumb}`} alt={item.name || item.sku} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground/40">
              <Eye className="h-8 w-8" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Badge className={cn('text-xs font-bold', item.score >= 80 ? 'bg-emerald-600' : 'bg-amber-600')}>
              {item.score}分
            </Badge>
          </div>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <h4 className="text-sm font-medium truncate flex-1" title={item.name || item.sku}>{item.name || item.sku}</h4>
            <span className="text-xs text-muted-foreground shrink-0 font-mono">{item.sku}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.materialName && <Badge variant="outline" className="text-[10px]">{item.materialName}</Badge>}
            {item.typeName && <Badge variant="outline" className="text-[10px]">{item.typeName}</Badge>}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-red-600">¥{item.sellingPrice?.toLocaleString()}</span>
            {item.costPrice != null && (
              <span className="text-xs text-muted-foreground line-through">¥{item.costPrice.toLocaleString()}</span>
            )}
          </div>

          {item.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.reasons.slice(0, 3).map((r, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 border-t">
            <Button size="sm" variant={selected ? 'default' : 'outline'} className="h-7 text-xs flex-1"
              onClick={onToggleSelect}>
              <Package className="h-3 w-3 mr-1" />
              {selected ? '已选' : '选品'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onGenerateTopic(item)}>
              <FileText className="h-3 w-3 mr-1" />选题
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== 生成选题对话框 ==========
function GenerateTopicDialog({ item, festival, open, onOpenChange, onSuccess }: {
  item: ProductScore | null;
  festival: FestivalTimelineEntry | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  if (!item) return null;
  const defaultTitle = festival
    ? `${festival.name}推荐｜${item.name || item.sku}`
    : `「${item.name || item.sku}」内容选题`;
  const [title, setTitle] = useState(defaultTitle);
  const [submitting, setSubmitting] = useState(false);

  // 当选品切换时更新默认标题
  useEffect(() => {
    setTitle(defaultTitle);
  }, [defaultTitle]);

  async function handleSubmit() {
    if (!title.trim() || !item) return;
    setSubmitting(true);
    try {
      await promotionApi.topics.create({
        title: title.trim(),
        topicType: 'product',
        source: 'manual',
        keywords: (item.tags || []).concat(
          item.materialName ? [item.materialName] : [],
          festival ? [festival.name] : [],
        ),
        itemIds: [item.itemId],
      });
      toast.success('选题已生成，请到选题中心编辑');
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      toast.error('生成选题失败: ' + (e instanceof Error ? e.message : '未知'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>生成选题</DialogTitle>
          <DialogDescription>
            基于「{item.name || item.sku}」创建内容选题
            {festival && <span className="block text-xs text-red-500 mt-1">当前节日：{festival.name}（{festival.month}月{festival.day}日）</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>选题标题</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          {item.reasons.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">推荐理由</Label>
              <ul className="text-xs text-muted-foreground space-y-1">
                {item.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <Star className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {festival && festival.topicTemplates.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">参考模板</Label>
              <div className="flex flex-wrap gap-1">
                {festival.topicTemplates.slice(0, 3).map((t, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] cursor-pointer"
                    onClick={() => {
                      const filled = t
                        .replace('{name}', item.name || item.sku)
                        .replace('{priceRange}', festival.priceRange.join('-'))
                        .replace('{num}', String(i + 1));
                      setTitle(filled);
                    }}
                  >
                    {t.slice(0, 20)}...
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? '生成中...' : '生成选题'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== 主组件：选品 Tab ==========
export default function SelectionTab() {
  const [scene, setScene] = useState<SceneType>('content');
  const [items, setItems] = useState<ProductScore[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generateItem, setGenerateItem] = useState<ProductScore | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // 节日场景相关状态
  const [festivals, setFestivals] = useState<FestivalTimelineEntry[]>([]);
  const [loadingFestivals, setLoadingFestivals] = useState(false);

  // 加载选品列表
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const params: SelectionParams = { scene, page: pagination.page, limit: pagination.limit };
        const data = await promotionApi.selection.list(params);
        if (!cancelled) {
          setItems(data.items || []);
          setPagination(prev => ({ ...prev, total: data.pagination?.total || 0, pages: data.pagination?.pages || 0 }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[SelectionTab] loadData failed:', error);
          toast.error('加载选品结果失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [scene, pagination.page, pagination.limit, refreshKey]);

  // 节日场景下加载节日数据
  useEffect(() => {
    if (scene !== 'festival') {
      setFestivals([]);
      return;
    }
    let cancelled = false;
    const loadFestivals = async () => {
      setLoadingFestivals(true);
      try {
        const data = await promotionApi.festivals.getTimeline();
        if (!cancelled) setFestivals(data || []);
      } catch (error) {
        console.error('[SelectionTab] loadFestivals failed:', error);
      } finally {
        if (!cancelled) setLoadingFestivals(false);
      }
    };
    loadFestivals();
    return () => { cancelled = true; };
  }, [scene, refreshKey]);

  // 切换场景时重置
  const handleSceneChange = useCallback((s: SceneType) => {
    setScene(s);
    setPagination(p => ({ ...p, page: 1 }));
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGenSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // 当前活跃的节日（选中的或排最前的）
  const activeFestival = festivals[0] || null;

  if (loading && items.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* 场景选择器 */}
      <SceneSelector selected={scene} onChange={handleSceneChange} />

      {/* 节日信息面板（仅 festival 场景） */}
      {scene === 'festival' && (
        <FestivalInfoPanel festivals={festivals} loading={loadingFestivals} />
      )}

      {/* 统计和操作行 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          共 {pagination.total} 件商品
          {selectedIds.size > 0 && (
            <span className="ml-2 text-emerald-600 font-medium">已选 {selectedIds.size} 件</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />刷新评分
          </Button>
        </div>
      </div>

      {/* 商品卡片网格 */}
      {items.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">当前场景暂无推荐商品</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map(item => (
              <ProductCard
                key={item.itemId}
                item={item}
                selected={selectedIds.has(item.itemId)}
                onToggleSelect={() => toggleSelect(item.itemId)}
                onGenerateTopic={setGenerateItem}
              />
            ))}
          </div>
          {/* 分页 */}
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

      {/* 生成选题对话框（节日场景下携带节日上下文） */}
      <GenerateTopicDialog
        item={generateItem}
        festival={activeFestival}
        open={!!generateItem}
        onOpenChange={v => { if (!v) setGenerateItem(null); }}
        onSuccess={handleGenSuccess}
      />
    </div>
  );
}
