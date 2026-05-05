'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X, Pencil, Copy, DollarSign as DollarSignIcon, Package, Tag, Gem, FileText,
  Layers, MapPin, CalendarDays, FileCheck, Info, Clock, ArrowUp, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice, StatusBadge } from '../shared';

type GetTagColorFn = (tagName: string) => string;

interface SlidePanelProps {
  selectedItemId: number | null;
  sortedItems: any[];
  onClose: () => void;
  onEdit: (id: number) => void;
  onQuickSell: (item: any) => void;
  onRestoreToStock: (id: number) => void;
  getTagColor: GetTagColorFn;
}

function ItemSlideContent({
  item,
  onClose,
  onEdit,
  onQuickSell,
  onRestoreToStock,
  getTagColor,
}: {
  item: any;
  onClose: () => void;
  onEdit: (id: number) => void;
  onQuickSell: (item: any) => void;
  onRestoreToStock: (id: number) => void;
  getTagColor: GetTagColorFn;
}) {
  const cost = item.allocatedCost || item.estimatedCost || item.costPrice || 0;
  const margin = item.sellingPrice > 0 ? ((item.sellingPrice - cost) / item.sellingPrice * 100) : 0;
  const itemTagsRaw: any[] = item.tags ? (Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? item.tags.split(',').filter(Boolean) : []) : [];
  const itemTags: string[] = itemTagsRaw.map((t: any) => typeof t === 'string' ? t : t.name || '');
  const specFields = item.specFields ? (typeof item.specFields === 'string' ? (() => { try { return JSON.parse(item.specFields); } catch { return {}; } })() : item.specFields) : {};

  return (
    <>
      {/* ===== DESKTOP Panel ===== */}
      <div className="hidden md:block fixed top-0 right-0 bottom-0 w-[320px] bg-card border-l border-border z-40 shadow-xl animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-start justify-between gap-2 z-10">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{item.name || item.skuCode}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.skuCode}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cover Image */}
        {item.coverImage && (
          <div className="px-4 pt-4">
            <Gem className="h-8 w-8 text-muted-foreground/20" />
            <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-full aspect-square object-cover rounded-lg bg-muted opacity-0 -mt-10 relative z-10" loading="lazy" onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.classList.replace('opacity-0', 'opacity-100'); }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}

        {/* Actions */}
        <DesktopPanelActions item={item} onClose={onClose} onEdit={onEdit} onQuickSell={onQuickSell} onRestoreToStock={onRestoreToStock} />

        {/* Details */}
        <PanelDetails item={item} cost={cost} margin={margin} itemTags={itemTags} specFields={specFields} getTagColor={getTagColor} />
      </div>

      {/* ===== MOBILE Panel ===== */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-card rounded-t-2xl border-t border-border shadow-xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar">
        {/* Drag indicator */}
        <div className="sticky top-0 bg-card pt-2 pb-1 px-4 z-10 flex justify-center">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{item.name || item.skuCode}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.skuCode}</p>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={item.status} />
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Cover Image */}
        {item.coverImage && (
          <div className="px-4">
            <Gem className="h-10 w-10 text-muted-foreground/20" />
            <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-40 h-40 object-cover rounded-lg bg-muted opacity-0 -mt-12 relative z-10" loading="lazy" onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.classList.replace('opacity-0', 'opacity-100'); }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}

        {/* Actions - Mobile */}
        <DesktopPanelActions item={item} onClose={onClose} onEdit={onEdit} onQuickSell={onQuickSell} onRestoreToStock={onRestoreToStock} />

        {/* Mobile: Status + Inventory Days */}
        <MobileStatusBar item={item} />

        {/* Mobile Details (compact) */}
        <MobileDetails item={item} cost={cost} margin={margin} itemTags={itemTags} specFields={specFields} getTagColor={getTagColor} />
      </div>
    </>
  );
}

// ===== Desktop Panel Actions =====
function DesktopPanelActions({
  item,
  onClose,
  onEdit,
  onQuickSell,
  onRestoreToStock,
}: {
  item: any;
  onClose: () => void;
  onEdit: (id: number) => void;
  onQuickSell: (item: any) => void;
  onRestoreToStock: (id: number) => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { onClose(); onEdit(item.id); }}>
        <Pencil className="h-3 w-3 mr-1" />编辑
      </Button>
      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => {
        navigator.clipboard.writeText(item.skuCode);
        toast.success('SKU已复制到剪贴板');
      }}>
        <Copy className="h-3 w-3 mr-1" />复制SKU
      </Button>
      {item.status === 'in_stock' && (
        <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => {
          onClose();
          onQuickSell(item);
        }}>
          <DollarSignIcon className="h-3 w-3 mr-1" />快速出库
        </Button>
      )}
      {item.status === 'returned' && (
        <Button size="sm" className="flex-1 h-8 text-xs bg-orange-600 hover:bg-orange-700" onClick={() => onRestoreToStock(item.id)}>
          <Package className="h-3 w-3 mr-1" />恢复在库
        </Button>
      )}
    </div>
  );
}

