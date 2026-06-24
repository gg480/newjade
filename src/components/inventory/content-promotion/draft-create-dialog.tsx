'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { promotionApi } from '@/lib/api';
import { toast } from 'sonner';
import type { ContentMode, ContentTopic, CreateDraftRequest } from '@/types/promotion';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 文案模式选项
const CONTENT_MODE_OPTIONS: Array<{ value: ContentMode; label: string }> = [
  { value: '种草', label: '种草' },
  { value: '科普', label: '科普' },
  { value: '故事', label: '故事' },
  { value: '对比', label: '对比' },
];

interface DraftCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// 新建文案对话框：标题/正文/标签/文案模式/关联选题
export default function DraftCreateDialog({ open, onOpenChange, onCreated }: DraftCreateDialogProps) {
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    tags: '',
    contentMode: '种草' as ContentMode,
    topicId: '',
  });

  // 加载已通过选题列表，供关联选择
  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const data = await promotionApi.topics.list({ status: 'approved', limit: 100 });
      setTopics(data.items || []);
    } catch (error) {
      console.error('[DraftCreateDialog] loadTopics failed:', error);
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  // 打开时加载选题并重置表单
  useEffect(() => {
    if (open) {
      loadTopics();
      setForm({ title: '', body: '', tags: '', contentMode: '种草', topicId: '' });
    }
  }, [open, loadTopics]);

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error('请输入标题');
      return;
    }
    if (!form.body.trim()) {
      toast.error('请输入正文');
      return;
    }
    setSubmitting(true);
    try {
      const tags = form.tags.split(',').map(k => k.trim()).filter(Boolean);
      const payload: CreateDraftRequest = {
        title: form.title.trim(),
        body: form.body.trim(),
        tags,
        contentMode: form.contentMode,
      };
      if (form.topicId) {
        payload.topicId = form.topicId;
      }
      await promotionApi.contents.create(payload);
      toast.success('文案创建成功');
      onCreated();
    } catch (error) {
      console.error('[DraftCreateDialog] create failed:', error);
      toast.error('创建文案失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建文案</DialogTitle>
          <DialogDescription>手动创建一个内容文案草稿</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* 标题 */}
          <div className="space-y-1">
            <Label>标题 *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="输入文案标题"
            />
          </div>

          {/* 正文 */}
          <div className="space-y-1">
            <Label>正文 *</Label>
            <Textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="输入文案正文内容"
              rows={6}
            />
          </div>

          {/* 标签 */}
          <div className="space-y-1">
            <Label>标签</Label>
            <Input
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="多个标签用逗号分隔，如: 翡翠,手镯,送礼"
            />
          </div>

          {/* 文案模式 */}
          <div className="space-y-1">
            <Label>文案模式</Label>
            <Select value={form.contentMode} onValueChange={v => setForm(f => ({ ...f, contentMode: v as ContentMode }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTENT_MODE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 关联选题（可选） */}
          <div className="space-y-1">
            <Label>关联选题（可选）</Label>
            <Select value={form.topicId || '__none__'} onValueChange={v => setForm(f => ({ ...f, topicId: v === '__none__' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder={loadingTopics ? '加载中...' : '不关联选题'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">不关联选题</SelectItem>
                {topics.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingTopics && topics.length === 0 && (
              <p className="text-xs text-muted-foreground">暂无已通过选题，可先不关联</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
