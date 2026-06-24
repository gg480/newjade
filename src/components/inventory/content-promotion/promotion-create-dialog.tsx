'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { promotionApi, itemsApi } from '@/lib/api';
import { toast } from 'sonner';
import type { ContentDraft, PromotionChannel, CreatePromotionRequest } from '@/types/promotion';
import type { ItemSummary as ItemInfo } from '@/lib/api.types';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Package } from 'lucide-react';

// 渠道选项：值与后端枚举对齐，label 为中文展示
const CHANNEL_OPTIONS: Array<{ value: PromotionChannel; label: string }> = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '微信' },
  { value: 'douyin', label: '抖音' },
  { value: 'weibo', label: '微博' },
  { value: 'other', label: '其他' },
];

interface PromotionCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// 创建推广对话框：选择已审核文案 + 渠道 + 计划时间
export default function PromotionCreateDialog({ open, onOpenChange, onCreated }: PromotionCreateDialogProps) {
  const [contents, setContents] = useState<ContentDraft[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    contentId: string;
    channel: PromotionChannel;
    scheduledAt: string;
    itemIds: number[];
  }>({
    contentId: '',
    channel: 'xiaohongshu',
    scheduledAt: '',
    itemIds: [],
  });

  // 商品搜索状态
  const [itemKeyword, setItemKeyword] = useState('');
  const [itemResults, setItemResults] = useState<ItemInfo[]>([]);
  const [searchingItems, setSearchingItems] = useState(false);
  const [showItemResults, setShowItemResults] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 已选商品（用于展示标签），从 form.itemIds + 缓存数据构建
  const [selectedItemCache, setSelectedItemCache] = useState<Map<number, { skuCode: string; name: string | null; materialName?: string | null }>>(new Map());

  // 搜索商品：带 300ms 防抖
  const searchItems = useCallback((keyword: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!keyword.trim()) {
      setItemResults([]);
      setShowItemResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingItems(true);
      try {
        const data = await itemsApi.getItems({ keyword: keyword.trim(), status: 'in_stock', size: 20, page: 1 });
        setItemResults(data.items || []);
        setShowItemResults(true);
      } catch (error) {
        console.error('[PromotionCreateDialog] searchItems failed:', error);
      } finally {
        setSearchingItems(false);
      }
    }, 300);
  }, []);

  // 关键词变化时触发搜索
  useEffect(() => {
    searchItems(itemKeyword);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [itemKeyword, searchItems]);

  // 添加商品到已选列表
  const addItem = useCallback((item: ItemInfo) => {
    setForm(f => {
      if (f.itemIds.includes(item.id)) return f;
      return { ...f, itemIds: [...f.itemIds, item.id] };
    });
    setSelectedItemCache(prev => {
      const next = new Map(prev);
      next.set(item.id, { skuCode: item.skuCode, name: item.name, materialName: item.materialName });
      return next;
    });
  }, []);

  // 从已选列表移除商品
  const removeItem = useCallback((itemId: number) => {
    setForm(f => ({ ...f, itemIds: f.itemIds.filter(id => id !== itemId) }));
  }, []);

  // 加载已审核文案列表：仅 status=approved 的文案可用于推广
  const loadContents = useCallback(async () => {
    setLoadingContents(true);
    try {
      const data = await promotionApi.contents.list({ status: 'approved', limit: 100 });
      setContents(data.items || []);
    } catch (error) {
      console.error('[PromotionCreateDialog] loadContents failed:', error);
      toast.error('加载文案列表失败');
    } finally {
      setLoadingContents(false);
    }
  }, []);

  // 打开时加载文案并重置表单
  useEffect(() => {
    if (open) {
      loadContents();
      setForm({ contentId: '', channel: 'xiaohongshu', scheduledAt: '', itemIds: [] });
      setItemKeyword('');
      setItemResults([]);
      setShowItemResults(false);
      setSelectedItemCache(new Map());
    }
  }, [open, loadContents]);

  async function handleSubmit() {
    if (!form.contentId) {
      toast.error('请选择文案');
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreatePromotionRequest = {
        contentId: form.contentId,
        channel: form.channel,
        itemIds: form.itemIds.length > 0 ? form.itemIds : undefined,
      };
      // 计划时间有值时转为 ISO 字符串传给后端
      if (form.scheduledAt) {
        payload.scheduledAt = new Date(form.scheduledAt).toISOString();
      }
      await promotionApi.promotions.create(payload);
      toast.success('创建推广成功');
      onCreated();
    } catch (error) {
      console.error('[PromotionCreateDialog] create failed:', error);
      toast.error('创建推广失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建推广</DialogTitle>
          <DialogDescription>选择已审核文案，配置发布渠道与计划时间</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>文案 *</Label>
            <Select value={form.contentId} onValueChange={v => setForm(f => ({ ...f, contentId: v }))}>
              <SelectTrigger><SelectValue placeholder={loadingContents ? '加载中...' : '请选择文案'} /></SelectTrigger>
              <SelectContent>
                {contents.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contents.length === 0 && !loadingContents && (
              <p className="text-xs text-muted-foreground">暂无已审核文案，请先在文案工坊审核</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>渠道 *</Label>
            <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v as PromotionChannel }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>计划发布时间</Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">不填则创建为已排期状态，后续手动发布</p>
          </div>

          {/* 关联商品（可选多选） */}
          <div className="space-y-1.5">
            <Label>关联商品（可选）</Label>
            <div className="relative">
              <Input
                placeholder="搜索商品名称/SKU..."
                value={itemKeyword}
                onChange={e => { setItemKeyword(e.target.value); }}
                onFocus={() => { if (itemResults.length > 0) setShowItemResults(true); }}
                onBlur={() => { setTimeout(() => setShowItemResults(false), 200); }}
              />
              {/* 搜索结果下拉 */}
              {showItemResults && itemResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 border rounded-md bg-popover shadow-md max-h-60 overflow-auto">
                  {itemResults.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      disabled={form.itemIds.includes(item.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed border-b last:border-b-0"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{item.skuCode}</span>
                      <span className="mx-2">{item.name || '-'}</span>
                      {item.materialName && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.materialName}</span>
                      )}
                      {form.itemIds.includes(item.id) && (
                        <span className="ml-2 text-xs text-muted-foreground">已选</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {showItemResults && itemResults.length === 0 && itemKeyword.trim() && !searchingItems && (
                <div className="absolute z-10 w-full mt-1 border rounded-md bg-popover shadow-md px-3 py-2 text-sm text-muted-foreground">
                  未找到匹配商品
                </div>
              )}
            </div>
            {/* 已选商品标签 */}
            {form.itemIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.itemIds.map(id => {
                  const info = selectedItemCache.get(id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 text-xs">
                      <Package className="h-3 w-3" />
                      {info ? `${info.skuCode} ${info.name || ''}` : `#${id}`}
                      <button
                        type="button"
                        onClick={() => removeItem(id)}
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingContents}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
