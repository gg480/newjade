'use client';

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, Loader2 } from 'lucide-react';
import PhotoPhase, { PhotoDraft as PhotoPhaseDraft } from './photo-phase';
import DraftList, { DraftItem, DraftPhoto, DraftStatus } from './draft-list';
import SingleItemForm, { PhotoDraft as SingleFormPhotoDraft } from './single-item-form';
import QuickEntryMode from './quick-entry-mode';

// ==================== 类型定义 ====================

export type FactoryPhase = 'photo' | 'draft' | 'single' | 'batch' | 'complete';

export interface FactoryModeWrapperProps {
  onClose: () => void;
}

// ==================== 类型转换辅助 ====================

/** 将 PhotoPhase 产出的 PhotoDraft 转换为 DraftList 所需的 DraftPhoto */
function toDraftPhoto(src: PhotoPhaseDraft): DraftPhoto {
  return {
    id: src.id,
    url: src.previewUrl,
    file: src.file,
    isCover: src.isCover,
  };
}

/** 将 DraftPhoto 转换为 SingleItemForm 所需的 PhotoDraft */
function toSingleFormPhoto(src: DraftPhoto): SingleFormPhotoDraft {
  return {
    id: src.id,
    url: src.url,
    file: src.file,
    uploaded: false,
  };
}

/** 从 Draft 中提取照片供 SingleItemForm 使用 */
function extractPhotosForSingleForm(draft: DraftItem): SingleFormPhotoDraft[] {
  return draft.photos.map(toSingleFormPhoto);
}

// ==================== 主组件 ====================

