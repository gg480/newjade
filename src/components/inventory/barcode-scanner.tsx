'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Keyboard, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useErrorHandler } from '@/hooks/use-error-handler';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  open: boolean;
}

// BarcodeDetector 类型定义（兼容原生 API 和 polyfill）
interface BarcodeDetectorResult {
  rawValue: string;
  format?: string;
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
  getSupportedFormats?: () => Promise<string[]>;
}
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

// 检测微信内置浏览器（getUserMedia 被阉割，无法扫码）
function isWeChatBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent);
}

/**
 * 获取 BarcodeDetector 实例
 * 优先使用浏览器原生 API（Android Chrome，底层 ML Kit 识别率最高），
 * 不支持时降级到 barcode-detector polyfill（zxing-wasm，覆盖 iOS Safari）。
 */
async function getDetector(): Promise<BarcodeDetectorInstance> {
  // 原生 BarcodeDetector（Chrome/Edge Android、部分桌面）
  const NativeBD = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (NativeBD) {
    try {
      const proto = NativeBD as unknown as { getSupportedFormats?: () => Promise<string[]> };
      if (proto.getSupportedFormats) {
        const formats = await proto.getSupportedFormats();
        if (formats.includes('code_128')) {
          return new NativeBD({ formats: ['code_128'] });
        }
      }
    } catch {
      // 原生 API 异常，降级到 polyfill
    }
  }
  // 降级：动态加载 polyfill（仅在需要时，不影响首屏）
  const mod = await import('barcode-detector');
  const PolyfillBD = mod.BarcodeDetector as BarcodeDetectorConstructor;
  return new PolyfillBD({ formats: ['code_128'] });
}

function BarcodeScanner({ onScan, onClose, open }: BarcodeScannerProps) {
  const { handleError } = useErrorHandler();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');

  // 释放摄像头资源（无 setState，可在 effect 中安全调用）
  const releaseCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 停止扫描（释放资源 + 更新 UI 状态）
  const stopScanning = useCallback(() => {
    releaseCamera();
    setIsScanning(false);
  }, [releaseCamera]);

  // 启动摄像头扫码
  const startScanning = useCallback(async () => {
    setError(null);

    // 微信内置浏览器：getUserMedia 被阉割，引导跳转
    if (isWeChatBrowser()) {
      setError('微信内置浏览器不支持摄像头扫码。请点击右上角 ⋯ 选择「在浏览器中打开」后重试，或切换到手动输入模式。');
      return;
    }

    // HTTPS 环境检测（getUserMedia 硬性要求）
    const isSecure = window.location.protocol === 'https:'
      || window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      setError('摄像头需要 HTTPS 环境。请使用 HTTPS 访问或切换到手动输入模式。');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持摄像头访问，请切换到手动输入模式。');
      return;
    }

    try {
      // 初始化 detector（原生优先，polyfill 降级）
      if (!detectorRef.current) {
        detectorRef.current = await getDetector();
      }

      // 获取后置摄像头流（1280x720 提升 Code-128 识别率）
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      // iOS Safari 必须设置 playsInline 防止全屏
      video.setAttribute('playsinline', 'true');
      await video.play();
      setIsScanning(true);

      // 扫描循环：requestAnimationFrame + detector.detect
      const scanLoop = async () => {
        const v = videoRef.current;
        const c = canvasRef.current;
        const d = detectorRef.current;
        if (!v || !c || !d) return;

        // 等待视频就绪
        if (v.readyState >= v.HAVE_CURRENT_DATA) {
          const ctx = c.getContext('2d');
          if (ctx) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, c.width, c.height);
            try {
              const codes = await d.detect(c);
              if (codes.length > 0 && codes[0].rawValue) {
                onScan(codes[0].rawValue);
                stopScanning();
                return;
              }
            } catch {
              // 单帧 detect 失败，继续下一帧
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanLoop);
      };
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      handleError(err, { title: '摄像头启动失败', silent: true });
      if (err instanceof Error) {
        const msg = err.message || '';
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setError('摄像头权限被拒绝，请在浏览器设置中允许摄像头访问，或切换到手动输入模式。');
        } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
          setError('未检测到摄像头设备，请切换到手动输入模式。');
        } else {
          setError(`摄像头启动失败: ${err.message || '未知错误'}。可切换到手动输入模式。`);
        }
      } else {
        setError('摄像头启动失败，可切换到手动输入模式。');
      }
    }
  }, [onScan, stopScanning, handleError]);

  // 关闭时重置状态 + 释放资源（事件回调，避免 effect 中 setState）
  const handleClose = useCallback(() => {
    releaseCamera();
    setIsScanning(false);
    setManualInput('');
    setError(null);
    setMode('camera');
    onClose();
  }, [releaseCamera, onClose]);

  // open 变为 false 时防御性释放资源（父组件可能直接设 open=false 而非通过 Dialog 关闭）
  useEffect(() => {
    if (!open) {
      releaseCamera();
    }
  }, [open, releaseCamera]);

  // mode 切换时启停
  useEffect(() => {
    if (open && mode === 'camera') {
      // 延迟启动，确保 Dialog 已渲染
      const timer = setTimeout(() => { void startScanning(); }, 300);
      return () => clearTimeout(timer);
    } else {
      releaseCamera();
    }
  }, [open, mode, startScanning, releaseCamera]);

  // 组件卸载时释放摄像头
  useEffect(() => {
    return () => stopScanning();
  }, [stopScanning]);

  function handleManualSubmit() {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-emerald-600" />
            扫码出库
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'camera' ? 'default' : 'outline'}
              onClick={() => setMode('camera')}
              className={mode === 'camera' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <Camera className="h-3 w-3 mr-1" /> 摄像头扫码
            </Button>
            <Button
              size="sm"
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => { setMode('manual'); stopScanning(); }}
              className={mode === 'manual' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <Keyboard className="h-3 w-3 mr-1" /> 手动输入
            </Button>
          </div>

          {/* Camera Mode */}
          {mode === 'camera' && (
            <div className="space-y-3">
              {error ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      <p>{error}</p>
                      {isWeChatBrowser() && (
                        <p className="mt-1 flex items-center gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          点击右上角菜单 → 在浏览器中打开
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : !isScanning ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <span className="ml-2 text-sm text-muted-foreground">正在启动摄像头...</span>
                </div>
              ) : null}

              {/* 摄像头视频流 + 横向矩形扫描框（Code-128 是 1D 条码，宽≫高） */}
              <div className="relative overflow-hidden rounded-lg border bg-black min-h-[200px]">
                <video
                  ref={videoRef}
                  className="w-full h-auto"
                  muted
                  playsInline
                  style={{ display: mode === 'camera' && !error ? 'block' : 'none' }}
                />
                {/* 扫描框 overlay：横向矩形引导用户对准 Code-128 */}
                {isScanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[80%] h-[40%] border-2 border-emerald-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
                  </div>
                )}
              </div>

              {/* 隐藏 canvas，用于截取视频帧供 detector.detect */}
              <canvas ref={canvasRef} className="hidden" />

              <p className="text-xs text-muted-foreground text-center">
                将 Code-128 条码对准框内，识别成功后自动出库
              </p>
            </div>
          )}

          {/* Manual Input Mode */}
          {mode === 'manual' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">输入SKU编号</label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualSubmit(); }}
                  placeholder="输入SKU编号后按回车"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  autoFocus
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
              >
                查询出库
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BarcodeScanner;
