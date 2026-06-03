'use client';

import React, { useState } from 'react';
import { itemsApi } from '@/lib/api';
import type { SkuLookupResult } from '@/lib/api.types';
import { toast } from 'sonner';
import { ShoppingCart, Scan, Package, Search, Plus, X, Loader2, Barcode, Camera, Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import InventoryPicker from './inventory-picker';
import BarcodeScannerDialog from '../barcode-scanner';

// ==================== 类型定义 ====================

/** 购物车中的货品条目 */
export interface CheckoutItem {
  id: number;
  skuCode: string;
  name: string;
  sellingPrice: number;
  actualPrice: number;
  materialName: string;
  typeName: string;
  image?: string;
}

interface StepItemsProps {
  items: CheckoutItem[];
  onItemsChange: (items: CheckoutItem[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ==================== 工具函数 ====================

function toCheckoutItem(lookup: SkuLookupResult): CheckoutItem {
  return {
    id: lookup.id,
    skuCode: lookup.skuCode,
    name: lookup.name || lookup.skuCode,
    sellingPrice: lookup.sellingPrice,
    actualPrice: lookup.sellingPrice,
    materialName: lookup.materialName || '',
    typeName: lookup.typeName || '',
  };
}

// ==================== 组件 ====================

/**
 * 收银台 Step 2：选择货品
 *
 * 支持三种添加方式：
 * 1. 扫码添加（调用摄像头）
 * 2. 从库存选择（搜索筛选面板）
 * 3. 手动输入 SKU
 */
export default function StepItems({ items, onItemsChange }: StepItemsProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualSku, setManualSku] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const totalAmount = items.reduce((sum, item) => sum + item.actualPrice, 0);
  const totalCount = items.length;

  /** 移除一件货品 */
  function handleRemove(index: number) {
    const next = items.filter((_, i) => i !== index);
    onItemsChange(next);
  }

  /** 扫码成功回调 */
  function handleBarcodeScan(code: string) {
    setScannerOpen(false);
    handleAddBySku(code);
  }

  /** 按 SKU 添加货品 */
  async function handleAddBySku(sku: string) {
    setManualLoading(true);
    try {
      const lookup = await itemsApi.lookupBySku(sku.trim());
      if (lookup.status !== 'in_stock') {
        const statusMap: Record<string, string> = { sold: '已售', returned: '已退货' };
        toast.error(`货品「${lookup.skuCode}」当前状态为「${statusMap[lookup.status] || lookup.status}」，无法销售`);
        return;
      }
      if (items.some(item => item.id === lookup.id)) {
        toast.info(`货品「${lookup.skuCode}」已在列表中`);
        return;
      }
      const newItem = toCheckoutItem(lookup);
      onItemsChange([...items, newItem]);
      setManualSku('');
      toast.success(`已添加：${newItem.skuCode}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '查询失败';
      toast.error(`未找到条码「${sku}」对应的在库货品`);
      console.error('[StepItems] lookup error:', message);
    } finally {
      setManualLoading(false);
    }
  }

  function handleManualKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && manualSku.trim() && !manualLoading) {
      handleAddBySku(manualSku);
    }
  }

  function handleManualSearch() {
    if (manualSku.trim() && !manualLoading) {
      handleAddBySku(manualSku);
    }
  }

  /** 从库存选择面板添加 */
  function handlePickerSelect(item: CheckoutItem) {
    if (items.some(i => i.id === item.id)) {
      toast.info(`货品「${item.skuCode}」已在列表中`);
      return;
    }
    onItemsChange([...items, item]);
  }

  return (
    <div className="space-y-5">
      {/* ===== 标题 ===== */}
      <div className="text-center">
        <h2 className="text-lg font-semibold">选择货品</h2>
        <p className="text-sm text-muted-foreground mt-1">
          已选 {totalCount} 件，合计 ¥{totalAmount.toFixed(2)}
        </p>
      </div>

      {/* ===== 已选货品列表 ===== */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">尚未添加货品</p>
          <p className="text-xs mt-1">请使用下方方式添加货品</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[11px] bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground">
                    {item.skuCode}
                  </code>
                  {item.materialName && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      {item.materialName}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ¥{item.actualPrice.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => handleRemove(index)}
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center
                           text-muted-foreground hover:text-red-500 hover:bg-red-50
                           dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                aria-label={`移除 ${item.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ===== 添加方式：三合一操作区 ===== */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground px-1">添加货品</p>

        {/* 方式1：扫码添加 */}
        <button
          onClick={() => setScannerOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-border bg-card
                     hover:bg-accent hover:border-emerald-400 transition-colors px-4 py-3 cursor-pointer"
        >
          <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <Camera className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-medium">扫码添加</p>
            <p className="text-xs text-muted-foreground">扫描货品 SKU 二维码</p>
          </div>
          <Scan className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>

        {/* 方式2：从库存选择 */}
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-border bg-card
                     hover:bg-accent hover:border-emerald-400 transition-colors px-4 py-3 cursor-pointer"
        >
          <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Layers className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-medium">从库存选择</p>
            <p className="text-xs text-muted-foreground">搜索并选择在库货品</p>
          </div>
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>

        {/* 方式3：手动输入 SKU */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Barcode className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={manualSku}
            onChange={e => setManualSku(e.target.value)}
            onKeyDown={handleManualKeyDown}
            placeholder="输入 SKU 编码后按回车..."
            className="h-9 border-0 bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
            disabled={manualLoading}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualSearch}
            disabled={manualLoading || !manualSku.trim()}
            className="h-8 shrink-0"
          >
            {manualLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ===== 对话框 ===== */}
      <BarcodeScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
      <InventoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
