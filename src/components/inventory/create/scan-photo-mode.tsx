'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { X, Camera, ScanLine, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { getErrorMessage, importWithTimeout } from '@/lib/scan-utils';

const ANGLES = [
  { code: 'F', label: '正面俯拍', shortLabel: '正面' },
  { code: 'S', label: '侧面45°', shortLabel: '侧面' },
  { code: 'D', label: '局部特写', shortLabel: '特写' },
  { code: 'X1', label: '特征照1', shortLabel: '特征1' },
  { code: 'X2', label: '特征照2', shortLabel: '特征2' },
  { code: 'X3', label: '特征照3', shortLabel: '特征3' },
] as const;

/** 拍摄角度编码联合类型（由 ANGLES 常量自动推导） */
type AngleCode = typeof ANGLES[number]['code'];

const LOAD_SCANNER_TIMEOUT_MS = 10000;
const FOCUS_DELAY_MS = 100;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_CONCURRENCY = 3;

// 类型定义
interface ItemInfo {
  id: number;
  skuCode: string;
  name: string | null;
  materialName?: string | null;
  typeName?: string | null;
}

interface PhotoEntry {
  id: string;
  imageId?: number;
  angleCode: AngleCode;
  angleLabel: string;
  previewUrl: string;
  uploaded: boolean;
  error?: string;
}

interface ScanPhotoModeProps {
  onClose: () => void;
  api: {
    lookupBySku: (sku: string) => Promise<ItemInfo>;
    scanPhoto: (skuCode: string, file: File, angleCode?: string) => Promise<{ id: number }>;
  };
}