export default function FactoryModeWrapper({ onClose }: FactoryModeWrapperProps) {
  const [phase, setPhase] = useState<FactoryPhase>('photo');
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [editDraft, setEditDraft] = useState<DraftItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ========== Phase 1: 拍照采集 ==========
  const handlePhotoComplete = useCallback((photos: PhotoPhaseDraft[]) => {
    if (photos.length === 0) {
      toast.error('请至少拍摄一张照片');
      return;
    }

    const newDrafts: DraftItem[] = photos.map(p => ({
      id: crypto.randomUUID(),
      photos: [toDraftPhoto(p)],
      status: 'unclassified' as DraftStatus,
    }));

    setDrafts(prev => [...prev, ...newDrafts]);
    setPhase('draft');
  }, []);

  // ========== Phase 2: 草稿列表 ==========
  const handleEditItem = useCallback((draft: DraftItem) => {
    setEditDraft(draft);
    setPhase('single');
  }, []);

  const handleBatchCreate = useCallback(async (_draftIds: string[]) => {
    // 拍照强制校验：检查选中的草稿是否有照片
    const selectedDrafts = drafts.filter(d => _draftIds.includes(d.id));
    const noPhotoDrafts = selectedDrafts.filter(d => d.photos.length === 0);
    if (noPhotoDrafts.length > 0) {
      toast.error(`有 ${noPhotoDrafts.length} 件货品尚未拍照，请返回拍照`);
      return;
    }

    // 只提交已就绪的草稿
    const readyDrafts = selectedDrafts.filter(d => d.status === 'ready');
    if (readyDrafts.length === 0) {
      toast.error('没有已就绪的草稿，请先完成信息填写');
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Replace with real API — 批量提交草稿
      // const result = await itemsApi.batchCreate(readyDrafts.map(d => ({ ... })));
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success(`成功提交 ${readyDrafts.length} 件货品`);
      setDrafts(prev => prev.filter(d => !_draftIds.includes(d.id)));
      if (drafts.length === _draftIds.length) {
        setPhase('complete');
      }
    } catch (error) {
      toast.error('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [drafts]);

  const handleCreateBatch = useCallback(() => {
    setPhase('batch');
  }, []);

  const handleDraftsChange = useCallback((updated: DraftItem[]) => {
    setDrafts(updated);
  }, []);

  // ========== Phase 3: 单品编辑完成回调 ==========
  const handleSingleSubmitted = useCallback(() => {
    // 单品编辑完成，回到草稿列表并标记该草稿为已就绪
    if (editDraft) {
      setDrafts(prev => prev.map(d =>
        d.id === editDraft.id
          ? { ...d, status: 'ready' as DraftStatus }
          : d,
      ));
      setEditDraft(null);
    }
    setPhase('draft');
    toast.success('货品信息已保存');
  }, [editDraft]);

  const handleSingleSubmitAnother = useCallback(() => {
    // 继续录入下一件，重置表单但保留材质/器型
    // 回到草稿列表，让用户选择下一件
    setPhase('draft');
  }, []);

  const handleSingleCancel = useCallback(() => {
    setEditDraft(null);
    setPhase('draft');
  }, []);

  // ========== Phase 4: 批次录货完成回调 ==========
  const handleBatchComplete = useCallback(() => {
    setPhase('draft');
    toast.success('批次录入完成');
  }, []);

  const handleBatchExit = useCallback(() => {
    setPhase('draft');
  }, []);

  // ========== 渲染各阶段 ==========

  // Phase 1: 拍照采集
  if (phase === 'photo') {
    return (
      <PhotoPhase
        onComplete={handlePhotoComplete}
        onCancel={onClose}
        maxPhotos={9}
      />
    );
  }

  // Phase 2: 草稿列表
  if (phase === 'draft') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-zinc-900">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-base font-semibold">工厂模式 · 快速录货</h2>
              <p className="text-xs text-muted-foreground">
                整理草稿并填写信息
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPhase('photo')}
            >
              继续拍照
            </Button>
          </div>
        </div>

        {/* 草稿列表 */}
        <div className="flex-1 overflow-hidden">
          <DraftList
            drafts={drafts}
            onDraftsChange={handleDraftsChange}
            onEditItem={handleEditItem}
            onBatchCreate={handleBatchCreate}
            onCreateBatch={handleCreateBatch}
          />
        </div>

        {/* 全屏加载遮罩 */}
        {submitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-white dark:bg-zinc-900 px-8 py-6 shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">提交中...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Phase 3: 单品编辑
  if (phase === 'single' && editDraft) {
    const defaultMaterial = {
      materialId: editDraft.materialId,
      typeId: editDraft.typeId,
    };
    const hasDefault = editDraft.materialId != null || editDraft.typeId != null;

    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-zinc-900">
        {/* 顶部栏 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleSingleCancel}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <h2 className="text-base font-semibold">编辑货品信息</h2>
            <p className="text-xs text-muted-foreground">
              填写材质、价格等详细信息
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <SingleItemForm
            photos={extractPhotosForSingleForm(editDraft)}
            defaultMaterial={hasDefault ? defaultMaterial : undefined}
            onSubmitted={handleSingleSubmitted}
            onSubmitAnother={handleSingleSubmitAnother}
            onCancel={handleSingleCancel}
          />
        </div>
      </div>
    );
  }

  // Phase 4: 批次录货（连续录入模式）
  if (phase === 'batch') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-zinc-900">
        {/* 顶部栏 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleBatchExit}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回草稿
          </Button>
          <div>
            <h2 className="text-base font-semibold">批次录货</h2>
            <p className="text-xs text-muted-foreground">
              创建批次后连续录入
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <QuickEntryMode
            onComplete={handleBatchComplete}
            onExit={handleBatchExit}
          />
        </div>
      </div>
    );
  }

  // Phase: complete — 完成页
  if (phase === 'complete') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 p-8">
        <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-6 mb-4">
          <svg className="h-12 w-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">全部货品已录入完成！</h2>
        <p className="text-sm text-muted-foreground mb-6">
          所有草稿已提交到库存系统
        </p>
        <Button
          onClick={onClose}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          返回库存列表
        </Button>
      </div>
    );
  }

  // 安全兜底
  return null;
}
