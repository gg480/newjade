'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Camera, Check, ChevronLeft, ChevronRight } from 'lucide-react';

// ==================== 类型定义 ====================

/** 拍照草稿 —— 照片仅在内存/本地缓存中 */
export interface PhotoDraft {
  id: string;           // 本地临时 ID (uuid)
  file: File;           // 原始文件
  previewUrl: string;   // 本地预览 URL (URL.createObjectURL)
  isCover: boolean;     // 是否是封面
}

export interface PhotoPhaseProps {
  /** 完成拍照，传递草稿列表 */
  onComplete: (photos: PhotoDraft[]) => void;
  /** 取消拍照 */
  onCancel: () => void;
  /** 最大拍照张数，默认 9 */
  maxPhotos?: number;
}

// ==================== 组件 ====================

export default function PhotoPhase({
  onComplete,
  onCancel,
  maxPhotos = 9,
}: PhotoPhaseProps) {
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 清理 object URLs（组件卸载时）
  useEffect(() => {
    const urls = photos.map(p => p.previewUrl);
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拍照处理
  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    // 检查数量上限
    if (photos.length + files.length > maxPhotos) {
      setError(`最多只能拍 ${maxPhotos} 张照片`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const newPhotos: PhotoDraft[] = Array.from(files).map((file, i) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      isCover: photos.length === 0 && i === 0,
    }));

    setPhotos(prev => {
      const updated = [...prev, ...newPhotos];
      setPreviewIndex(updated.length - 1);
      return updated;
    });

    // 清空 input，允许重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [photos.length, maxPhotos]);

  // 删除照片
  const handleDelete = useCallback((deleteId: string) => {
    setPhotos(prev => {
      const idx = prev.findIndex(p => p.id === deleteId);
      if (idx === -1) return prev;

      // 释放内存
      URL.revokeObjectURL(prev[idx].previewUrl);

      const updated = prev.filter(p => p.id !== deleteId);

      // 删除封面时，第一张替补
      if (prev[idx].isCover && updated.length > 0) {
        updated[0] = { ...updated[0], isCover: true };
      }

      // 调整预览索引
      if (previewIndex >= updated.length) {
        setPreviewIndex(Math.max(0, updated.length - 1));
      } else if (previewIndex > idx) {
        setPreviewIndex(previewIndex - 1);
      } else if (previewIndex === idx) {
        setPreviewIndex(Math.min(idx, updated.length - 1));
      }

      return updated;
    });
  }, [previewIndex]);

  // 触发拍照
  const handleTakePhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 完成拍照
  const handleComplete = useCallback(() => {
    if (photos.length === 0) {
      setError('请至少拍摄一张照片');
      return;
    }
    onComplete(photos);
  }, [photos, onComplete]);

  // 当前预览的照片
  const currentPhoto = previewIndex >= 0 && previewIndex < photos.length
    ? photos[previewIndex]
    : null;

  // 没有照片时显示全屏大相机图标
  if (photos.length === 0) {
    return (
      <>
        {/* 全屏暗色背景 */}
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* 顶部栏 */}
          <div className="flex items-center px-4 py-3 text-white">
            <button
              onClick={onCancel}
              className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100 transition-opacity"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
              <span>关闭</span>
            </button>
          </div>

          {/* 中央提示区 */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-zinc-400">
            <Camera className="h-24 w-24" />
            <p className="text-xl">点击下方按钮拍照</p>
            <p className="text-sm text-zinc-600">至少拍摄 1 张，第一张自动设为封面</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mx-4 mb-2 rounded bg-red-600/90 px-4 py-2 text-center text-sm text-white">
              {error}
            </div>
          )}

          {/* 底部操作栏 */}
          <div className="flex items-center justify-center border-t border-zinc-800 bg-zinc-900 px-4 py-6">
            <Button
              onClick={handleTakePhoto}
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-500 bg-zinc-900 p-0 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              aria-label="拍照"
            >
              <Camera className="h-8 w-8" />
            </Button>
          </div>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      </>
    );
  }

  // 有照片时的全屏界面
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100 transition-opacity"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
          <span>关闭</span>
        </button>
        <span className="text-sm font-medium">
          拍照采集 {photos.length > 0 && `· 第 ${previewIndex + 1} 张`}
        </span>
        <div className="w-16" />
      </div>

      {/* 主预览区 */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-900">
        {currentPhoto && (
          <>
            <img
              src={currentPhoto.previewUrl}
              alt={`照片 ${previewIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />

            {/* 封面标记 */}
            {currentPhoto.isCover && (
              <span className="absolute left-3 top-3 rounded bg-emerald-600 px-2 py-0.5 text-xs text-white shadow">
                封面
              </span>
            )}

            {/* 左右切换 */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                  disabled={previewIndex <= 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20"
                  aria-label="上一张"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={() => setPreviewIndex(i => Math.min(photos.length - 1, i + 1))}
                  disabled={previewIndex >= photos.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20"
                  aria-label="下一张"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-600/90 px-4 py-2 text-center text-sm text-white">
          {error}
        </div>
      )}

      {/* 缩略图栏 */}
      <div className="bg-zinc-900/95 px-4 pt-3 pb-2">
        <div className="mb-2 text-center text-xs text-zinc-500">
          已拍 {photos.length} 张
          <span className="mx-1">·</span>
          最多 {maxPhotos} 张
          <span className="mx-1">·</span>
          第 {previewIndex + 1}/{photos.length} 张
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className={`relative flex-shrink-0 cursor-pointer rounded-lg border-2 transition-all ${
                index === previewIndex
                  ? 'border-emerald-400 ring-1 ring-emerald-400/50'
                  : 'border-transparent hover:border-zinc-500'
              }`}
              onClick={() => setPreviewIndex(index)}
            >
              <img
                src={photo.previewUrl}
                alt={`缩略图 ${index + 1}`}
                className="h-16 w-16 rounded-[6px] object-cover"
              />

              {/* 封面星标 */}
              {photo.isCover && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white shadow">
                  ★
                </span>
              )}

              {/* 删除按钮 */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleDelete(photo.id);
                }}
                className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity hover:opacity-100 shadow"
                aria-label="删除照片"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* 添加按钮 */}
          {photos.length < maxPhotos && (
            <button
              onClick={handleTakePhoto}
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-300 transition-colors"
              aria-label="继续拍照"
            >
              <Camera className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-center gap-6 border-t border-zinc-800 bg-zinc-900 px-4 py-4">
        <Button
          onClick={handleTakePhoto}
          variant="outline"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500 p-0 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          aria-label="拍照"
        >
          <Camera className="h-7 w-7" />
        </Button>
        <Button
          onClick={handleComplete}
          disabled={photos.length === 0}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-8 py-3 text-base font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Check className="h-5 w-5" />
          完成拍照，去填信息
        </Button>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
    </div>
  );
}