export default function ScanPhotoMode({ onClose, api }: ScanPhotoModeProps) {
  const [itemInfo, setItemInfo] = useState<ItemInfo | null>(null);
  const [skuInput, setSkuInput] = useState('');
  const [isSkuLoading, setIsSkuLoading] = useState(false);
  const [skuError, setSkuError] = useState('');
  const [currentAngle, setCurrentAngle] = useState<AngleCode>(ANGLES[0].code);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);
  /** 原始 File 对象缓存，避免 retry 时 fetch(blobUrl) 重建 */
  const originalFilesRef = useRef<Map<string, File>>(new Map());
  /** 上传并发计数器，限制同时进行的上传数 */
  const uploadingCountRef = useRef(0);

  // 扫码弹窗（动态加载）
  const [showScan, setShowScan] = useState(false);
  const [isScannerLoading, setIsScannerLoading] = useState(false);
  const ScannerComponentRef = useRef<React.ComponentType<{ open: boolean; onClose: () => void; onScan: (code: string) => void }> | null>(null);

  // 挂载跟踪 + 清理预览 URL / 文件引用（防止内存泄漏）
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      originalFilesRef.current.clear();
    };
  }, []);

  const lookupSku = useCallback(async (sku: string, isScanResult?: boolean): Promise<ItemInfo | null> => {
    const trimmed = sku.trim();
    if (!trimmed) return null;
    setIsSkuLoading(true);
    setSkuError('');
    try {
      const item = await api.lookupBySku(trimmed);
      setItemInfo(item);
      if (isScanResult) {
        toast.success(`已识别: ${trimmed}`);
      }
      return item;
    } catch (e: unknown) {
      console.debug('[ScanPhoto] SKU查询失败:', e instanceof Error ? e.message : String(e));
      setSkuError(isScanResult ? `未找到条码「${trimmed}」` : `未找到「${trimmed}」`);
      return null;
    } finally {
      setIsSkuLoading(false);
    }
  }, [api]);

  const handleOpenScan = useCallback(async () => {
    if (ScannerComponentRef.current) { setShowScan(true); return; }
    setIsScannerLoading(true);
    try {
      const mod = await importWithTimeout(() => import('../barcode-scanner'), LOAD_SCANNER_TIMEOUT_MS);
      ScannerComponentRef.current = mod.default;
      setShowScan(true);
    } catch (e: unknown) {
      toast.error('扫码组件加载失败: ' + getErrorMessage(e, '未知错误'));
    } finally {
      setIsScannerLoading(false);
    }
  }, []);

  const handleScanResult = useCallback(async (code: string) => {
    setSkuInput(code);
    const item = await lookupSku(code, true);
    if (item) {
      setShowScan(false); // 仅查找成功时关闭扫码弹窗
    }
    // 查找失败时不关闭弹窗，用户可重新扫码
  }, [lookupSku]);

  const handleScannerClose = useCallback(() => {
    setShowScan(false);
  }, []);

  const handleLookup = useCallback(async () => {
    setItemInfo(null);
    await lookupSku(skuInput);
  }, [skuInput, lookupSku]);

  // 上传单张照片（可重试）— 上传成功后释放原始文件缓存，防止内存堆积
  const uploadOnePhoto = useCallback(async (pid: string, file: File, angleCode: AngleCode, itemSku: string) => {
    try {
      const r = await api.scanPhoto(itemSku, file, angleCode);
      setPhotos(prev => prev.map(x => x.id === pid ? { ...x, uploaded: true, imageId: r.id, error: undefined } : x));
      // 上传成功后释放原始 File 缓存（释放 2-5MB/张）
      originalFilesRef.current.delete(pid);
    } catch (e: unknown) {
      const errMsg = getErrorMessage(e, '上传失败');
      setPhotos(prev => prev.map(x => x.id === pid ? { ...x, error: errMsg } : x));
      throw e;
    }
  }, [api]);

  const handleFileCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 兼容某些浏览器下重置 value 可能抛 DOMException
    try { e.target.value = ''; } catch { /* ignore */ }

    // 客户端文件类型/大小验证
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setUploadError('仅支持 JPG/PNG/WEBP 格式的照片');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setUploadError('照片大小不能超过 10MB');
      return;
    }

    const foundAngle = ANGLES.find(a => a.code === currentAngle);
    if (!foundAngle) return;
    const pid = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    originalFilesRef.current.set(pid, file);

    // 先加入列表再上传（用户立刻看到缩略图）
    const entry: PhotoEntry = {
      id: pid, angleCode: currentAngle, angleLabel: foundAngle.label,
      previewUrl, uploaded: false,
    };
    setPhotos(prev => [...prev, entry]);
    setUploadError('');

    if (!itemInfo) return; // 未关联 SKU，仅本地预览

    // 关联 SKU → 自动上传（等待并发槽位，最多 3 个同时上传）
    const waitForSlot = async () => {
      while (uploadingCountRef.current >= UPLOAD_CONCURRENCY) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    await waitForSlot();
    uploadingCountRef.current++;
    setUploadingId(pid);
    try {
      await uploadOnePhoto(pid, file, currentAngle, itemInfo.skuCode);
    } catch (e: unknown) {
      setUploadError(`${foundAngle.shortLabel} 上传失败: ${getErrorMessage(e, '未知错误')}`);
    } finally {
      setUploadingId(null);
      uploadingCountRef.current--;
    }
  }, [currentAngle, itemInfo, uploadOnePhoto]);

  // 重试上传失败的照片（优先使用缓存的原始 File，避免 fetch(blobUrl) 重建）
  const handleRetryUpload = useCallback(async (photo: PhotoEntry) => {
    if (!itemInfo || !photo.error) return;

    const cachedFile = originalFilesRef.current.get(photo.id);
    let file: File;
    if (cachedFile) {
      file = cachedFile;
    } else {
      // 兜底：从预览 URL 重建 File 对象
      try {
        const resp = await fetch(photo.previewUrl);
        const blob = await resp.blob();
        file = new File([blob], `retry_${Date.now()}.jpg`, { type: 'image/jpeg' });
      } catch (e: unknown) {
        setUploadError(`重试失败，无法重建文件: ${getErrorMessage(e, '未知错误')}`);
        return;
      }
    }

    try {
      setPhotos(prev => prev.map(x => x.id === photo.id ? { ...x, error: undefined } : x));
      setUploadingId(photo.id);
      await uploadOnePhoto(photo.id, file, photo.angleCode, itemInfo.skuCode);
      setUploadError('');
    } catch (e: unknown) {
      setUploadError(`重试失败: ${getErrorMessage(e, '未知错误')}`);
    } finally {
      setUploadingId(null);
    }
  }, [itemInfo, uploadOnePhoto]);

  const nextItem = useCallback(() => {
    // 有正在进行的上传时阻止切换，防止 race condition
    if (uploadingCountRef.current > 0) {
      toast.warning('照片上传中，请等待完成后切换');
      return;
    }
    // 清理当前预览 URL 和文件缓存
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current = new Set();
    originalFilesRef.current.clear();
    try { if (fileInputRef.current) fileInputRef.current.value = ''; } catch { /* ignore */ }
    setSkuInput('');
    setItemInfo(null);
    setPhotos([]);
    setUploadError('');
    setSkuError('');
    setTimeout(() => skuRef.current?.focus(), FOCUS_DELAY_MS);
  }, []);

  const triggerCamera = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const photosByAngle = useMemo(() =>
    ANGLES.map(a => {
      const matchingPhotos = photos.filter(p => p.angleCode === a.code);
      return { ...a, photos: matchingPhotos, count: matchingPhotos.length };
    }),
    [photos]
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="scan-photo-title"
      className="fixed inset-0 z-[60] flex flex-col bg-background overscroll-contain tab-fade-in">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between border-b px-3 sm:px-4 py-3 shrink-0">
        <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/70 motion-safe:active:scale-95 transition-all duration-150" aria-label="关闭扫码拍摄">
          <X className="h-5 w-5" />
        </button>
        <h2 id="scan-photo-title" className="text-sm sm:text-base font-semibold tracking-tight">扫码拍摄</h2>
        <div className="w-10" />
      </div>

      {/* SKU 查询 + 扫码 + 拍照（顶部固定） */}
      <div className="border-b bg-card px-2 sm:px-3 py-2 shrink-0 space-y-2">
        {/* 第一行：扫码 + 输入 + 查询 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={handleOpenScan} disabled={isScannerLoading}
            className="h-10 min-w-[4rem] px-3 rounded-md bg-emerald-600 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-1 shrink-0
                       hover:bg-emerald-500 active:bg-emerald-700 motion-safe:active:scale-95 transition-all duration-150 disabled:opacity-60"
            title="摄像头扫码" aria-label={isScannerLoading ? '扫码加载中' : '打开摄像头扫码'}>
            {isScannerLoading ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <ScanLine className="h-4 w-4 shrink-0" />
            )}
            <span className="sm:inline">{isScannerLoading ? '加载中' : '扫码'}</span>
          </button>
          <div className="relative flex-1 min-w-0">
            <input ref={skuRef} value={skuInput} id="sku-input" autoFocus
              onChange={e => { setSkuInput(e.target.value); setSkuError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }}
              placeholder="SKU编码" disabled={isSkuLoading}
              aria-label="SKU编码输入"
              aria-invalid={skuError ? 'true' : undefined}
              aria-describedby={skuError ? 'sku-error-text' : undefined}
              aria-busy={isSkuLoading ? 'true' : undefined}
              autoComplete="off"
              className={`w-full h-10 rounded-md border px-2.5 sm:px-3 text-sm
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500
                         disabled:opacity-50 transition-shadow ${skuError ? 'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400/40' : 'border-input bg-background'}`} />
          </div>
          <Button onClick={handleLookup}
            disabled={!skuInput.trim() || isSkuLoading}
            className="h-10 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-500 shrink-0 text-xs sm:text-sm motion-safe:active:scale-95 transition-all duration-150"
            aria-label={isSkuLoading ? '查询中' : '查询SKU'}>
            {isSkuLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '查询'}
          </Button>
        </div>

        {/* 状态信息 */}
        {skuError && (
          <p id="sku-error-text" role="alert"
            className="flex items-center gap-1 text-[11px] sm:text-xs text-red-500 px-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">{skuError}</span>
          </p>
        )}
        {itemInfo && (
          <div role="status"
            className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40
                       rounded-md px-2 py-1.5 truncate animate-in fade-in slide-in-from-left-1 duration-200">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="font-mono font-medium shrink-0">{itemInfo.skuCode}</span>
            <span className="text-emerald-600 truncate min-w-0">{itemInfo.name}</span>
          </div>
        )}

        {/* 第二行：角度选择 + 拍照 */}
        <div role="tablist" aria-label="拍照角度选择"
          className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 touch-pan-x">
          {photosByAngle.map(a => {
            const active = currentAngle === a.code;
            return (
              <button key={a.code} onClick={() => setCurrentAngle(a.code)}
                role="tab" aria-selected={active}
                className={`shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all duration-200 motion-safe:active:scale-95 ${
                  active
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:shadow-sm active:bg-accent/70'
                }`}>
                {a.shortLabel}
                {a.count > 0 && (
                  <span className="ml-1 text-emerald-600 font-semibold tabular-nums">{a.count}</span>
                )}
              </button>
            );
          })}
          <div className="flex-1 min-w-2" />
          <button onClick={triggerCamera} disabled={!!uploadingId}
            className="shrink-0 h-9 sm:h-10 px-3.5 sm:px-4 rounded-lg bg-emerald-600 text-white text-xs sm:text-sm font-medium
                       flex items-center gap-1.5 hover:bg-emerald-500 active:bg-emerald-700
                       disabled:opacity-40 transition-all duration-150 shadow-sm active:shadow-none motion-safe:active:scale-95"
            title="拍照" aria-label="拍照">
            <Camera className="h-4 w-4 shrink-0" />
            <span>拍照</span>
          </button>
          <button onClick={nextItem} disabled={!!uploadingId}
            className="shrink-0 h-9 sm:h-10 px-2.5 sm:px-3 rounded-lg border border-input text-xs sm:text-sm text-muted-foreground
                       hover:bg-accent active:bg-accent/80 transition-all duration-150 motion-safe:active:scale-95 disabled:opacity-40">
            下一件
          </button>
        </div>

        {uploadError && (
          <p role="alert"
            className="flex items-center gap-1 text-[11px] sm:text-xs text-red-500 px-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">{uploadError}</span>
          </p>
        )}

        {/* 隐藏的 file input */}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileCapture} className="hidden" aria-label="选择照片文件" />
      </div>

      {/* 照片预览区 */}
      <div className="flex-1 overflow-y-auto bg-muted/30 min-h-0 pb-safe overscroll-contain">
        {photos.length > 0 ? (
          <div role="list" className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 sm:p-3">
            {photosByAngle.flatMap((a, angleIdx) =>
              a.photos.map((p, photoIdx) => (
                <div key={p.id} role="listitem"
                  className="relative aspect-square rounded-lg overflow-hidden bg-muted/50 border group card-slide-up"
                  style={{ '--delay': `${(angleIdx * 6 + photoIdx) * 60}ms` } as React.CSSProperties}>
                  <img src={p.previewUrl} alt={`${a.shortLabel}照片`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 motion-safe:group-hover:scale-105"
                    loading="lazy" />
                  {/* 角度标签 */}
                  <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent
                                   text-[10px] text-white text-center pt-4 pb-0.5">
                    {a.shortLabel}
                  </span>
                  {/* 上传状态 */}
                  <div className="absolute top-1 right-1">
                    {p.uploaded ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 drop-shadow pop-in" />
                    ) : p.error ? (
                      <button onClick={() => handleRetryUpload(p)}
                        className="flex items-center gap-0.5 bg-red-500/80 text-white text-[10px] px-1.5 py-0.5 rounded
                                   hover:bg-red-600 active:bg-red-700 motion-safe:active:scale-95 transition-all duration-150"
                        title="点击重试" aria-label={`重试上传${a.shortLabel}照片`}>
                        <AlertTriangle className="h-3 w-3" />
                        重试
                      </button>
                    ) : (
                      <div className="flex items-center justify-center" aria-label="上传中">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-500 drop-shadow" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div role="status" className="flex flex-col items-center justify-center h-full text-muted-foreground px-6 sm:p-8 text-center tab-fade-in">
            <div className="rounded-full bg-muted/50 p-4 sm:p-6 mb-3 sm:mb-4">
              <Camera className="h-10 w-10 sm:h-16 sm:w-16 opacity-30" />
            </div>
            <p className="text-base sm:text-lg font-medium">扫码后选择角度拍照</p>
            <p className="text-xs sm:text-sm mt-1.5 max-w-xs leading-relaxed text-pretty">
              点击「扫码」用摄像头扫描条码，或手动输入 SKU 后点「查询」。
              <br className="hidden sm:block" />选好角度后点「拍照」调用系统相机。
            </p>
          </div>
        )}
      </div>

      {/* 扫码弹窗 */}
      {showScan && ScannerComponentRef.current && (
        <ScannerComponentRef.current
          open={showScan}
          onClose={handleScannerClose}
          onScan={handleScanResult}
        />
      )}
    </div>
  );
}
