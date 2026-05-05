'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tag, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { formatPrice } from '../shared';

interface PricePreviewItem {
  id: number;
  name: string;
  sku: string;
  oldPrice: number;
  newPrice: number;
}

interface BatchPriceForm {
  mode: 'percent' | 'fixed';
  target: 'sellingPrice' | 'minimumPrice';
  value: string;
  direction: 'increase' | 'decrease';
}

interface BatchPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  priceForm: BatchPriceForm;
  onPriceFormChange: (fn: (prev: BatchPriceForm) => BatchPriceForm) => void;
  loading: boolean;
  progress: { current: number; total: number } | null;
  pricePreview: PricePreviewItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function InventoryBatchPriceDialog({
  open,
  onOpenChange,
  selectedCount,
  priceForm,
  onPriceFormChange,
  loading,
  progress,
  pricePreview,
  onConfirm,
  onCancel,
}: BatchPriceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-amber-600" />
            批量调价
          </DialogTitle>
          <DialogDescription>对选中的 {selectedCount} 件货品进行价格调整</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Progress indicator */}
          {progress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>调价进度</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 调整方式 */}
            <div className="space-y-1">
              <Label className="text-xs">调整方式</Label>
              <Select value={priceForm.mode} onValueChange={v => onPriceFormChange(f => ({ ...f, mode: v as 'percent' | 'fixed' }))} disabled={loading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">按比例调整 (%)</SelectItem>
                  <SelectItem value="fixed">按固定金额 (元)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 调整方向 */}
            <div className="space-y-1">
              <Label className="text-xs">调整方向</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 h-9 rounded-md border text-xs font-medium transition-colors ${priceForm.direction === 'increase' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'bg-background border-border text-muted-foreground hover:bg-muted/50'}`}
                  onClick={() => onPriceFormChange(f => ({ ...f, direction: 'increase' }))}
                  disabled={loading}
                >
                  <ArrowUp className="h-3 w-3 mr-1 inline" />加价
                </button>
                <button
                  type="button"
                  className={`flex-1 h-9 rounded-md border text-xs font-medium transition-colors ${priceForm.direction === 'decrease' ? 'bg-red-50 dark:bg-red-950/30 border-red-300 text-red-700 dark:text-red-300' : 'bg-background border-border text-muted-foreground hover:bg-muted/50'}`}
                  onClick={() => onPriceFormChange(f => ({ ...f, direction: 'decrease' }))}
                  disabled={loading}
                >
                  <ArrowDown className="h-3 w-3 mr-1 inline" />减价
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 调整对象 */}
            <div className="space-y-1">
              <Label className="text-xs">调整对象</Label>
              <Select value={priceForm.target} onValueChange={v => onPriceFormChange(f => ({ ...f, target: v as 'sellingPrice' | 'minimumPrice' }))} disabled={loading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sellingPrice">售价</SelectItem>
                  <SelectItem value="minimumPrice">底价</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 调整值 */}
            <div className="space-y-1">
              <Label className="text-xs">调整值</Label>
              <Input
                type="number"
                min="0"
                placeholder={priceForm.mode === 'percent' ? '如 10 表示10%' : '如 500 表示500元'}
                value={priceForm.value}
                onChange={e => onPriceFormChange(f => ({ ...f, value: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>

          {/* Preview summary */}
          <div className="p-3 bg-muted/30 rounded-lg text-sm">
            <p className="text-muted-foreground">选中 <span className="font-medium text-foreground">{selectedCount}</span> 件货品，预计调整...</p>
            <p className="text-xs text-muted-foreground mt-1">
              {priceForm.direction === 'increase' ? '加价' : '减价'}
              {priceForm.mode === 'percent' ? `${priceForm.value || 0}%` : `¥${priceForm.value || 0}`}
            </p>
          </div>

          {/* Preview items */}
          {pricePreview.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">价格预览（前10件）</Label>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {pricePreview.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-amber-50 dark:bg-amber-950/20">
                      <span className="text-xs truncate mr-2">{p.sku}</span>
                      <span className="text-muted-foreground">{formatPrice(p.oldPrice)}</span>
                      <span className="mx-2 text-muted-foreground">&rarr;</span>
                      <span className={`font-medium ${p.newPrice >= p.oldPrice ? 'text-emerald-600' : 'text-red-600'}`}>{formatPrice(p.newPrice)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selectedCount > 10 && (
                <p className="text-xs text-muted-foreground text-center">...还有 {selectedCount - 10} 件</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>取消</Button>
          <Button onClick={onConfirm} disabled={loading || !priceForm.value} className="bg-amber-600 hover:bg-amber-700 text-white">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />处理中...</> : '确认调价'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
