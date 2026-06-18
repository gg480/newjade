'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { promotionApi } from '@/lib/api';
import { toast } from 'sonner';
import type { ContentDraft, PromotionChannel, CreatePromotionRequest } from '@/types/promotion';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  }>({
    contentId: '',
    channel: 'xiaohongshu',
    scheduledAt: '',
  });

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
      setForm({ contentId: '', channel: 'xiaohongshu', scheduledAt: '' });
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
