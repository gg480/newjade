'use client';

import { useState, useCallback, useEffect } from 'react';
import { customersApi, salesApi } from '@/lib/api';
import { formatPrice } from './shared';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GitMerge, Search, User, ShoppingBag, Calendar, DollarSign, Loader2, CheckSquare, Square,
} from 'lucide-react';

interface CustomerMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 目标客户（合并到的客户） */
  targetCustomer: { id: number; name: string; phone?: string; customerCode?: string; tags?: string[] } | null;
  /** 合并完成后回调 */
  onMerged?: () => void;
}

/** 销售搜索结果行 */
interface SaleSearchRow {
  id: number;
  saleNo: string;
  saleDate: string;
  actualPrice: number;
  channel: string;
  itemSku: string;
  itemName: string;
  customerId: number | null;
  customerName: string | null;
}

export function CustomerMergeDialog({ open, onOpenChange, targetCustomer, onMerged }: CustomerMergeDialogProps) {
  // 搜索表单
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemKeyword, setItemKeyword] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // 搜索状态
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SaleSearchRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // 选择状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // 合并状态
  const [merging, setMerging] = useState(false);

  // 重置状态
  function reset() {
    setStartDate('');
    setEndDate('');
    setItemKeyword('');
    setMinAmount('');
    setMaxAmount('');
    setResults([]);
    setHasSearched(false);
    setSelectedIds(new Set());
    setSelectAll(false);
    setMerging(false);
  }

  // 关闭时重置
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  /** 搜索散客销售记录 */
  const handleSearch = useCallback(async () => {
    if (!targetCustomer) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const params: Record<string, any> = {
        customer_id: 'null',  // 搜索散客（无关联客户）
        size: 50,
        include_returned: 'false',
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (itemKeyword.trim()) params.item_keyword = itemKeyword.trim();
      if (minAmount && !isNaN(parseFloat(minAmount))) params.min_amount = minAmount;
      if (maxAmount && !isNaN(parseFloat(maxAmount))) params.max_amount = maxAmount;

      const data = await salesApi.getSales(params);
      const items = data?.items || [];
      setResults(items);
      setSelectedIds(new Set());
      setSelectAll(false);
    } catch (e: any) {
      toast.error(e.message || '搜索失败');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [targetCustomer, startDate, endDate, itemKeyword, minAmount, maxAmount]);

  /** 搜索已有客户的销售记录（跨客户合并） */
  const handleSearchWithCustomer = useCallback(async (sourceCustomerId: number) => {
    if (!targetCustomer) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const params: Record<string, any> = {
        customer_id: String(sourceCustomerId),
        size: 50,
        include_returned: 'false',
      };
      const data = await salesApi.getSales(params);
      const items = data?.items || [];
      setResults(items);
      setSelectedIds(new Set());
      setSelectAll(false);
    } catch (e: any) {
      toast.error(e.message || '搜索失败');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [targetCustomer]);

  /** 切换全选 */
  function toggleSelectAll() {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
      setSelectAll(true);
    }
  }

  /** 切换单行选择 */
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setSelectAll(next.size === results.length);
      return next;
    });
  }

  /** 执行合并 */
  async function handleMerge() {
    if (!targetCustomer || selectedIds.size === 0) return;

    setMerging(true);
    try {
      // 找出所有涉及的源客户ID（可能多个不同的客户或散客）
      const selectedRows = results.filter(r => selectedIds.has(r.id));
      const sourceCustomerIds = new Set<number>();

      for (const row of selectedRows) {
        if (row.customerId && row.customerId !== targetCustomer.id) {
          sourceCustomerIds.add(row.customerId);
        }
      }

      // 按源客户分组，分别调用合并API
      let totalMerged = 0;
      const errors: string[] = [];

      // 先处理关联了其他客户的销售记录（需要合并客户）
      for (const sourceId of sourceCustomerIds) {
        const saleIds = selectedRows
          .filter(r => r.customerId === sourceId)
          .map(r => r.id);
        try {
          await customersApi.mergeCustomer(sourceId, {
            targetCustomerId: targetCustomer.id,
            saleRecordIds: saleIds,
          });
          totalMerged += saleIds.length;
        } catch (e: any) {
          errors.push(`客户ID ${sourceId}: ${e.message}`);
        }
      }

      // 处理散客记录（customerId = null），直接更新销售记录
      const unlinkedSaleIds = selectedRows
        .filter(r => !r.customerId || r.customerId === targetCustomer.id)
        .map(r => r.id);

      if (unlinkedSaleIds.length > 0) {
        // 对散客记录，使用一个虚拟的合并操作（以目标客户为 source，target 也是目标客户自己）
        await customersApi.mergeCustomer(targetCustomer.id, {
          targetCustomerId: targetCustomer.id,
          saleRecordIds: unlinkedSaleIds,
        });
        totalMerged += unlinkedSaleIds.length;
      }

      if (errors.length === 0) {
        toast.success(`合并完成：${totalMerged} 条销售记录已归到「${targetCustomer.name}」`);
      } else {
        toast.warning(`部分合并成功：${totalMerged} 条成功，${errors.length} 个客户失败`);
      }

      onMerged?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || '合并失败');
    } finally {
      setMerging(false);
    }
  }

  if (!targetCustomer) return null;

  const totalSelectedAmount = results
    .filter(r => selectedIds.has(r.id))
    .reduce((sum, r) => sum + (r.actualPrice || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-amber-600" />
            客户合并
          </DialogTitle>
          <DialogDescription>
            目标客户：
            <Badge variant="outline" className="ml-2 text-sm font-medium">
              <User className="h-3 w-3 mr-1" />
              {targetCustomer.name}
            </Badge>
            {targetCustomer.customerCode && (
              <span className="ml-2 text-xs text-muted-foreground">{targetCustomer.customerCode}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* 搜索区域 */}
        <div className="space-y-3 py-2 border-b pb-4 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">开始日期</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">结束日期</Label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">货品名称/SKU</Label>
              <Input
                value={itemKeyword}
                onChange={e => setItemKeyword(e.target.value)}
                placeholder="搜索货品..."
                className="h-8 text-xs"
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">最低金额</Label>
                <Input
                  type="number"
                  value={minAmount}
                  onChange={e => setMinAmount(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">最高金额</Label>
                <Input
                  type="number"
                  value={maxAmount}
                  onChange={e => setMaxAmount(e.target.value)}
                  placeholder="99999"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={searching}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">搜索散客记录</span>
            </Button>
            <span className="text-xs text-muted-foreground">
              自动搜索无关联客户的销售记录
            </span>
          </div>
        </div>

        {/* 搜索结果 */}
        <div className="flex-1 min-h-0 py-2">
          {searching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              搜索中...
            </div>
          ) : !hasSearched ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              点击搜索查找散客销售记录
            </div>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              未找到符合条件的散客销售记录
            </div>
          ) : (
            <>
              {/* 操作栏 */}
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selectAll ? <CheckSquare className="h-4 w-4 text-amber-600" /> : <Square className="h-4 w-4" />}
                  {selectAll ? '取消全选' : '全选'}
                </button>
                <span className="text-xs text-muted-foreground">
                  共 {results.length} 条记录
                  {selectedIds.size > 0 && `，已选 ${selectedIds.size} 条`}
                </span>
              </div>

              {/* 结果列表 */}
              <ScrollArea className="h-60 border rounded-md">
                <div className="divide-y">
                  {results.map(row => {
                    const isSelected = selectedIds.has(row.id);
                    const isAlreadyTarget = row.customerId === targetCustomer.id;
                    return (
                      <div
                        key={row.id}
                        className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 cursor-pointer transition-colors ${
                          isAlreadyTarget ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                        }`}
                        onClick={() => !isAlreadyTarget && toggleSelect(row.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isAlreadyTarget}
                          className="shrink-0"
                        />
                        <span className="font-mono w-16 shrink-0">{row.itemSku}</span>
                        <span className="truncate flex-1 min-w-0">{row.itemName || row.itemSku}</span>
                        <span className="font-medium text-emerald-600 w-16 text-right shrink-0">
                          {formatPrice(row.actualPrice)}
                        </span>
                        <span className="text-muted-foreground w-20 text-right shrink-0">{row.saleDate}</span>
                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                          {row.channel === 'store' ? '门店' : '微信'}
                        </Badge>
                        {row.customerName && (
                          <span className="text-muted-foreground w-16 truncate shrink-0 text-right">
                            {row.customerName}
                          </span>
                        )}
                        {isAlreadyTarget && (
                          <Badge variant="outline" className="text-[10px] h-4 shrink-0 border-emerald-300 text-emerald-600">
                            已归属
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* 底部汇总 */}
        {selectedIds.size > 0 && (
          <div className="border-t pt-3 flex items-center justify-between shrink-0">
            <div className="text-sm">
              <span className="text-muted-foreground">已选 </span>
              <span className="font-medium">{selectedIds.size}</span>
              <span className="text-muted-foreground"> 条记录，合计 </span>
              <span className="font-bold text-emerald-600">{formatPrice(totalSelectedAmount)}</span>
            </div>
            <Button
              onClick={handleMerge}
              disabled={merging}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  合并中...
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4 mr-1" />
                  确认合并
                </>
              )}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
