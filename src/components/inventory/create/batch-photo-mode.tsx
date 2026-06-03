'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { itemsApi } from '@/lib/api';
import type { ItemSummary } from '@/lib/api.types';
import {
  X,
  Camera,
  ChevronLeft,
  ChevronRight,
  Check,
  SkipForward,
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// ==================== 类型定义 ====================

interface BatchPhotoModeProps {
  /** 关闭补图模式 */
  onClose: () => void;
}

/** 货品列表返回中带 coverImage 字段的扩展类型 */
interface ItemWithCover extends ItemSummary {
  coverImage?: string | null;
}

// ==================== 组件 ====================

export default function BatchPhotoMode({ onClose }: BatchPhotoModeProps) {
  // 数据状态
  const [items, setItems] = useState<ItemWithCover[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 照片状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 全局状态
  const [successCount, setSuccessCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== 数据加载 ====================

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // 获取在库货品（最多 200 件）
      const result = await itemsApi.getItems({
        status: 'in_stock',
        size: 200,
        page: 1,
      } as Record<string, string | number | boolean | undefined | null>);

      const rawItems = (result?.items || []) as ItemWithCover[];

      // 前端过滤：只保留无封面图的货品
      const noPhotoItems = rawItems.filter(item => !item.coverImage);

      if (noPhotoItems.length === 0) {
        setLoadError('🎉 所有在库货品都已配有照片！');
        setItems([]);
        setLoading(false);
        return;
      }

      // 最多处理 50 件
      setItems(noPhotoItems.slice(0, 50));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载货品列表失败';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // ==================== 照片操作 ====================

  /** 选择/拍摄照片 */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 释放旧预览 URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError(null);
  }, [previewUrl]);

  /** 触发拍照/选图 */
  const handleTakePhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** 清除已选照片 */
  const handleClearPhoto = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
  }, [previewUrl]);

  // ==================== 保存逻辑 ====================

  /** 保存当前照片并进入下一件 */
  const handleSaveAndNext = useCallback(async () => {
    if (!selectedFile || items.length === 0) return;

    setUploading(true);
    setUploadError(null);

    const currentItem = items[currentIndex];

    try {
      // 使用 itemsApi.uploadImage 上传并关联到货品（POST /api/items/:id/images）
      await itemsApi.uploadImage(currentItem.id, selectedFile);

      // 清理本地预览
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSuccessCount(prev => prev + 1);

      // 是否是最后一件
      if (currentIndex >= items.length - 1) {
        setCompleted(true);
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '上传照片失败';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }, [selectedFile, items, currentIndex, previewUrl]);

  /** 跳过当前件 */
  const handleSkip = useCallback(() => {
    if (currentIndex >= items.length - 1) {
      setCompleted(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      // 清理已选照片
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadError(null);
    }
  }, [currentIndex, items.length, previewUrl]);

  // ==================== 组件卸载时清理 ====================

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ==================== 渲染：加载中 ====================

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">批量补图</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* 加载指示 */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
          <p>正在加载无照片货品...</p>
        </div>
      </div>
    );
  }

  // ==================== 渲染：加载失败或无数据 ====================

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">批量补图</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          {items.length === 0 && loadError.includes('🎉') ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <p className="text-lg text-muted-foreground">{loadError}</p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-16 w-16 text-amber-500" />
              <p className="text-lg text-muted-foreground">{loadError}</p>
              <Button onClick={loadItems} variant="outline" className="mt-2">
                重试加载
              </Button>
            </>
          )}
          <Button onClick={onClose} variant="outline" className="mt-4">
            返回库存列表
          </Button>
        </div>
      </div>
    );
  }

  // ==================== 渲染：全部完成 ====================

  if (completed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">批量补图</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          <h3 className="text-xl font-semibold">全部处理完成！</h3>
          <p className="text-muted-foreground">
            共处理 {items.length} 件，成功补图 {successCount} 件
            {successCount < items.length && `，跳过 ${items.length - successCount} 件`}
          </p>
          <Button onClick={onClose} className="mt-4">
            返回库存列表
          </Button>
        </div>
      </div>
    );
  }

  // ==================== 当前货品 ====================

  const currentItem = items[currentIndex];
  if (!currentItem) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">批量补图</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">没有待补图的货品</p>
        </div>
      </div>
    );
  }

  const total = items.length;
  const currentNum = currentIndex + 1;
  const progressPercent = Math.round((currentIndex / total) * 100);

  // ==================== 主界面 ====================

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ===== 顶部栏 ===== */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="关闭">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold">批量补图</h2>
        <div className="w-8" /> {/* 占位保持居中 */}
      </div>

      {/* ===== 进度指示 ===== */}
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            第 <strong className="text-foreground">{currentNum}</strong>/{total} 件
          </span>
          <span>
            已补 {successCount} 件
            {successCount > 0 && <span className="ml-1 text-emerald-600">✓</span>}
          </span>
        </div>
        {/* 进度条 */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ===== 货品信息区 ===== */}
      <div className="border-b bg-card px-4 py-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted-foreground">
              {currentItem.skuCode}
            </span>
            {currentItem.counter && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                柜 {currentItem.counter}
              </span>
            )}
          </div>
          <p className="text-lg font-medium">
            {currentItem.name || '未命名货品'}
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {currentItem.material?.name && (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {currentItem.material.name}
              </span>
            )}
            {currentItem.type?.name && (
              <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {currentItem.type.name}
              </span>
            )}
            {currentItem.sellingPrice > 0 && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                ¥{currentItem.sellingPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ===== 照片预览/拍照区 ===== */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20 px-4 py-6">
        {previewUrl ? (
          /* 已选照片预览 */
          <div className="relative w-full max-w-xs">
            <img
              src={previewUrl}
              alt="已选照片"
              className="w-full rounded-xl object-cover shadow-lg"
              style={{ maxHeight: '50vh' }}
            />
            <button
              onClick={handleClearPhoto}
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition-colors"
              aria-label="清除照片"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* 未选择照片 - 拍照入口 */
          <div className="flex flex-col items-center gap-4">
            <div
              onClick={handleTakePhoto}
              className="flex h-40 w-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-card text-muted-foreground hover:border-emerald-400 hover:text-emerald-500 transition-all"
            >
              <Camera className="mb-2 h-12 w-12" />
              <span className="text-sm">点击拍照或选图</span>
            </div>
            <p className="text-xs text-muted-foreground">
              支持 JPG / PNG / WebP，单张不超过 10MB
            </p>
          </div>
        )}

        {/* 上传错误提示 */}
        {uploadError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* ===== 底部操作栏 ===== */}
      <div className="border-t bg-card px-4 py-4">
        <div className="flex items-center gap-3">
          {/* 跳过按钮 */}
          <Button
            onClick={handleSkip}
            variant="outline"
            disabled={uploading}
            className="flex items-center gap-1.5"
          >
            <SkipForward className="h-4 w-4" />
            跳过
          </Button>

          {/* 拍照/选图按钮（仅在未选择时显示） */}
          {!previewUrl && (
            <Button
              onClick={handleTakePhoto}
              variant="outline"
              className="flex items-center gap-1.5"
            >
              <Camera className="h-4 w-4" />
              拍照
            </Button>
          )}

          {/* 保存并下一件 */}
          <Button
            onClick={handleSaveAndNext}
            disabled={!selectedFile || uploading}
            className="flex flex-1 items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {currentIndex >= total - 1 ? '保存并完成' : '保存并下一件'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ===== 隐藏的文件输入 ===== */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
