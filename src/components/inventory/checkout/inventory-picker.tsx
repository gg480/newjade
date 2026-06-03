'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { itemsApi, dictsApi } from '@/lib/api';
import type { ItemSummary, DictMaterial, DictType } from '@/lib/api.types';
import { toast } from 'sonner';
import { Search, Plus, Loader2, Package, X, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CheckoutItem } from './step-items';

// ==================== 类型定义 ====================

interface InventoryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CheckoutItem) => void;
}

// ==================== 工具函数 ====================

/** 将 ItemSummary 转换为 CheckoutItem */
function toCheckoutItem(item: ItemSummary): CheckoutItem {
  return {
    id: item.id,
    skuCode: item.skuCode,
    name: item.name || item.skuCode,
    sellingPrice: item.sellingPrice,
    actualPrice: item.sellingPrice,
    materialName: item.material?.name || '',
    typeName: item.type?.name || '',
    image: item.images?.find(img => img.isCover)?.url || item.images?.[0]?.url,
  };
}

// ==================== 组件 ====================

/**
 * 库存选择面板（Dialog）
 *
 * 在收银台 Step 2 中打开，用于从库存中搜索并选择货品。
 * 仅展示 `status='in_stock'` 的货品。
 * 支持关键词搜索 + 材质/器型筛选 + 分页。
 */
export default function InventoryPicker({ open, onOpenChange, onSelect }: InventoryPickerProps) {
  // ===== 数据状态 =====
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);

  // ===== 加载状态 =====
  const [loading, setLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(false);

  // ===== 筛选状态 =====
  const [keyword, setKeyword] = useState('');
  const [materialId, setMaterialId] = useState<string>('');
  const [typeId, setTypeId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

  // ===== 加载字典数据 =====
  useEffect(() => {
    if (!open) return;
    setMaterialsLoading(true);
    setTypesLoading(true);

    Promise.all([
      dictsApi.getMaterials().then(setMaterials).catch(() => {
        toast.error('加载材质列表失败');
        setMaterials([]);
      }).finally(() => setMaterialsLoading(false)),
      dictsApi.getTypes().then(setTypes).catch(() => {
        toast.error('加载器型列表失败');
        setTypes([]);
      }).finally(() => setTypesLoading(false)),
    ]);
  }, [open]);

  // ===== 加载货品数据 =====
  const loadItems = useCallback(async (kw: string, matId: string, typId: string, pg: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        status: 'in_stock',
        page: String(pg),
        size: String(PAGE_SIZE),
      };
      if (kw.trim()) params.keyword = kw.trim();
      if (matId) params.material_id = matId;
      if (typId) params.type_id = typId;

      const data = await itemsApi.getItems(params);
      setItems(data.items || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '加载库存失败';
      toast.error(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== 初始化 & 筛选变化时重新加载 =====
  useEffect(() => {
    if (!open) return;
    loadItems(keyword, materialId, typeId, page);
  }, [open, keyword, materialId, typeId, page, loadItems]);

  // ===== 关键词防抖搜索 =====
  function handleKeywordChange(value: string) {
    setKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 400);
  }

  // ===== 材质变化时清空器型并重置页码 =====
  function handleMaterialChange(value: string) {
    setMaterialId(value);
    setTypeId('');
    setPage(1);
  }

  function handleTypeChange(value: string) {
    setTypeId(value);
    setPage(1);
  }

  // ===== 分页 =====
  function goToPage(pg: number) {
    if (pg >= 1 && pg <= totalPages) {
      setPage(pg);
    }
  }

  // ===== 添加货品 =====
  function handleAdd(item: ItemSummary) {
    onSelect(toCheckoutItem(item));
  }

  // ===== 关闭时重置 =====
  function handleOpenChange(open: boolean) {
    if (!open) {
      // 延迟重置，避免关闭动画期间闪烁
      setTimeout(() => {
        setKeyword('');
        setMaterialId('');
        setTypeId('');
        setPage(1);
        setItems([]);
      }, 200);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>从库存选择货品</DialogTitle>
        </DialogHeader>

        {/* ===== 搜索 & 筛选栏 ===== */}
        <div className="space-y-2">
          {/* 关键词搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={e => handleKeywordChange(e.target.value)}
              className="pl-9 h-9"
              placeholder="搜索 SKU / 名称..."
            />
          </div>

          {/* 材质 & 器型筛选 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={materialId} onValueChange={handleMaterialChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="全部材质" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部材质</SelectItem>
                  {materials.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={typeId} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="全部器型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部器型</SelectItem>
                  {types.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 结果计数 */}
          <p className="text-xs text-muted-foreground px-1">
            {loading ? '搜索中...' : `共 ${total} 件在库货品`}
          </p>
        </div>

        {/* ===== 货品列表 ===== */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">无匹配货品</p>
              <p className="text-xs mt-1">请调整搜索条件后重试</p>
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 hover:bg-accent transition-colors"
              >
                {/* 缩略图 */}
                <div className="h-9 w-9 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                  {item.images?.find(img => img.isCover)?.url || item.images?.[0]?.url ? (
                    <img
                      src={item.images!.find(img => img.isCover)?.url || item.images![0].url}
                      alt={item.name || item.skuCode}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>

                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.name || item.skuCode}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground truncate max-w-[120px]">
                      {item.skuCode}
                    </code>
                    {item.material?.name && (
                      <span className="text-[10px] text-muted-foreground">{item.material.name}</span>
                    )}
                  </div>
                </div>

                {/* 售价 */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ¥{item.sellingPrice.toFixed(2)}
                  </p>
                </div>

                {/* 添加按钮 */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(item)}
                  className="shrink-0 h-8 w-8 p-0 border-emerald-300 dark:border-emerald-700
                             text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50
                             dark:hover:bg-emerald-950/30"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* ===== 分页 ===== */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              第 {page}/{totalPages} 页
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
