'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal, Pencil, ShoppingCart, RotateCcw, Trash2, Copy, Eye,
  Layers, Camera, Gem, Plus, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice, StatusBadge } from '../shared';
import SortableHead from './inventory-sortable-head';

// 标签颜色映射（由主文件通过 props 传入）
type GetTagColorFn = (tagName: string) => string;

interface DesktopTableProps {
  sortedItems: any[];
  selectedIds: Set<number>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: string) => void;
  onSortOrderToggle: () => void;
  onToggleSelectAll: () => void;
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
  getTagColor: GetTagColorFn;
}

export default function InventoryDesktopTable({
  sortedItems,
  selectedIds,
  isAllSelected,
  isSomeSelected,
  sortBy,
  sortOrder,
  onSortChange,
  onSortOrderToggle,
  onToggleSelectAll,
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
  getTagColor,
}: DesktopTableProps) {
  if (sortedItems.length === 0) return null;

  return (
    <Card className="hidden md:block">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                    onCheckedChange={onToggleSelectAll}
                    className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
                  />
                </TableHead>
                <TableHead className="w-12 px-2">图</TableHead>
                <SortableHead field="sku_code" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} onSortOrderToggle={onSortOrderToggle}>SKU</SortableHead>
                <SortableHead field="name" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} onSortOrderToggle={onSortOrderToggle}>名称</SortableHead>
                <TableHead>材质</TableHead><TableHead>器型</TableHead><TableHead>所属批次</TableHead>
                <TableHead>标签</TableHead>
                <SortableHead field="cost_price" align="right" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} onSortOrderToggle={onSortOrderToggle}>成本</SortableHead>
                <SortableHead field="selling_price" align="right" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} onSortOrderToggle={onSortOrderToggle}>售价</SortableHead>
                <TableHead className="text-center">毛利</TableHead>
                <SortableHead field="purchase_date" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} onSortOrderToggle={onSortOrderToggle}>采购日期</SortableHead>
                <TableHead>状态</TableHead><TableHead>库龄</TableHead><TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, idx) => (
                <TableRow
                  key={item.id}
                  className={`group hover:bg-muted/50 transition-all duration-150 border-l-2 border-l-transparent hover:border-l-emerald-400 ${idx % 2 === 1 ? 'even:bg-muted/20' : ''} ${selectedIds.has(item.id) ? 'bg-emerald-50 dark:bg-emerald-950/20 hover:border-l-emerald-500' : item.status === 'sold' ? 'hover:border-l-gray-400' : item.status === 'returned' ? 'hover:border-l-red-400' : ''} cursor-pointer`}
                  onClick={() => onSelectItem(item.id)}
                >
                  <TableCell className="w-10 px-3" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => onToggleSelect(item.id)}
                    />
                  </TableCell>
                  {/* Image Cell */}
                  <TableCell className="w-12 px-2" onClick={e => e.stopPropagation()}>
                    {item.coverImage ? (
                      <div className="relative group/img">
                        <button
                          type="button"
                          className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md"
                          onClick={(e) => { e.stopPropagation(); onOpenLightbox(item.id); }}
                        >
                          <Gem className="absolute h-3.5 w-3.5 text-muted-foreground/30 pointer-events-none" style={{ left: '9px', top: '9px' }} />
                          <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-10 h-10 rounded-md object-cover aspect-square bg-muted hover:ring-2 hover:ring-emerald-400 transition-all duration-300 opacity-100" loading="lazy" onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.classList.replace('opacity-100', 'opacity-40');
                          }} />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                            <Camera className="h-3.5 w-3.5 text-white drop-shadow-md" />
                          </div>
                        </button>
                        <div className="absolute left-14 top-0 z-10 hidden group-hover/img:block pointer-events-none">
                          <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-[200px] h-[200px] rounded-lg object-cover shadow-lg border border-border bg-background" loading="lazy" />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-10 h-10 rounded-md bg-muted/60 border border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                        title="可添加图片"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowDetailDialog(item.id);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </button>
                    )}
                  </TableCell>
                  {/* SKU Cell */}
                  <TableCell className="font-mono text-xs">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制到剪贴板')).catch(() => toast.error('复制失败')); }}
                      title="点击复制SKU"
                    >
                      {item.skuCode}
                    </button>
                  </TableCell>
                  <TableCell>{item.name || item.skuCode}</TableCell>
                  <TableCell>{item.materialName}</TableCell>
                  <TableCell>{item.typeName || '-'}</TableCell>
                  {/* Batch */}
                  <TableCell>
                    {item.batchCode ? (
                      <Badge variant="outline" className="cursor-pointer hover:bg-muted font-mono text-xs" onClick={() => onNavigateToBatches()} title="点击查看批次详情">
                        <Layers className="h-2.5 w-2.5 mr-1" />{item.batchCode}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  {/* Tags */}
                  <TableCell>
                    {(() => {
                      const tgs: any[] = item.tags ? (Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? item.tags.split(',').filter(Boolean) : []) : [];
                      const tagLabels: string[] = tgs.map((t: any) => typeof t === 'string' ? t : t.name || '');
                      if (tagLabels.length === 0) return <span className="text-muted-foreground">—</span>;
                      return <div className="flex flex-wrap gap-1 max-w-[160px]">{tagLabels.slice(0, 3).map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className={`text-[10px] h-5 px-1.5 ${getTagColor(t)}`}>{t}</Badge>
                      ))}{tagLabels.length > 3 && <span className="text-[10px] text-muted-foreground">+{tagLabels.length - 3}</span>}</div>;
                    })()}
                  </TableCell>
                  {/* Cost */}
                  <TableCell className="text-right">
                    {item.allocatedCost ? formatPrice(item.allocatedCost) : item.estimatedCost ? <span className="text-muted-foreground" title="预估成本">{formatPrice(item.estimatedCost)}~</span> : formatPrice(item.costPrice)}
                  </TableCell>
                  {/* Selling Price */}
                  <TableCell className="text-right font-medium text-emerald-600">{formatPrice(item.sellingPrice)}</TableCell>
                  {/* Margin */}
                  <TableCell className="text-center">
                    {(() => {
                      const cost = item.allocatedCost || item.estimatedCost || item.costPrice || 0;
                      const sp = item.sellingPrice || 0;
                      if (sp === 0 || cost === 0) return <span className="text-xs text-muted-foreground">—</span>;
                      const margin = ((sp - cost) / sp) * 100;
                      const colorClass = margin > 30 ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800' : margin > 10 ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800' : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40 border-red-200 dark:border-red-800';
                      return <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${colorClass}`}>{margin.toFixed(0)}%</Badge>;
                    })()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.purchaseDate || '-'}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className={item.ageDays > 90 ? 'text-red-600 font-medium' : ''}>{item.ageDays != null ? `${item.ageDays}天` : '-'}</TableCell>
                  {/* Actions */}
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShowEditDialog(item.id); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            <span>编辑</span>
                          </DropdownMenuItem>
                          {item.status === 'in_stock' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShowSaleDialog(item); }}>
                              <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                              <span>出库</span>
                            </DropdownMenuItem>
                          )}
                          {item.status === 'in_stock' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShowReturnConfirm(item); }}>
                              <RotateCcw className="h-3.5 w-3.5 mr-2" />
                              <span>退货</span>
                            </DropdownMenuItem>
                          )}
                          {item.status === 'returned' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRestoreToStock(item.id); }}>
                              <Package className="h-3.5 w-3.5 mr-2" />
                              <span>恢复在库</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            <span>删除</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制')).catch(() => toast.error('复制失败')); }}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            <span>复制SKU</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShowDetailDialog(item.id); }}>
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            <span>查看详情</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
