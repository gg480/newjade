'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, FileDown, FileSpreadsheet, Plus, CheckSquare, ArrowDown, ArrowUp,
  CircleDot, SlidersHorizontal, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { MATERIAL_CATEGORIES } from '../settings-tab';

// ========== Active Filter Tags Component ==========
interface ActiveFilterTagsProps {
  filters: {
    materialCategory: string; materialId: string; status: string; keyword: string;
    counter: string; batchId: string; minPrice: string; maxPrice: string;
    purchaseStartDate: string; purchaseEndDate: string;
  };
  materials: any[];
  allBatches: any[];
  allCounters: number[];
  onClearAll: () => void;
  onClear: (key: string) => void;
}

function ActiveFilterTags({ filters, materials, allBatches, allCounters, onClearAll, onClear }: ActiveFilterTagsProps) {
  const tags: { key: string; label: string }[] = [];
  if (filters.keyword) tags.push({ key: 'keyword', label: `关键词: ${filters.keyword}` });
  if (filters.materialCategory) {
    const cat = MATERIAL_CATEGORIES.find(c => c.value === filters.materialCategory);
    tags.push({ key: 'materialCategory', label: cat?.label || filters.materialCategory });
  }
  if (filters.materialId) {
    const mat = materials.find((m: any) => String(m.id) === filters.materialId);
    tags.push({ key: 'materialId', label: mat?.name || filters.materialId });
  }
  if (filters.counter) tags.push({ key: 'counter', label: `${filters.counter}号柜` });
  if (filters.batchId) {
    const batch = allBatches.find((b: any) => String(b.id) === filters.batchId);
    tags.push({ key: 'batchId', label: batch?.batchCode || filters.batchId });
  }
  if (filters.minPrice) tags.push({ key: 'minPrice', label: `最低价: ¥${filters.minPrice}` });
  if (filters.maxPrice) tags.push({ key: 'maxPrice', label: `最高价: ¥${filters.maxPrice}` });
  if (filters.purchaseStartDate) tags.push({ key: 'purchaseStartDate', label: `采购起始: ${filters.purchaseStartDate}` });
  if (filters.purchaseEndDate) tags.push({ key: 'purchaseEndDate', label: `采购截止: ${filters.purchaseEndDate}` });

  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs px-2 py-0.5">
        筛选中 ({tags.length})
      </Badge>
      {tags.map(tag => (
        <button
          key={tag.key}
          onClick={() => onClear(tag.key)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted/80 hover:bg-muted text-foreground transition-colors group"
        >
          <span>{tag.label}</span>
          <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
      >
        清除全部
      </button>
    </div>
  );
}

// ========== Filter Bar Props ==========
interface FilterBarProps {
  // Status toggle
  activeStatuses: Set<string>;
  onToggleStatusFilter: (status: string) => void;
  statusCounts: { in_stock: number; sold: number; returned: number };

  // Filters
  filters: {
    materialCategory: string; materialId: string; status: string; keyword: string;
    counter: string; batchId: string; minPrice: string; maxPrice: string;
    purchaseStartDate: string; purchaseEndDate: string;
  };
  onFiltersChange: (fn: (prev: FilterBarProps['filters']) => FilterBarProps['filters']) => void;
  searchField: string;
  onSearchFieldChange: (v: string) => void;

  // Dropdown data
  materials: any[];
  filteredMaterials: any[];
  allBatches: any[];
  allCounters: number[];

  // More filters
  showMoreFilters: boolean;
  onToggleMoreFilters: () => void;

  // Search action
  onSearch: () => void;
  onResetFilters: () => void;

  // Sort
  sortBy: string;
  onSortByChange: (v: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderToggle: () => void;
  sortFieldLabels: Record<string, string>;

  // Toolbar
  onCreateItem: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  exportApiInventoryUrl: string;
  isExportDisabled: boolean;

  // Selection
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;

  // Active filters
  onClearFilter: (key: string) => void;
}

export default function InventoryFilterBar({
  activeStatuses, onToggleStatusFilter, statusCounts,
  filters, onFiltersChange,
  searchField, onSearchFieldChange,
  materials, filteredMaterials, allBatches, allCounters,
  showMoreFilters, onToggleMoreFilters,
  onSearch, onResetFilters,
  sortBy, onSortByChange, sortOrder, onSortOrderToggle, sortFieldLabels,
  onCreateItem, onExportCSV, onExportExcel, exportApiInventoryUrl, isExportDisabled,
  isAllSelected, isSomeSelected, onToggleSelectAll,
  onClearFilter,
}: FilterBarProps) {
  return (
    <Card>
      <CardContent className="p-4">
        {/* Status Filter Toggle Buttons */}
        <div className="flex items-center gap-2 mb-3">
          <CircleDot className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">状态筛选</span>
          {[
            { key: 'in_stock', label: '在库', activeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600', count: statusCounts.in_stock },
            { key: 'sold', label: '已售', activeClass: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500', count: statusCounts.sold },
            { key: 'returned', label: '已退', activeClass: 'bg-red-500 hover:bg-red-600 text-white border-red-500', count: statusCounts.returned },
          ].map(s => {
            const isActive = activeStatuses.has(s.key);
            return (
              <Button
                key={s.key}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                className={`h-7 text-xs px-3 rounded-full transition-all duration-150 ${isActive ? s.activeClass : ''}`}
                onClick={() => onToggleStatusFilter(s.key)}
              >
                {s.label}
                <Badge variant="secondary" className={`ml-1.5 h-4 min-w-[18px] px-1 text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {s.count}
                </Badge>
              </Button>
            );
          })}
          {activeStatuses.size === 0 && (
            <span className="text-xs text-muted-foreground ml-1">显示全部状态</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
          {/* Keyword Search */}
          <div className="space-y-1 relative">
            <Label className="text-xs">关键词</Label>
            <div className="relative flex gap-1.5">
              <Select value={searchField} onValueChange={onSearchFieldChange}>
                <SelectTrigger className="w-20 h-9 text-xs shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="name">名称</SelectItem>
                  <SelectItem value="material">材质</SelectItem>
                  <SelectItem value="type">器型</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Input
                  placeholder={searchField === 'all' ? 'SKU/名称/证书' : searchField === 'sku' ? '搜索SKU...' : searchField === 'name' ? '搜索名称...' : searchField === 'material' ? '搜索材质...' : '搜索器型...'}
                  value={filters.keyword}
                  onChange={e => onFiltersChange(f => ({ ...f, keyword: e.target.value }))}
                  className="h-9 pr-8"
                />
                {filters.keyword && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      onFiltersChange(f => ({ ...f, keyword: '' }));
                      const input = document.querySelector('input[placeholder*="SKU"]') as HTMLInputElement;
                      if (input) input.focus();
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Material Category */}
          <div className="space-y-1">
            <Label className="text-xs">材质大类</Label>
            <Select value={filters.materialCategory || '_all'} onValueChange={v => {
              const cat = v === '_all' ? '' : v;
              onFiltersChange(f => ({ ...f, materialCategory: cat, materialId: '' }));
            }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部大类" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部大类</SelectItem>
                {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Material */}
          <div className="space-y-1">
            <Label className="text-xs">材质</Label>
            <Select value={filters.materialId || 'all'} onValueChange={v => onFiltersChange(f => ({ ...f, materialId: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部材质" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部材质</SelectItem>
                {filteredMaterials.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs">状态</Label>
            <Select
              value={activeStatuses.size === 1 ? Array.from(activeStatuses)[0] : activeStatuses.size === 0 ? 'all' : 'multi'}
              onValueChange={v => {
                if (v === 'all') { onFiltersChange(f => ({ ...f, status: '' })); /* handled via reset */ }
                else onToggleStatusFilter(v);
              }}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="in_stock">在库</SelectItem>
                <SelectItem value="sold">已售</SelectItem>
                <SelectItem value="returned">已退</SelectItem>
                <SelectItem value="multi" disabled>多选(用上方按钮)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Counter */}
          <div className="space-y-1">
            <Label className="text-xs">柜台</Label>
            <Select value={filters.counter || 'all'} onValueChange={v => onFiltersChange(f => ({ ...f, counter: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部柜台</SelectItem>
                {allCounters.map(c => <SelectItem key={c} value={String(c)}>{c}号柜</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Batch */}
          <div className="space-y-1">
            <Label className="text-xs">批次</Label>
            <Select value={filters.batchId || 'all'} onValueChange={v => onFiltersChange(f => ({ ...f, batchId: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="全部批次" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部批次</SelectItem>
                {allBatches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Search + Reset Buttons */}
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={onSearch} className="h-9"><Search className="h-3 w-3 mr-1" />搜索</Button>
            <Button size="sm" variant="outline" onClick={onResetFilters} className="h-9">重置</Button>
          </div>
        </div>

        {/* More Filters Toggle */}
        <div className="mt-3">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={onToggleMoreFilters}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>更多筛选</span>
            {showMoreFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {(filters.minPrice || filters.maxPrice || filters.purchaseStartDate || filters.purchaseEndDate) && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0">已启用</Badge>
            )}
          </button>
        </div>

        {/* Collapsible More Filters */}
        {showMoreFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-3 bg-muted/30 rounded-lg animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="space-y-1"><Label className="text-xs">最低售价</Label><Input type="number" placeholder="¥" value={filters.minPrice} onChange={e => onFiltersChange(f => ({ ...f, minPrice: e.target.value }))} className="h-9" min="0" /></div>
            <div className="space-y-1"><Label className="text-xs">最高售价</Label><Input type="number" placeholder="¥" value={filters.maxPrice} onChange={e => onFiltersChange(f => ({ ...f, maxPrice: e.target.value }))} className="h-9" min="0" /></div>
            <div className="space-y-1"><Label className="text-xs">采购起始日期</Label><Input type="date" value={filters.purchaseStartDate} onChange={e => onFiltersChange(f => ({ ...f, purchaseStartDate: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">采购截止日期</Label><Input type="date" value={filters.purchaseEndDate} onChange={e => onFiltersChange(f => ({ ...f, purchaseEndDate: e.target.value }))} className="h-9" /></div>
          </div>
        )}

        {/* Active filter tags */}
        <ActiveFilterTags filters={filters} materials={materials} allBatches={allBatches} allCounters={allCounters} onClearAll={onResetFilters} onClear={onClearFilter} />

        {/* Toolbar */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={onCreateItem}><Plus className="h-3 w-3 mr-1" />新增入库</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={onExportCSV} disabled={isExportDisabled}><FileDown className="h-3 w-3 mr-1" />导出CSV</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={onExportExcel} disabled={isExportDisabled}><FileSpreadsheet className="h-3 w-3 mr-1" />导出Excel</Button>
            <a href={exportApiInventoryUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-9">完整导出</Button>
            </a>
            {/* Mobile Select All */}
            <Button size="sm" variant="outline" className="h-9 md:hidden" onClick={onToggleSelectAll}>
              <CheckSquare className="h-3 w-3 mr-1" />
              {isAllSelected ? '取消全选' : '选择全部'}
            </Button>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">排序</Label>
            <Select value={sortBy} onValueChange={onSortByChange}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(sortFieldLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onSortOrderToggle} title={sortOrder === 'desc' ? '降序' : '升序'}>
              {sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
