'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import { itemsApi, dictsApi } from '@/lib/api';
import { Search, CheckSquare, X, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { MATERIAL_CATEGORIES } from '@/lib/constants';
import type { ItemSummary, DictMaterial, DictType } from '@/lib/api.types';

// API返回扩展字段
interface PromotionItem extends ItemSummary {
  materialName?: string;
  typeName?: string;
}

interface ItemQueryParams {
  page: number;
  size: number;
  status?: string;
  material_id?: string;
  type_id?: string;
  keyword?: string;
  minPrice?: string;
  maxPrice?: string;
}

// API 函数 — 改用统一客户端

// 促销商品选择组件
function PromotionItemSelect({ 
  open, 
  onClose, 
  onSelect, 
  selectedItemIds 
}: { 
  open: boolean; 
  onClose: (o: boolean) => void; 
  onSelect: (itemIds: number[]) => void;
  selectedItemIds: number[]
}) {
  const { handleError } = useErrorHandler();
  const [items, setItems] = useState<PromotionItem[]>([]);
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    materialCategory: '', 
    materialId: '', 
    typeId: '', 
    status: 'in_stock', 
    keyword: '', 
    minPrice: '', 
    maxPrice: '' 
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(selectedItemIds));
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // 加载数据
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        // 加载材质和器型
        const [materialsData, typesData] = await Promise.all([
          dictsApi.getMaterials(),
          dictsApi.getTypes()
        ]);
        
        if (!cancelled) {
          setMaterials(materialsData || []);
          setTypes(typesData || []);
        }

        // 加载商品
        const params: Record<string, string | number | undefined> = { 
          page: pagination.page, 
          size: pagination.size,
          status: filters.status
        };
        
        if (filters.materialId) params.material_id = filters.materialId;
        if (filters.typeId) params.type_id = filters.typeId;
        if (filters.keyword) params.keyword = filters.keyword;
        if (filters.minPrice) params.minPrice = filters.minPrice;
        if (filters.maxPrice) params.maxPrice = filters.maxPrice;
        
        const itemsData = await itemsApi.getItems(params as any);
        
        if (!cancelled) {
          setItems((itemsData.items || []) as PromotionItem[]);
          setPagination(itemsData.pagination || { total: 0, page: 1, size: 20, pages: 0 });
        }
      } catch (error) {
        console.error('[PromotionItemSelect] loadData FAILED:', error);
        if (!cancelled) handleError(error, { title: '加载商品失败' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    if (open) {
      loadData();
    }
    
    return () => { cancelled = true; };
  }, [open, pagination.page, pagination.size, filters]);

  // 当selectedItemIds变化时更新选中状态
  useEffect(() => {
    setSelectedIds(new Set(selectedItemIds));
  }, [selectedItemIds]);

  // 根据大类筛选材质
  const filteredMaterials = useMemo(() => {
    return materials.filter((m: DictMaterial) => {
      if (!filters.materialCategory) return true;
      return m.category === filters.materialCategory;
    });
  }, [materials, filters.materialCategory]);

  // 排序处理
  function toggleSortOrder() {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  }

  // 选择处理
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  }

  // 处理确认选择
  function handleConfirm() {
    onSelect(Array.from(selectedIds));
  }

  // 排序字段标签
  const sortFieldLabels: Record<string, string> = {
    created_at: '入库时间',
    selling_price: '售价',
    cost_price: '成本',
    purchase_date: '采购日期',
    sku_code: 'SKU编号',
    name: '名称',
  };

  // 商品的辅助指标（暂无数据时显示 -）
  function calculateItemMetrics(item: PromotionItem) {
    return {
      salesVolume: 0,
      stockLevel: item.status === 'in_stock' ? '充足' : '缺货',
      turnoverRate: 0,
    };
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>选择促销商品</DialogTitle>
          <DialogDescription>
            选择要参与促销活动的商品，支持多条件筛选
          </DialogDescription>
        </DialogHeader>
        
        {/* 筛选和操作 */}
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">关键词</Label>
              <Input 
                placeholder="搜索SKU/名称/证书" 
                value={filters.keyword} 
                onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))} 
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">材质大类</Label>
              <Select 
                value={filters.materialCategory || '_all'} 
                onValueChange={v => {
                  const cat = v === '_all' ? '' : v;
                  setFilters(f => ({ ...f, materialCategory: cat, materialId: '' }));
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部大类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">全部大类</SelectItem>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">材质</Label>
              <Select 
                value={filters.materialId || 'all'} 
                onValueChange={v => setFilters(f => ({ ...f, materialId: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部材质" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部材质</SelectItem>
                  {filteredMaterials.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">器型</Label>
              <Select 
                value={filters.typeId || 'all'} 
                onValueChange={v => setFilters(f => ({ ...f, typeId: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部器型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部器型</SelectItem>
                  {types.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button 
                size="sm" 
                onClick={() => {
                  setPagination(p => ({ ...p, page: 1 }));
                }} 
                className="h-9"
              >
                <Search className="h-3 w-3 mr-1" />
                搜索
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setFilters({ 
                    materialCategory: '', 
                    materialId: '', 
                    typeId: '', 
                    status: 'in_stock', 
                    keyword: '', 
                    minPrice: '', 
                    maxPrice: '' 
                  });
                }} 
                className="h-9"
              >
                重置
              </Button>
            </div>
          </div>
          
          {/* 更多筛选 */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>更多筛选</span>
              {showMoreFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            
            {showMoreFilters && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-muted/30 rounded-lg animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="space-y-1">
                  <Label className="text-xs">最低售价</Label>
                  <Input 
                    type="number" 
                    placeholder="¥" 
                    value={filters.minPrice} 
                    onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} 
                    className="h-9" 
                    min="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">最高售价</Label>
                  <Input 
                    type="number" 
                    placeholder="¥" 
                    value={filters.maxPrice} 
                    onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} 
                    className="h-9" 
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* 排序控制 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={toggleSelectAll}
                className="h-9"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                {selectedIds.size === items.length ? '取消全选' : '选择全部'}
              </Button>
              <span className="text-sm text-muted-foreground">
                已选择 {selectedIds.size} 件商品
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">排序</Label>
              <Select value={sortBy} onValueChange={v => setSortBy(v)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sortFieldLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 w-8 p-0" 
                onClick={toggleSortOrder} 
                title={sortOrder === 'desc' ? '降序' : '升序'}
              >
                {sortOrder === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>

        {/* 商品表格 */}
        <div className="mt-4">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={items.length > 0 && selectedIds.size === items.length} 
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>材质</TableHead>
                  <TableHead>器型</TableHead>
                  <TableHead>售价</TableHead>
                  <TableHead>库存状态</TableHead>
                  <TableHead>历史销量</TableHead>
                  <TableHead>库存水平</TableHead>
                  <TableHead>周转率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const metrics = calculateItemMetrics(item);
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(item.id)} 
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell>{item.skuCode}</TableCell>
                      <TableCell>{item.name || item.skuCode}</TableCell>
                      <TableCell>{item.materialName || item.material?.name}</TableCell>
                      <TableCell>{item.typeName || item.type?.name}</TableCell>
                      <TableCell>¥{item.sellingPrice}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {item.status === 'in_stock' ? '在库' : '已售'}
                        </span>
                      </TableCell>
                      <TableCell>{metrics.salesVolume}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${metrics.stockLevel === '充足' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {metrics.stockLevel}
                        </span>
                      </TableCell>
                      <TableCell>{metrics.turnoverRate}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          
          {/* 分页 */}
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              共 {pagination.total} 条记录
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
              >
                上一页
              </Button>
              <span className="text-sm">
                {pagination.page} / {pagination.pages || 1}
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages || 1, p.page + 1) }))}
                disabled={pagination.page === (pagination.pages || 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>取消</Button>
          <Button 
            onClick={handleConfirm} 
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={selectedIds.size === 0}
          >
            确认选择 ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PromotionItemSelect;