// ===== Panel Details (shared between desktop and mobile) =====
function PanelDetails({
  item,
  cost,
  margin,
  itemTags,
  specFields,
  getTagColor,
}: {
  item: any;
  cost: number;
  margin: number;
  itemTags: string[];
  specFields: Record<string, any>;
  getTagColor: GetTagColorFn;
}) {
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Status + Inventory Days */}
      <div className="flex items-center gap-2">
        <StatusBadge status={item.status} />
        {item.ageDays != null && (
          <Badge variant="outline" className={`text-xs ${item.ageDays < 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : item.ageDays <= 90 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'}`}>
            <Clock className="h-3 w-3 mr-1" />
            库龄 {item.ageDays}天
          </Badge>
        )}
      </div>

      {/* Profit/Loss for sold/returned items */}
      {(item.status === 'sold' || item.status === 'returned') && item.sellingPrice > 0 && (
        <div className={`p-3 rounded-lg ${item.status === 'sold' ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'}`}>
          <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
            {item.status === 'sold' ? <ArrowUp className="h-3 w-3 text-emerald-600" /> : <RotateCcw className="h-3 w-3 text-amber-600" />}
            {item.status === 'sold' ? '销售记录' : '已退货'}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">售价</span>
              <span className="font-medium text-emerald-600">{formatPrice(item.sellingPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">成本</span>
              <span className="font-medium">{formatPrice(cost)}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
              <span className="text-muted-foreground">利润</span>
              <span className={`font-bold ${(item.sellingPrice - cost) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(item.sellingPrice - cost) >= 0 ? '+' : ''}{formatPrice(item.sellingPrice - cost)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Price Info */}
      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">成本</span>
          <span className="font-medium">{formatPrice(cost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">售价</span>
          <span className="font-bold text-emerald-600">{formatPrice(item.sellingPrice)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">毛利率</span>
          <span className={`font-medium ${margin >= 30 ? 'text-emerald-600' : margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Material & Type */}
      <div className="space-y-2 text-sm">
        {item.materialName && (
          <div className="flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">材质:</span><span>{item.materialName}</span></div>
        )}
        {item.typeName && (
          <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">器型:</span><span>{item.typeName}</span></div>
        )}
        {item.batchCode && (
          <div className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">批次:</span><Badge variant="outline" className="font-mono text-xs">{item.batchCode}</Badge></div>
        )}
        {item.counter != null && (
          <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">柜台:</span><span>{item.counter}号柜</span></div>
        )}
        {item.purchaseDate && (
          <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">采购日期:</span><span>{item.purchaseDate}</span></div>
        )}
        {item.certNo && (
          <div className="flex items-center gap-2"><FileCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">证书编号:</span><span className="font-mono text-xs">{item.certNo}</span></div>
        )}
      </div>

      {/* Spec Fields */}
      {Object.keys(specFields).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-muted-foreground" />规格参数</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(specFields).map(([key, val]) => {
              const specLabelMap: Record<string, string> = { weight: '克重', metalWeight: '金重', size: '尺寸', braceletSize: '圈口', beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈' };
              const displayVal = typeof val === 'object' ? (val as any)?.value || '' : val;
              return (
                <div key={key} className="text-xs p-1.5 bg-muted/50 rounded">
                  <span className="text-muted-foreground">{specLabelMap[key] || key}:</span> {displayVal}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      {itemTags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-purple-500" />标签</p>
          <div className="flex flex-wrap gap-1">
            {itemTags.map((tag: string) => (
              <span key={tag} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div className="space-y-1">
          <p className="text-sm font-medium">备注</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
        </div>
      )}
    </div>
  );
}

// ===== Mobile Status Bar =====
function MobileStatusBar({ item }: { item: any }) {
  return (
    <div className="px-4 flex items-center gap-2">
      <StatusBadge status={item.status} />
      {item.ageDays != null && (
        <Badge variant="outline" className={`text-xs ${item.ageDays < 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : item.ageDays <= 90 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'}`}>
          <Clock className="h-3 w-3 mr-1" />
          库龄 {item.ageDays}天
        </Badge>
      )}
    </div>
  );
}

// ===== Mobile Details (compact) =====
function MobileDetails({
  item,
  cost,
  margin,
  itemTags,
  specFields,
  getTagColor,
}: {
  item: any;
  cost: number;
  margin: number;
  itemTags: string[];
  specFields: Record<string, any>;
  getTagColor: GetTagColorFn;
}) {
  return (
    <div className="px-4 pb-8 space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <div><span className="text-muted-foreground">成本</span><br/><span className="font-medium">{formatPrice(cost)}</span></div>
        <div><span className="text-muted-foreground">售价</span><br/><span className="font-bold text-emerald-600">{formatPrice(item.sellingPrice)}</span></div>
        <div><span className="text-muted-foreground">毛利率</span><br/><span className={`font-medium ${margin >= 30 ? 'text-emerald-600' : margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</span></div>
      </div>
      <div className="space-y-1.5 text-sm">
        {item.materialName && <p><span className="text-muted-foreground">材质:</span> {item.materialName}</p>}
        {item.typeName && <p><span className="text-muted-foreground">器型:</span> {item.typeName}</p>}
        {item.batchCode && <p><span className="text-muted-foreground">批次:</span> <Badge variant="outline" className="font-mono text-xs">{item.batchCode}</Badge></p>}
        {item.counter != null && <p><span className="text-muted-foreground">柜台:</span> {item.counter}号柜</p>}
        {item.purchaseDate && <p><span className="text-muted-foreground">采购日期:</span> {item.purchaseDate}</p>}
        {item.certNo && <p><span className="text-muted-foreground">证书:</span> <span className="font-mono text-xs">{item.certNo}</span></p>}
      </div>
      {Object.keys(specFields).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(specFields).map(([key, val]) => {
            const specLabelMap: Record<string, string> = { weight: '克重', metalWeight: '金重', size: '尺寸', braceletSize: '圈口', beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈' };
            const displayVal = typeof val === 'object' ? (val as any)?.value || '' : val;
            return <span key={key} className="text-xs px-2 py-0.5 bg-muted/50 rounded">{specLabelMap[key] || key}: {displayVal}</span>;
          })}
        </div>
      )}
      {itemTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {itemTags.map((tag: string) => (
            <span key={tag} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
          ))}
        </div>
      )}
      {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
    </div>
  );
}

// ===== Main Slide Panel Component =====
export default function InventoryItemSlidePanel({
  selectedItemId,
  sortedItems,
  onClose,
  onEdit,
  onQuickSell,
  onRestoreToStock,
  getTagColor,
}: SlidePanelProps) {
  if (selectedItemId === null) return null;

  const item = sortedItems.find(i => i.id === selectedItemId);
  if (!item) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <ItemSlideContent
        item={item}
        onClose={onClose}
        onEdit={onEdit}
        onQuickSell={onQuickSell}
        onRestoreToStock={onRestoreToStock}
        getTagColor={getTagColor}
      />
    </>
  );
}
