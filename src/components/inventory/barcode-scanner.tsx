'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Keyboard, AlertTriangle, Loader2, ExternalLink, ScanLine } from 'lucide-react';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { isWeChatBrowser, triggerVibration, getDetector, type BarcodeDetectorInstance } from '@/lib/scan-utils';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  open: boolean;
}

// 扫描节流间隔（ms）
const SCAN_THROTTLE_MS = 200;

// 摄像头分辨率
const CAMERA_WIDTH = 1280;
const CAMERA_HEIGHT = 720;

// 震动反馈时长（ms）
const VIBRATION_DURATION_MS = 100;


function BarcodeScanner({ onScan, onClose, open }: BarcodeScannerProps) {
  const { handleError } = useErrorHandler();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectTimeRef = useRef(0);
  const isMountedRef = useRef(true);
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

    // getUserMedia 可用性检测（含 webkit 前缀回退）
    // Chrome 要求安全上下文（HTTPS 或 localhost）才能使用摄像头
    // 通过 http://192.168.x.x 访问时，Chrome 视为不安全 → getUserMedia 为 undefined
    const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      || (navigator as unknown as { webkitGetUserMedia?: typeof navigator.mediaDevices.getUserMedia }).webkitGetUserMedia?.bind(navigator);

    if (!getUserMedia) {
      const reason = window.isSecureContext === false
        ? '手机通过局域网 IP 访问时，Chrome 认为页面非安全上下文，禁用了摄像头。'
          + '\n\n解决方法：'
          + '\n① 本机访问：用 http://localhost:5001 打开'
          + '\n② adb 端口转发：adb reverse tcp:5001 tcp:5001 后访问 http://localhost:5001'
          + '\n③ 使用 HTTPS 代理（如 ngrok）'
          + '\n\n也可点击下方「手动输入」模式直接输入 SKU 出库。'
        : '当前浏览器不支持摄像头访问，请切换到手动输入模式。';
      setError(reason);
      return;
    }

    try {
      // 初始化 detector（原生优先，polyfill 降级），支持多格式
      if (!detectorRef.current) {
        const { detector } = await getDetector();
        detectorRef.current = detector;
      }

      // 获取后置摄像头流（只尝试一次，移动端重复调用会反复弹权限窗）
      const stream = await getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) { stopScanning(); return; }
      video.srcObject = stream;
      // iOS Safari 必须设置 playsInline 防止全屏
      video.setAttribute('playsinline', 'true');
      await video.play();
      setIsScanning(true);

      // 扫描循环：requestAnimationFrame + detector.detect（节流控制 200ms/次）
      const scanLoop = async () => {
        const v = videoRef.current;
        const c = canvasRef.current;
        const d = detectorRef.current;
        if (!v || !c || !d) return;

        if (v.readyState >= v.HAVE_CURRENT_DATA) {
          const now = Date.now();
          // 节流：SCAN_THROTTLE_MS 内只检测一次，避免 CPU 过载
          if (now - lastDetectTimeRef.current >= SCAN_THROTTLE_MS) {
            lastDetectTimeRef.current = now;
            // 缓存 canvas 2d context，避免每帧重新获取
            let ctx = canvasCtxRef.current;
            if (!ctx) {
              ctx = c.getContext('2d', { willReadFrequently: true });
              canvasCtxRef.current = ctx;
            }
            if (ctx) {
              c.width = v.videoWidth;
              c.height = v.videoHeight;
              ctx.drawImage(v, 0, 0, c.width, c.height);
              try {
                const codes = await d.detect(c);
                if (codes.length > 0 && codes[0].rawValue) {
                  const code = codes[0].rawValue.trim();
                  if (code) {
                    triggerVibration(VIBRATION_DURATION_MS);
                    onScan(code);
                    stopScanning();
                    return;
                  }
                }
              } catch {
                // 单帧 detect 失败，继续下一帧
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanLoop);
      };
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      stopScanning(); // 确保异常路径也释放摄像头资源
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
      // 使用 requestAnimationFrame 确保 Dialog 渲染完成后再启动摄像头
      // 相比固定 setTimeout，rAF 在下一帧才执行，DOM 已提交完成
      const rafId = requestAnimationFrame(() => void startScanning());
      return () => cancelAnimationFrame(rafId);
    } else {
      releaseCamera();
    }
  }, [open, mode, startScanning, releaseCamera]);

  // 挂载跟踪 + 组件卸载时释放摄像头
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopScanning();
    };
  }, [stopScanning]);

  function handleManualSubmit() {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-md sm:max-w-lg p-3 sm:p-6">
        <DialogHeader className="pb-1 sm:pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            <ScanLine className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>扫码出库</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Mode Toggle */}
          <div role="tablist" aria-label="扫码模式选择" className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
            <Button
              role="tab"
              aria-selected={mode === 'camera'}
              variant={mode === 'camera' ? 'default' : 'outline'}
              onClick={() => setMode('camera')}
              className={`h-11 sm:h-10 w-full sm:flex-1 text-xs sm:text-sm motion-safe:active:scale-[0.98] transition-all duration-150 ${
                mode === 'camera' ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' : ''
              }`}
            >
              <Camera className="h-3.5 w-3.5 mr-1.5 shrink-0" /> 摄像头扫码
            </Button>
            <Button
              role="tab"
              aria-selected={mode === 'manual'}
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => { setMode('manual'); stopScanning(); }}
              className={`h-11 sm:h-10 w-full sm:flex-1 text-xs sm:text-sm motion-safe:active:scale-[0.98] transition-all duration-150 ${
                mode === 'manual' ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' : ''
              }`}
            >
              <Keyboard className="h-3.5 w-3.5 mr-1.5 shrink-0" /> 手动输入
            </Button>
          </div>

          {/* Camera Mode */}
          {mode === 'camera' && (
            <div className="space-y-2.5 sm:space-y-3 animate-in fade-in slide-in-from-right-1 duration-200">
              {error ? (
                <div role="alert" className="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <p className="leading-relaxed">{error}</p>
                      {isWeChatBrowser() && (
                        <p className="flex items-center gap-1 text-[11px] font-medium">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          点击右上角菜单 → 在浏览器中打开
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : !isScanning ? (
                <div className="flex items-center justify-center py-8" aria-busy="true">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <span className="ml-2 text-xs sm:text-sm text-muted-foreground">正在启动摄像头...</span>
                </div>
              ) : null}

              {/* 摄像头视频流 + 扫描框 */}
              <div className="relative overflow-hidden rounded-lg border bg-black aspect-[4/3] sm:aspect-video min-h-[180px] sm:min-h-[200px]">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                  style={{ display: mode === 'camera' && !error ? 'block' : 'none' }}
                />
                {/* 扫描框 overlay：横向矩形引导用户对准条码 */}
                {isScanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-[80%] h-[35%] sm:h-[40%]">
                      {/* 扫描框 border */}
                      <div className="absolute inset-0 border-2 border-emerald-400/80 rounded-lg" />
                      {/* 四角增强 */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br" />
                      {/* 扫描线 */}
                      <div className="absolute left-1 right-1 h-[2px] bg-emerald-400/60 top-1/2 -translate-y-1/2 motion-safe:animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                      {/* 暗角遮罩 */}
                      <div className="absolute inset-0 shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.35)] pointer-events-none rounded-lg" />
                    </div>
                  </div>
                )}
              </div>

              {/* 隐藏 canvas，用于截取视频帧供 detector.detect */}
              <canvas ref={canvasRef} className="hidden" />

              <p className="text-[11px] sm:text-xs text-muted-foreground text-center leading-relaxed" aria-live="polite" aria-busy={isScanning}>
                {isScanning ? '正在识别条码...' : '将条码对准框内，识别成功后震动提示并自动出库'}
              </p>
            </div>
          )}

          {/* Manual Input Mode */}
          {mode === 'manual' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-1 duration-200">
              <div className="space-y-1">
                <label htmlFor="barcode-manual-input" className="text-sm font-medium">输入SKU编号</label>
                <input
                  id="barcode-manual-input"
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualSubmit(); }}
                  placeholder="输入SKU编号后按回车"
                  className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  autoFocus
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 motion-safe:active:scale-[0.98] transition-all duration-150"
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
