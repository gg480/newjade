'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit3, CheckSquare, Square, Image, Upload, SlidersHorizontal, Loader2 } from 'lucide-react';
import BatchSettingsPanel, { BatchSettings } from './batch-settings';

// ==================== 类型定义 ====================

/** 草稿状态 */
export type DraftStatus = 'unclassified' | 'classified' | 'priced' | 'ready';

/** 草稿照片引用 */
export interface DraftPhoto {
  id: string;
  url: string;      // blob URL 或已上传路径
  file?: File;      // 原始文件（仅 localStorage 加载时会丢失）
  isCover?: boolean;
}

/** 草稿项 —— 完整描述一个待录入的货品草稿 */
export interface DraftItem {
  id: string;
  photos: DraftPhoto[];
  status: DraftStatus;
  materialId?: number;
  typeId?: number;
  supplierId?: number;
  purchaseDate?: string;
  costPrice?: number;
  sellingPrice?: number;
  materialName?: string;
  typeName?: string;
  supplierName?: string;
}

export interface DraftListProps {
  /** 当前所有草稿 */
  drafts: DraftItem[];
  /** 草稿列表变化回调（选中/批量设置等操作触发） */
  onDraftsChange: (drafts: DraftItem[]) => void;
  /** 点击编辑单条草稿 */
  onEditItem: (draft: DraftItem) => void;
  /** 批量提交已就绪草稿 */
  onBatchCreate: (draftIds: string[]) => Promise<void>;
  /** 切换到批次创建模式 */
  onCreateBatch: () => void;
}

// ==================== 状态辅助 ====================

const STATUS_LABELS: Record<DraftStatus, string> = {
  unclassified: '未分类',
  classified: '已设置材质',
  priced: '已设置价格',
  ready: '已就绪',
};

