'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Keyboard, AlertTriangle, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  open: boolean;
}

function BarcodeScanner({ onScan, onClose, open }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');

  useEffect(() => {
    if (!open) {
      stopScanning();
      setManualInput('');
      setError(null);
      setMode('camera');
      return;
    }
  }, [open]);

  useEffect(() => {
    if (open && mode === 'camera') {
      // Small delay to ensure the dialog is fully rendered
      const timer = setTimeout(() => {
        startScanning();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanning();
    }
  }, [open, mode]);

  async function startScanning() {
    if (!containerRef.current) return;

    // Check HTTPS requirement
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      setError('摄像头需要 HTTPS 环境。请使用 HTTPS 访问或切换到手动输入模式。');
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('当前浏览器不支持摄像头访问，请切换到手动输入模式。');
      return;
    }

    try {
      setError(null);
      const { Html5Qrcode } = await import('html5-qrcode');

      const scannerId = 'barcode-scanner-container';

      // Clear the container
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div id="${scannerId}" style="width: 100%;"></div>`;
      }

      const html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText: string) => {
          // Scan success
          onScan(decodedText);
          stopScanning();
        },
        () => {
          // Scan failure - ignore, keep scanning
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error('Barcode scanner error:', err);
      if (err?.toString?.().includes('NotAllowedError') || err?.toString?.().includes('Permission')) {
        setError('摄像头权限被拒绝，请在浏览器设置中允许摄像头访问，或切换到手动输入模式。');
      } else if (err?.toString?.().includes('NotFoundError') || err?.toString?.().includes('Requested device not found')) {
        setError('未检测到摄像头设备，请切换到手动输入模式。');
      } else {
        setError(`摄像头启动失败: ${err?.message || '未知错误'}。可切换到手动输入模式。`);
      }
    }
  }

  async function stopScanning() {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }

  function handleManualSubmit() {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
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
                    <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
                  </div>
                </div>
              ) : !isScanning ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <span className="ml-2 text-sm text-muted-foreground">正在启动摄像头...</span>
                </div>
              ) : null}

              {/* Scanner Container */}
              <div
                ref={containerRef}
                className="overflow-hidden rounded-lg border bg-black/5 dark:bg-black/20 min-h-[200px]"
                style={{ display: mode === 'camera' && !error ? 'block' : 'none' }}
              />

              <p className="text-xs text-muted-foreground text-center">
                将条码对准摄像头框内，识别成功后自动出库
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
