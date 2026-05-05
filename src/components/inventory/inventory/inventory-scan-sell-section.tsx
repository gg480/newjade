'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Barcode, Camera, Package, CheckCircle, DollarSign, BarChart3 } from 'lucide-react';
import { formatPrice } from '../shared';

interface ScanSellSectionProps {
  scanSku: string;
  onScanSkuChange: (v: string) => void;
  scanLoading: boolean;
  onScanSell: () => void;
  onOpenScanner: () => void;
  totalItems: number;
  inStockCount: number;
  totalCost: number;
  totalMarketValue: number;
}

export default function InventoryScanSellSection({
  scanSku,
  onScanSkuChange,
  scanLoading,
  onScanSell,
  onOpenScanner,
  totalItems,
  inStockCount,
  totalCost,
  totalMarketValue,
}: ScanSellSectionProps) {
  return (
    <>
      {/* Scan-to-Sell */}
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Barcode className="h-4 w-4 text-emerald-600" />
            <Input
              placeholder="扫码/输入SKU快速出库"
              value={scanSku}
              onChange={e => onScanSkuChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onScanSell(); }}
              className="h-9 flex-1"
              disabled={scanLoading}
            />
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={onScanSell} disabled={scanLoading || !scanSku.trim()}>
              {scanLoading ? '查询中...' : '出库'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 md:hidden border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-3"
              onClick={onOpenScanner}
              disabled={scanLoading}
            >
              <Camera className="h-4 w-4 mr-1" /> 扫码
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 hidden md:flex border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={onOpenScanner}
              disabled={scanLoading}
              title="摄像头扫码"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md hover:border-emerald-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><Package className="h-16 w-16 text-emerald-500" /></div>
            <p className="text-sm text-muted-foreground">总库存</p><p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md hover:border-sky-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><CheckCircle className="h-16 w-16 text-sky-500" /></div>
            <p className="text-sm text-muted-foreground">在库中</p><p className="text-2xl font-bold text-emerald-600">{inStockCount}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md hover:border-amber-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><DollarSign className="h-16 w-16 text-amber-500" /></div>
            <p className="text-sm text-muted-foreground">总成本</p><p className="text-2xl font-bold text-emerald-600">{formatPrice(totalCost)}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md hover:border-purple-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><BarChart3 className="h-16 w-16 text-purple-500" /></div>
            <p className="text-sm text-muted-foreground">总货值</p><p className="text-2xl font-bold">{formatPrice(totalMarketValue)}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