const STATUS_COLORS: Record<DraftStatus, string> = {
  unclassified:
    'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  classified:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  priced:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  ready:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

// ==================== 组件 ====================

export default function DraftList({
  drafts,
  onDraftsChange,
  onEditItem,
  onBatchCreate,
  onCreateBatch,
}: DraftListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSettingsOpen, setBatchSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ---- 统计 ----
  const totalCount = drafts.length;
  const organizedCount = drafts.filter(d => d.status !== 'unclassified').length;
  const readyCount = drafts.filter(d => d.status === 'ready').length;
  const allSelected = totalCount > 0 && selectedIds.size === totalCount;

  // ---- 选中操作 ----

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map(d => d.id)));
    }
  }, [drafts, allSelected]);

  // ---- 批量设置 ----

  const handleBatchApply = useCallback((settings: BatchSettings) => {
    if (selectedIds.size === 0) return;

    const updatedDrafts = drafts.map(d => {
      if (!selectedIds.has(d.id)) return d;

      const updated = { ...d };
      let changed = false;

      if (settings.materialId != null) {
        updated.materialId = settings.materialId;
        changed = true;
      }
      if (settings.typeId != null) {
        updated.typeId = settings.typeId;
        changed = true;
      }
      if (settings.supplierId != null) {
        updated.supplierId = settings.supplierId;
        changed = true;
      }
      if (settings.purchaseDate != null) {
        updated.purchaseDate = settings.purchaseDate;
        changed = true;
      }

      // 更新状态
      if (changed) {
        if (updated.costPrice != null && updated.costPrice > 0
            && updated.sellingPrice != null && updated.sellingPrice > 0) {
          updated.status = 'ready';
        } else if (updated.costPrice != null || updated.sellingPrice != null) {
          updated.status = 'priced';
        } else {
          updated.status = 'classified';
        }
      }

      return updated;
    });

    onDraftsChange(updatedDrafts);
    setSelectedIds(new Set());
  }, [drafts, selectedIds, onDraftsChange]);

  // ---- 提交 ----

  const handleSubmitAll = useCallback(async () => {
    const readyDrafts = drafts.filter(d => d.status === 'ready');
    if (readyDrafts.length === 0) return;

    setSubmitting(true);
    try {
      await onBatchCreate(readyDrafts.map(d => d.id));
    } finally {
      setSubmitting(false);
    }
  }, [drafts, onBatchCreate]);

  // ---- 封面图 ----

  const getCoverUrl = useCallback((draft: DraftItem): string | null => {
    if (draft.photos.length === 0) return null;
    const cover = draft.photos.find(p => p.isCover) || draft.photos[0];
    return cover.url || null;
  }, []);

  // ---- 空状态 ----
  if (totalCount === 0) {
    return (
      <div className="flex flex-col h-full">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b">
          <div>
            <h2 className="text-base font-semibold">草稿列表</h2>
            <p className="text-xs text-muted-foreground mt-0.5">共 0 件</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-16">
          <Image className="h-14 w-14 mb-3 opacity-25" />
          <p className="text-sm font-medium">暂无草稿</p>
          <p className="text-xs mt-1">请先拍照采集后再来整理</p>
        </div>
      </div>
    );
  }

  // ---- 主渲染 ----
  return (
    <div className="flex flex-col h-full">
      {/* 顶部统计栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b">
        <div>
          <h2 className="text-base font-semibold">草稿列表</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            共 {totalCount} 件 · 已整理 {organizedCount} 件
            {readyCount > 0 && <span className="ml-1">· 已就绪 {readyCount} 件</span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onCreateBatch}
        >
          批次创建
        </Button>
      </div>

      {/* 操作工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
        <button
          type="button"
          onClick={toggleSelectAll}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          {allSelected ? '取消全选' : '全选'}
        </button>

        {selectedIds.size > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              已选 {selectedIds.size} 件
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={() => setBatchSettingsOpen(true)}
            >
              <SlidersHorizontal className="h-3 w-3 mr-1" />
              批量设置
            </Button>
          </>
        )}
      </div>

      {/* 草稿列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border">
          {drafts.map(draft => {
            const coverUrl = getCoverUrl(draft);
            return (
              <div
                key={draft.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* 复选框 */}
                <Checkbox
                  checked={selectedIds.has(draft.id)}
                  onCheckedChange={() => toggleSelect(draft.id)}
                  className="h-4 w-4 flex-shrink-0"
                />

                {/* 缩略图 */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="草稿缩略图"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                      <Image className="h-5 w-5 opacity-40" />
                    </div>
                  )}
                </div>

                {/* 信息区 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">
                      {draft.materialName || draft.typeName
                        ? [draft.materialName, draft.typeName].filter(Boolean).join(' ')
                        : `草稿 ${draft.id.slice(0, 8)}`}
                    </span>
                    <span
                      className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[draft.status]}`}
                    >
                      {STATUS_LABELS[draft.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>{draft.photos.length} 张照片</span>
                    {draft.costPrice != null && draft.costPrice > 0 && (
                      <span>成本 ¥{draft.costPrice.toFixed(0)}</span>
                    )}
                    {draft.sellingPrice != null && draft.sellingPrice > 0 && (
                      <span>售价 ¥{draft.sellingPrice.toFixed(0)}</span>
                    )}
                  </div>
                </div>

                {/* 编辑按钮 */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => onEditItem(draft)}
                  aria-label="编辑草稿"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部提交栏 */}
      {readyCount > 0 && (
        <div className="px-4 py-3 border-t bg-white dark:bg-zinc-900">
          <Button
            type="button"
            className="w-full h-11 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
            disabled={submitting}
            onClick={handleSubmitAll}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                提交中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                全部提交（{readyCount} 件）
              </span>
            )}
          </Button>
        </div>
      )}

      {/* 批量设置弹窗 */}
      <BatchSettingsPanel
        open={batchSettingsOpen}
        onOpenChange={setBatchSettingsOpen}
        selectedCount={selectedIds.size}
        onApply={handleBatchApply}
      />
    </div>
  );
}
