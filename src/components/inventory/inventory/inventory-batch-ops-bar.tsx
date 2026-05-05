'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Trash2, Tag, Printer } from 'lucide-react';

interface BatchOpsBarProps {
  selectedCount: number;
  inStockCount: number;
  returnedCount: number;
  onBatchSell: () => void;
  onBatchRestore: () => void;
  onBatchDelete: () => void;
  onBatchPriceAdjust: () => void;
  onBatchLabelPrint: () => void;
  onClearSelection: () => void;
}

export default function InventoryBatchOpsBar({
  selectedCount,
  inStockCount,
  returnedCount,
  onBatchSell,
  onBatchRestore,
  onBatchDelete,
  onBatchPriceAdjust,
  onBatchLabelPrint,
  onClearSelection,
}: BatchOpsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-emerald-600 dark:bg-emerald-700 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white whitespace-nowrap">
          已选择 <span className="font-bold text-white">{selectedCount}</span> 件货品
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="h-7 bg-white text-emerald-700 hover:bg-emerald-50"
            onClick={onBatchSell}
            disabled={inStockCount === 0}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />批量出库
          </Button>
          <Button
            size="sm"
            className="h-7 bg-white text-orange-700 hover:bg-orange-50"
            onClick={onBatchRestore}
            disabled={returnedCount === 0}
          >
            <Package className="h-3 w-3 mr-1" />批量恢复在库
          </Button>
          <Button
            size="sm"
            className="h-7 bg-white/15 text-white hover:bg-white/25 border border-white/30"
            onClick={onBatchDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" />批量删除
          </Button>
          <Button
            size="sm"
            className="h-7 bg-white/15 text-white hover:bg-white/25 border border-white/30"
            onClick={onBatchPriceAdjust}
          >
            <Tag className="h-3 w-3 mr-1" />批量调价
          </Button>
          <Button
            size="sm"
            className="h-7 bg-white/15 text-white hover:bg-white/25 border border-white/30"
            onClick={onBatchLabelPrint}
          >
            <Printer className="h-3 w-3 mr-1" />批量标签打印
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-white/80 hover:text-white hover:bg-white/10"
            onClick={onClearSelection}
          >
            取消选择
          </Button>
        </div>
      </div>
    </div>
  );
}
