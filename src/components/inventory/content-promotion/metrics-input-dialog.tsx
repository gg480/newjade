'use client';

import React, { useState } from 'react';
import { promotionApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/hooks/use-error-handler';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 手动录入反馈数据对话框：录入某条推广的浏览/点赞/收藏/评论/分享累计值
export default function MetricsInputDialog({
  open,
  onOpenChange,
  promotionId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promotionId: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [form, setForm] = useState({
    viewCount: '',
    likeCount: '',
    collectCount: '',
    commentCount: '',
    shareCount: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // 关闭时清空表单，避免下次打开残留旧值
  function handleOpenChange(v: boolean) {
    if (!v) {
      setForm({ viewCount: '', likeCount: '', collectCount: '', commentCount: '', shareCount: '' });
    }
    onOpenChange(v);
  }

  // 解析非负整数：空串或非法值视为 0，负数截断为 0
  function parseCount(v: string): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  async function handleSubmit() {
    if (!promotionId) {
      toast({ title: '未选择推广记录', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await promotionApi.metrics.create(promotionId, {
        viewCount: parseCount(form.viewCount),
        likeCount: parseCount(form.likeCount),
        collectCount: parseCount(form.collectCount),
        commentCount: parseCount(form.commentCount),
        shareCount: parseCount(form.shareCount),
        dataSource: 'manual',
      });
      toast({ title: '录入成功' });
      setForm({ viewCount: '', likeCount: '', collectCount: '', commentCount: '', shareCount: '' });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      handleError(error, { title: '录入失败' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>录入反馈数据</DialogTitle>
          <DialogDescription>手动录入本次推广的反馈数据（累计值）</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <MetricField label="浏览量" value={form.viewCount}
            onChange={v => setForm(f => ({ ...f, viewCount: v }))} />
          <MetricField label="点赞数" value={form.likeCount}
            onChange={v => setForm(f => ({ ...f, likeCount: v }))} />
          <MetricField label="收藏数" value={form.collectCount}
            onChange={v => setForm(f => ({ ...f, collectCount: v }))} />
          <MetricField label="评论数" value={form.commentCount}
            onChange={v => setForm(f => ({ ...f, commentCount: v }))} />
          <MetricField label="分享数" value={form.shareCount}
            onChange={v => setForm(f => ({ ...f, shareCount: v }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '录入中...' : '确认录入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 数值输入字段：label + number input（min=0，空值占位 0）
function MetricField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}
