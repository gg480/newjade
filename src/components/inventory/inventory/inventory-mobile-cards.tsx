'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal, Pencil, ShoppingCart, RotateCcw, Trash2, Copy, Eye,
  Layers, Camera, Gem, Plus, Printer, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice, StatusBadge } from '../shared';

type GetTagColorFn = (tagName: string) => string;

interface MobileCardsProps {
  sortedItems: any[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpenLightbox: (itemId: number) => void;
  onSelectItem: (id: number) => void;
  onShowDetailDialog: (id: number) => void;
  onShowEditDialog: (id: number) => void;
  onShowSaleDialog: (item: any) => void;
  onShowReturnConfirm: (item: any) => void;
  onRestoreToStock: (id: number) => void;
  onDeleteItem: (id: number) => void;
  onNavigateToBatches: () => void;
  onPrintLabel: (item: any) => void;
  getTagColor: GetTagColorFn;
}

export default function InventoryMobileCards({
  sortedItems,
  selectedIds,
  onToggleSelect,
  onOpenLightbox,
  onSelectItem,
  onShowDetailDialog,
  onShowEditDialog,
  onShowSaleDialog,
  onShowReturnConfirm,
  onRestoreToStock,
  onDeleteItem,
  onNavigateToBatches,
  onPrintLabel,
  getTagColor,
}: MobileCardsProps) {
  if (sortedItems.length === 0) return null;

  return (
    <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sortedItems.map(item => (
        <Card key={item.id} className={`hover:shadow-md transition-shadow ${selectedIds.has(item.id) ? 'ring-2 ring-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/20' : ''} cursor-pointer`} onClick={() => onSelectItem(item.id)}>
          <CardContent className="p-4 space-y-3">
            {/* Header: Thumbnail + Checkbox + SKU + Status */}
            <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
              {item.coverImage ? (
                <button
                  type="button"
                  className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md shrink-0 relative"
                  onClick={(e) => { e.stopPropagation(); onOpenLightbox(item.id); }}
                >
                  <Gem className="absolute h-4 w-4 text-muted-foreground/30 pointer-events-none" style={{ left: '10px', top: '10px' }} />
                  <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-12 h-12 rounded-md object-cover aspect-square bg-muted hover:ring-2 hover:ring-emerald-400 transition-all opacity-100" loading="lazy" onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.classList.replace('opacity-100', 'opacity-40');
                  }} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera className="h-4 w-4 text-white drop-shadow-md" />
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  className="w-12 h-12 rounded-md bg-muted/60 border border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                  title="可添加图片"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDetailDialog(item.id);
                  }}
                >
                  <Plus className="h-4 w-4 text-muted-foreground/40" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => onToggleSelect(item.id)}
                    />
                  </div>
                  <span
                    className="font-mono text-xs text-muted-foreground hover:text-emerald-600 transition-colors truncate cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制到剪贴板')).catch(() => toast.error('复制失败')); }}
                    title="点击复制SKU"
                  >{item.skuCode}</span>
                </div>
                <p className="font-medium text-sm truncate mt-0.5">{item.name || item.skuCode}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            {/* Material + Type + Batch */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <span>{item.materialName}</span>
              <span>·</span>
              <span>{item.typeName || '-'}</span>
              {item.batchCode && (
                <>
                  <span>·</span>
                  <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted" onClick={() => onNavigateToBatches()}>
                    <Layers className="h-2 w-2 mr-0.5" />{item.batchCode}
                  </Badge>
                </>
              )}
            </div>
            {/* Tags */}
            {(() => {
              const tgs: any[] = item.tags ? (Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? item.tags.split(',').filter(Boolean) : []) : [];
              const tagLabels: string[] = tgs.map((t: any) => typeof t === 'string' ? t : t.name || '');
              if (tagLabels.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1">
                  {tagLabels.slice(0, 4).map((t: string, i: number) => (
                    <Badge key={i} variant="outline" className={`text-[10px] h-4 px-1.5 ${getTagColor(t)}`}>{t}</Badge>
                  ))}
                  {tagLabels.length > 4 && <span className="text-[10px] text-muted-foreground">+{tagLabels.length - 4}</span>}
                </div>
              );
            })()}
            {/* Price row: cost + selling + age */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-emerald-600">{formatPrice(item.sellingPrice)}</span>
                <span className="text-xs text-muted-foreground">
                  {item.allocatedCost
                    ? formatPrice(item.allocatedCost)
                    : item.estimatedCost
                      ? <span className="text-muted-foreground">{formatPrice(item.estimatedCost)}~</span>
                      : formatPrice(item.costPrice)}
                </span>
              </div>
              <span className={`text-xs ${item.ageDays != null && item.ageDays > 90 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{item.ageDays != null ? `${item.ageDays}天` : '-'}</span>
            </div>
            {/* Action buttons with DropdownMenu */}
            <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onShowDetailDialog(item.id)}><Eye className="h-3 w-3 mr-1" />详情</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-sky-600" onClick={() => onPrintLabel(item)}><Printer className="h-3 w-3 mr-1" />标签</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 px-1.5 text-xs">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onShowEditDialog(item.id)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /><span>编辑</span>
                  </DropdownMenuItem>
                  {item.status === 'in_stock' && (
                    <DropdownMenuItem onClick={() => onShowSaleDialog(item)}>
                      <ShoppingCart className="h-3.5 w-3.5 mr-2" /><span>出库</span>
                    </DropdownMenuItem>
                  )}
                  {item.status === 'in_stock' && (
                    <DropdownMenuItem onClick={() => onShowReturnConfirm(item)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-2" /><span>退货</span>
                    </DropdownMenuItem>
                  )}
                  {item.status === 'returned' && (
                    <DropdownMenuItem onClick={() => onRestoreToStock(item.id)}>
                      <Package className="h-3.5 w-3.5 mr-2" /><span>恢复在库</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onDeleteItem(item.id)} className="text-red-600 focus:text-red-600">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /><span>删除</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制')).catch(() => toast.error('复制失败')); }}>
                    <Copy className="h-3.5 w-3.5 mr-2" /><span>复制SKU</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
