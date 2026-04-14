'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { batchesApi, itemsApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, StatusBadge, PaybackBar, InfoTip } from './shared';
import ItemCreateDialog from './item-create-dialog';
import ItemDetailDialog from './item-detail-dialog';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import { Layers, Plus, Eye, Clock, CheckCircle, XCircle, RotateCcw, ArrowUpRight, ArrowDownRight, TrendingUp, Search, Package, DollarSign, ShoppingCart } from 'lucide-react';

// ========== Batch Detail Dialog ==========
function BatchDetailDialog({ batchId, open, onOpenChange }: { batchId: number | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showItemCreate, setShowItemCreate] = useState(false);
  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  // Inline quick add form
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: '', sellingPrice: 0, counter: '', certNo: '' });
  const [quickSaving, setQuickSaving] = useState(false);
  // Item search filter
  const [itemSearch, setItemSearch] = useState('');
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedItemSearch(itemSearch), 200);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  const fetchBatchDetail = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const data = await batchesApi.getBatch(id);
      setBatch(data);
    } catch {
      toast.error('加载批次详情失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && batchId) {
      fetchBatchDetail(batchId);
    } else {
      setBatch(null);
    }
  }, [open, batchId, fetchBatchDetail]);

  // Item count progress
  const enteredCount = batch?.items?.length || 0;
  const declaredCount = batch?.quantity || 0;
  const enterProgress = declaredCount > 0 ? Math.min((enteredCount / declaredCount) * 100, 100) : 0;

  // Helper: compute age in days from a date string
  function daysSince(dateStr: string | null | undefined): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
  }

  // Estimated per-item cost when no allocated cost
  const estPerItem = (batch?.totalCost && batch?.quantity && batch.quantity > 0) ? batch.totalCost / batch.quantity : 0;

  function handleItemCreated() {
    if (batchId) {
      fetchBatchDetail(batchId);
    }
  }

  function handleItemClick(itemId: number) {
    setDetailItemId(itemId);
  }

  async function handleQuickAdd() {
    if (!batchId || !quickForm.name || !quickForm.sellingPrice) {
      toast.error('请输入名称和售价');
      return;
    }
    setQuickSaving(true);
    try {
      await itemsApi.createItem({
        batchId: batchId,
        name: quickForm.name || undefined,
        sellingPrice: quickForm.sellingPrice,
        counter: quickForm.counter ? Number(quickForm.counter) : undefined,
        certNo: quickForm.certNo || undefined,
      });
      toast.success('快速添加成功！');
      setQuickForm({ name: '', sellingPrice: 0, counter: '', certNo: '' });
      setQuickAdd(false);
      fetchBatchDetail(batchId);
    } catch (e: any) {
      toast.error(e.message || '快速添加失败');
    } finally {
      setQuickSaving(false);
    }
  }

  // Status color coding for items
  function getItemStatusColor(status: string) {
    switch (status) {
      case 'in_stock': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30';
      case 'sold': return 'text-gray-500 bg-gray-50 dark:bg-gray-900/30';
      case 'returned': return 'text-red-600 bg-red-50 dark:bg-red-950/30';
      default: return '';
    }
  }

  function getItemStatusLabel(status: string) {
    switch (status) {
      case 'in_stock': return '在库';
      case 'sold': return '已售';
      case 'returned': return '已退';
      default: return status;
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              批次详情
            </DialogTitle>
            <DialogDescription>{batch?.batchCode || ''}</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="space-y-3 py-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : batch ? (
            <div className="space-y-4 py-2">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-muted-foreground">总数量</span>
                  </div>
                  <p className="text-lg font-bold">{batch.quantity || 0}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-sky-600" />
                    <span className="text-xs text-muted-foreground">总成本</span>
                  </div>
                  <p className="text-lg font-bold">{formatPrice(batch.totalCost)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground">已录入</span>
                  </div>
                  <p className="text-lg font-bold">{enteredCount}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">已售出</span>
                  </div>
                  <p className="text-lg font-bold">{batch.soldCount || 0}</p>
                </div>
              </div>

              <Separator />

              {/* Progress Bar: 已录入 / 声明 */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">录入进度</span>
                  <span className="text-muted-foreground">
                    已录入 <span className="font-bold text-foreground">{enteredCount}</span> / 声明 <span className="font-bold text-foreground">{declaredCount}</span> 件
                  </span>
                </div>
                <Progress value={enterProgress} className="h-2.5" />
                {enteredCount >= declaredCount && (
                  <p className="text-xs text-emerald-600 font-medium">✓ 已全部录入</p>
                )}
                {enteredCount < declaredCount && (
                  <p className="text-xs text-amber-600">还需录入 {declaredCount - enteredCount} 件</p>
                )}
              </div>

              {/* Quick Add Button */}
              {enteredCount < declaredCount && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowItemCreate(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />完整录入
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickAdd(!quickAdd)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />快速添加
                  </Button>
                </div>
              )}

              {/* Inline Quick Add Form */}
              {quickAdd && enteredCount < declaredCount && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">快速添加货品</p>
                    <button onClick={() => setQuickAdd(false)} className="text-muted-foreground hover:text-foreground"><XCircle className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1"><Label className="text-xs">名称 <span className="text-red-500">*</span></Label><Input placeholder="货品名称" value={quickForm.name} onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-xs">售价 <span className="text-red-500">*</span></Label><Input type="number" placeholder="售价" value={quickForm.sellingPrice || ''} onChange={e => setQuickForm(f => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))} className="h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-xs">柜台号</Label><Input placeholder="例: A-01" value={quickForm.counter} onChange={e => setQuickForm(f => ({ ...f, counter: e.target.value }))} className="h-8 text-sm" /></div>
                    <div className="space-y-1"><Label className="text-xs">证书号</Label><Input placeholder="可选" value={quickForm.certNo} onChange={e => setQuickForm(f => ({ ...f, certNo: e.target.value }))} className="h-8 text-sm" /></div>
                  </div>
                  <Button size="sm" onClick={handleQuickAdd} className="bg-emerald-600 hover:bg-emerald-700" disabled={quickSaving}>
                    {quickSaving ? '添加中...' : '确认添加'}
                  </Button>
                </div>
              )}

              {/* Profit Summary Section */}
              {(() => {
                const revenue = batch.revenue || 0;
                const cost = batch.totalCost || 0;
                const profit = revenue - cost;
                const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                return (
                  <div className="p-3 bg-muted/50 rounded-lg border space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <TrendingUp className="h-4 w-4" />
                      利润分析
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">销售收入</p>
                        <p className="font-bold text-sm tabular-nums">{formatPrice(revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">总成本</p>
                        <p className="font-bold text-sm tabular-nums">{formatPrice(cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">净利润</p>
                        <p className={`font-bold text-sm tabular-nums inline-flex items-center gap-0.5 ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {profit >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          {profit >= 0 ? '+' : ''}{formatPrice(profit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">利润率</p>
                        <p className={`font-bold text-sm tabular-nums ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>已售 {batch.soldCount} 件</span>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${profit >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {profit >= 0 ? '盈利' : '亏损'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Batch Info Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">材质</p>
                  <p className="font-bold text-sm">{batch.materialName || '-'}</p>
                </div>
                <div className="bg-sky-50 dark:bg-sky-950/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">总成本</p>
                  <p className="font-bold text-sm">{formatPrice(batch.totalCost)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">已售/总数</p>
                  <p className="font-bold text-sm">{batch.soldCount}/{batch.quantity}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">已回款</p>
                  <p className="font-bold text-sm">{formatPrice(batch.revenue)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">器型: {batch.typeName || '-'}</span>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">供应商: {batch.supplierName || '-'}</span>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">采购日期: {batch.purchaseDate || '-'}</span>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={batch.status} />
                <PaybackBar rate={batch.paybackRate} />
                <span className={`text-sm font-medium ${batch.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  利润 {formatPrice(batch.profit)}
                </span>
              </div>

              <Separator />

              {/* Items List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">批次内货品</p>
                  {batch.items && batch.items.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      {batch.items.length} 件货品
                    </Badge>
                  )}
                </div>
                {/* Search filter */}
                {batch.items && batch.items.length > 0 && (
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="搜索SKU或名称..."
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      className="h-8 pl-8 pr-8 text-sm"
                    />
                    {itemSearch && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setItemSearch('')}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {(() => {
                  const items = batch.items || [];
                  const filteredItems = debouncedItemSearch.trim()
                    ? items.filter((item: any) =>
                        (item.skuCode || '').toLowerCase().includes(debouncedItemSearch.trim().toLowerCase()) ||
                        (item.name || '').toLowerCase().includes(debouncedItemSearch.trim().toLowerCase())
                      )
                    : items;
                  return filteredItems.length > 0 ? (
                    <div className="overflow-x-auto max-h-72 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead><TableHead>名称</TableHead><TableHead>器型</TableHead>
                            <TableHead className="text-right">成本</TableHead><TableHead className="text-right">售价</TableHead>
                            <TableHead>库龄</TableHead><TableHead>状态</TableHead><TableHead className="w-16">详情</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((item: any) => (
                            <TableRow
                              key={item.id}
                              className="hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => handleItemClick(item.id)}
                            >
                              <TableCell className="font-mono text-xs">{item.skuCode}</TableCell>
                              <TableCell className="text-sm">{item.name || '-'}</TableCell>
                              <TableCell className="text-sm">{item.type?.name || '-'}</TableCell>
                              <TableCell className="text-right text-sm">
                                {item.allocatedCost ? (
                                  <span className="text-emerald-600 font-medium">{formatPrice(item.allocatedCost)}</span>
                                ) : estPerItem > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-muted-foreground" title="预估成本（未分摊）">~{formatPrice(estPerItem)}<InfoTip text="预估成本 = 批次总成本 ÷ 声明数量（尚未进行成本分摊）" /></span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-emerald-600">{formatPrice(item.sellingPrice)}</TableCell>
                              <TableCell className="text-sm">
                                {item.createdAt ? (
                                  <span className={daysSince(item.createdAt) > 90 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                                    <Clock className="h-3 w-3 inline mr-0.5" />{daysSince(item.createdAt)}天
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell><StatusBadge status={item.status} /></TableCell>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleItemClick(item.id)} title="查看详情">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">{debouncedItemSearch.trim() ? '没有匹配的货品' : '该批次下暂无货品'}</p>
                  );
                })()}
              </div>

              {/* Notes */}
              {batch.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-1">备注</p>
                    <p className="text-sm text-muted-foreground">{batch.notes}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">未找到批次信息</div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Create Dialog - pre-configured for batch mode */}
      {showItemCreate && batchId && (
        <ItemCreateDialog
          open={showItemCreate}
          onOpenChange={setShowItemCreate}
          onSuccess={handleItemCreated}
          defaultBatchId={batchId}
          defaultBatchInfo={batch ? {
            materialId: batch.materialId,
            supplierId: batch.supplierId,
            purchaseDate: batch.purchaseDate,
            typeId: batch.typeId,
          } : undefined}
        />
      )}

      {/* Item Detail Dialog */}
      <ItemDetailDialog
        itemId={detailItemId}
        open={detailItemId != null}
        onOpenChange={o => { if (!o) setDetailItemId(null); }}
      />
    </>
  );
}

export default BatchDetailDialog;
