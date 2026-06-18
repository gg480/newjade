'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { itemsApi } from '@/lib/api';
import {
  X,
  Camera,
  Check,
  ScanLine,
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
} from 'lucide-react';

// ==================== 常量 ====================

/** 6个拍摄角度定义 */
const ANGLES = [
  { code: 'F', label: '正面俯拍', shortLabel: '正面' },
  { code: 'S', label: '侧面45°', shortLabel: '侧面' },
  { code: 'D', label: '局部特写', shortLabel: '特写' },
  { code: 'X1', label: '特征照1', shortLabel: '特征1' },
  { code: 'X2', label: '特征照2', shortLabel: '特征2' },
  { code: 'X3', label: '特征照3', shortLabel: '特征3' },
] as const;

// ==================== 类型 ====================

interface ScanPhotoModeProps {
  onClose: () => void;
}

interface CapturedPhoto {
  id: string;          // 临时唯一ID
  imageId?: number;    // 上传成功后返回的服务器图片ID（用于删除/重拍）
  angleCode: string;
  angleLabel: string;
  blob: Blob;
  previewUrl: string;
  uploaded: boolean;
}

// ==================== 组件 ====================

export default function ScanPhotoMode({ onClose }: ScanPhotoModeProps) {
  // ── 模式切换：false=扫码拍摄（关联SKU） true=临时拍照（先拍后录） ──
  const [tempMode, setTempMode] = useState(false);

  // ── 扫码状态 ──
  const [skuCode, setSkuCode] = useState('');
  const [itemInfo, setItemInfo] = useState<{ id: number; name: string | null; materialName: string | null; typeName: string | null; skuCode?: string } | null>(null);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [skuLoading, setSkuLoading] = useState(false);

  // ── 摄像头状态 ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // ── 当前选中的角度 ──
  const [currentAngle, setCurrentAngle] = useState<string>(ANGLES[0].code);

  // ── 已拍照片 ──
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── 临时照片列表（用于"先拍后录"模式） ──
  const [tempPhotos, setTempPhotos] = useState<{ url: string; filename: string; angleCode: string }[]>([]);

  // ── 输入框引用（自动聚焦） ──
  const skuInputRef = useRef<HTMLInputElement>(null);

  // ==================== 摄像头控制 ====================

  /** 启动摄像头 */
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch {
      setCameraError('无法启动摄像头，请检查权限或改用文件上传');
    }
  }, []);

  /** 停止摄像头 */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // 组件卸载时关闭摄像头
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ==================== SKU 扫码查询 ====================

  /** 查询SKU */
  const handleLookupSku = useCallback(async () => {
    const sku = skuCode.trim();
    if (!sku) return;

    setSkuLoading(true);
    setSkuError(null);
    setItemInfo(null);
    setPhotos([]);
    setUploadError(null);

    try {
      const item = await itemsApi.lookupBySku(sku);
      setItemInfo(item);
      // 查到后自动启动摄像头
      if (!cameraReady) {
        startCamera();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '查询失败';
      setSkuError(msg);
    } finally {
      setSkuLoading(false);
    }
  }, [skuCode, cameraReady, startCamera]);

  /** 扫码输入框回车/变化处理 */
  const handleSkuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookupSku();
    }
  }, [handleLookupSku]);

  // ==================== 拍照 ====================

  /** 从摄像头截取一帧 */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('截图失败'));
      }, 'image/jpeg', 0.92);
    });
  }, []);

  /** 点击拍照 */
  const handleCapture = useCallback(async () => {
    // 扫码模式需要已查到货品
    if (!tempMode && !itemInfo) return;

    try {
      const blob = await captureFrame();
      if (!blob) {
        setUploadError('无法截取画面，请检查摄像头');
        return;
      }

      const angle = ANGLES.find(a => a.code === currentAngle)!;
      const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const previewUrl = URL.createObjectURL(blob);

      if (tempMode) {
        // 临时模式：上传到临时目录，不关联SKU
        setUploadingId(photoId);
        setUploadError(null);
        try {
          const file = new File([blob], `temp_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/images/upload', { method: 'POST', body: formData });
          const json = await res.json();
          if (json.code === 0) {
            setTempPhotos(prev => [...prev, { url: json.data.url, filename: json.data.url.split('/').pop() || '', angleCode: currentAngle }]);
          }
        } catch {
          setUploadError('临时照片上传失败');
        } finally {
          setUploadingId(null);
        }
        // 临时模式也加到已拍列表展示
        setPhotos(prev => [...prev, { id: photoId, angleCode: currentAngle, angleLabel: angle.label, blob, previewUrl, uploaded: true }]);
      } else {
        // 扫码模式：关联SKU上传
        const newPhoto: CapturedPhoto = {
          id: photoId,
          angleCode: currentAngle,
          angleLabel: angle.label,
          blob,
          previewUrl,
          uploaded: false,
        };

        setPhotos(prev => [...prev, newPhoto]);
        setUploadError(null);

        await uploadPhoto(photoId, blob, currentAngle);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '拍照失败';
      setUploadError(msg);
    }
  }, [itemInfo, currentAngle, captureFrame, tempMode]);

  /** 上传单张照片 */
  const uploadPhoto = useCallback(async (photoId: string, blob: Blob, angleCode: string) => {
    if (!itemInfo) return;

    setUploadingId(photoId);
    setUploadError(null);

    try {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const result = await itemsApi.scanPhoto(itemInfo.skuCode!, file, angleCode);

      setPhotos(prev =>
        prev.map(p => (p.id === photoId ? { ...p, uploaded: true, imageId: result.id } : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '上传失败';
      setUploadError(`角度「${ANGLES.find(a => a.code === angleCode)?.label || angleCode}」${msg}`);
    } finally {
      setUploadingId(null);
    }
  }, [itemInfo]);

  /** 切换到下一件（清空状态） */
  const handleNextItem = useCallback(() => {
    setSkuCode('');
    setItemInfo(null);
    setPhotos([]);
    setUploadError(null);
    stopCamera();
    // 聚焦到扫码输入框
    setTimeout(() => skuInputRef.current?.focus(), 100);
  }, [stopCamera]);

  /** 重新拍照（删除服务器图片 + 移除本地预览） */
  const handleRetake = useCallback(async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    // 如果已上传，调用后端删除
    if (photo.imageId && itemInfo) {
      try {
        await itemsApi.deleteImage(itemInfo.id, photo.imageId);
      } catch {
        // 删除失败不影响重拍（垃圾数据后续清理）
      }
    }

    URL.revokeObjectURL(photo.previewUrl);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  }, [photos, itemInfo]);

  // ==================== 清理 ====================

  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== 渲染 ====================

  /** 已拍照片按角度分组 */
  const photosByAngle = ANGLES.map(angle => ({
    ...angle,
    photos: photos.filter(p => p.angleCode === angle.code),
  }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ===== 顶部栏 ===== */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="关闭">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold">{tempMode ? '临时拍照' : '扫码拍摄'}</h2>
        <button
          onClick={() => { setTempMode(!tempMode); setSkuCode(''); setItemInfo(null); setPhotos([]); setTempPhotos([]); setUploadError(null); }}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            tempMode
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {tempMode ? '切换到扫码' : '先拍后录'}
        </button>
      </div>

      {/* ===== SKU 扫码区 ===== */}
      <div className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={skuInputRef}
              type="text"
              value={skuCode}
              onChange={e => { setSkuCode(e.target.value); setSkuError(null); }}
              onKeyDown={handleSkuKeyDown}
              placeholder="扫码或输入SKU编码后回车"
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              autoFocus
              disabled={skuLoading}
            />
          </div>
          <Button
            onClick={handleLookupSku}
            disabled={!skuCode.trim() || skuLoading}
            size="sm"
            className="h-9 bg-emerald-600 hover:bg-emerald-500"
          >
            {skuLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '查询'}
          </Button>
        </div>

        {/* SKU 错误提示 */}
        {skuError && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {skuError}
          </p>
        )}

        {/* 货品信息 */}
        {itemInfo && (
          <div className="mt-2 rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/50">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-muted-foreground">{itemInfo.skuCode}</span>
            </div>
            <p className="mt-0.5 text-sm font-medium">{itemInfo.name || '未命名货品'}</p>
            <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
              {itemInfo.materialName && <span>{itemInfo.materialName}</span>}
              {itemInfo.typeName && <span>{itemInfo.typeName}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ===== 主区域：摄像头 + 角度选择（扫码模式查到货品 或 临时模式） ===== */}
      {(itemInfo || tempMode) && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 摄像头预览 */}
          <div className="relative flex-1 bg-black">
            {cameraReady ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/70">
                {cameraError ? (
                  <>
                    <AlertTriangle className="h-10 w-10" />
                    <p className="text-sm">{cameraError}</p>
                    <Button variant="outline" size="sm" onClick={startCamera} className="mt-2">
                      重试启动摄像头
                    </Button>
                  </>
                ) : (
                  <>
                    <Camera className="h-10 w-10" />
                    <p className="text-sm">正在启动摄像头...</p>
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </>
                )}
              </div>
            )}
          </div>

          {/* 角度选择 + 拍照按钮 */}
          <div className="border-t bg-card px-3 py-3">
            {/* 角度选择（横向滚动） */}
            <div className="mb-3 flex gap-1.5 overflow-x-auto">
              {ANGLES.map(angle => {
                const isActive = currentAngle === angle.code;
                const count = photos.filter(p => p.angleCode === angle.code).length;
                return (
                  <button
                    key={angle.code}
                    onClick={() => setCurrentAngle(angle.code)}
                    className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="font-medium">{angle.shortLabel}</span>
                    {count > 0 && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {count}张
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 拍照 + 操作按钮 */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleCapture}
                disabled={!cameraReady || !!uploadingId}
                className="flex flex-1 items-center justify-center gap-2 bg-emerald-600 py-6 text-base hover:bg-emerald-500 disabled:opacity-40"
              >
                <Camera className="h-5 w-5" />
                拍照（{ANGLES.find(a => a.code === currentAngle)?.shortLabel}）
              </Button>

              <Button
                onClick={handleNextItem}
                variant="outline"
                disabled={!!uploadingId}
                className="shrink-0"
              >
                下一件
              </Button>
            </div>

            {/* 上传错误 */}
            {uploadError && (
              <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
                <AlertTriangle className="h-3 w-3" />
                {uploadError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===== 未扫码时的引导（扫码模式） ===== */}
      {!itemInfo && !tempMode && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
          <Camera className="h-16 w-16 opacity-30" />
          <p className="text-lg">扫码或输入SKU开始拍摄</p>
          <p className="text-sm">用扫码枪扫描货品条码，或手动输入SKU编码后回车</p>
          <p className="mt-4 text-xs text-muted-foreground/60">
            也可切换到「先拍后录」模式，拍照后再录入货品信息
          </p>
        </div>
      )}

      {/* ===== 已拍照片缩略图（底部抽屉） ===== */}
      {photos.length > 0 && (
        <div className="border-t bg-card">
          <div className="px-4 py-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              已拍照片（{photos.length}张）
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photosByAngle.map(angle =>
                angle.photos.map(photo => (
                  <div
                    key={photo.id}
                    className="relative shrink-0"
                  >
                    <img
                      src={photo.previewUrl}
                      alt={angle.label}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    {/* 上传状态指示 */}
                    <div className="absolute -right-1 -top-1">
                      {photo.uploaded ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                      )}
                    </div>
                    {/* 重拍按钮 */}
                    {photo.uploaded && (
                      <button
                        onClick={() => handleRetake(photo.id)}
                        className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow hover:bg-accent"
                        title="重拍"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                    {/* 角度标签 */}
                    <span className="absolute bottom-0 left-0 right-0 truncate rounded-b-md bg-black/50 px-1 text-[10px] text-white">
                      {angle.shortLabel}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
