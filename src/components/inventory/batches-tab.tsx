'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { batchesApi, exportApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { formatPrice, StatusBadge, PaybackBar, EmptyState, LoadingSkeleton, ConfirmDialog } from './shared';
import BatchCreateDialog from './batch-create-dialog';
import BatchDetailDialog from './batch-detail-dialog';
import Pagination from './pagination';
import ItemCreateDialog from './item-create-dialog';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import {
  Layers, CheckCircle, TrendingUp, DollarSign, Plus, Eye, FileDown, ClipboardList, Pencil, Trash2, Clock, TrendingDown, ArrowUpRight, ArrowDownRight, Search, X, Trophy, Package, PlayCircle, Ban,
} from 'lucide-react';

// ========== Batches Tab ==========
function BatchesTab() {
  const [batches, setBatches] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);

  // Search
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Edit dialog
  const [editDialog, setEditDialog] = useState<{ open: boolean; batch: any }>({ open: false, batch: null });
  const [editForm, setEditForm] = useState({ totalCost: 0, quantity: 0, purchaseDate: '', supplierName: '', note: '' });

  // Delete dialog
  const [deleteBatch, setDeleteBatch] = useState<any>(null);

  // Quick add item state
  const [quickAddBatch, setQuickAddBatch] = useState<any>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await batchesApi.getBatches({ page: pagination.page, size: pagination.size });
      setBatches(data.items || []);
      setPagination(data.pagination || { total: 0, page: 1, size: 20, pages: 0 });
    } catch { toast.error('加载批次失败'); } finally { setLoading(false); }
  }, [pagination.page]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  async function handleAllocate(batchId: number) {
    try {
      const result = await batchesApi.allocateBatch(batchId);
      toast.success(`成本分摊完成！共 ${result.items?.length || 0} 件货品`);
      fetchBatches();
    } catch (e: any) { toast.error(e.message || '分摊失败'); }
  }

  function openEditDialog(batch: any) {
    setEditDialog({ open: true, batch });
    setEditForm({
      totalCost: batch.totalCost || 0,
      quantity: batch.quantity || 0,
      purchaseDate: batch.purchaseDate || '',
      supplierName: batch.supplierName || '',
      note: batch.note || '',
    });
  }

  async function handleEdit() {
    if (!editDialog.batch) return;
    try {
      await batchesApi.updateBatch(editDialog.batch.id, editForm);
      toast.success('批次更新成功');
      setEditDialog({ open: false, batch: null });
      fetchBatches();
    } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDelete() {
    if (!deleteBatch) return;
    try {
      await batchesApi.deleteBatch(deleteBatch.id);
      toast.success('批次删除成功');
      setDeleteBatch(null);
      fetchBatches();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  }

  function handleExportBatchCSV() {
    if (filteredBatches.length === 0) {
      toast.error('没有可导出的批次数据');
      return;
    }
    const headers = ['批次编号', '材质', '供应商', '数量', '已录入', '进度%', '总成本', '单价', '创建日期'];
    const rows = filteredBatches.map((b: any) => {
      const qty = b.quantity || 0;
      const itemsCount = b.itemsCount || 0;
      const pct = qty > 0 ? Math.round((itemsCount / qty) * 100) : 0;
      const unitPrice = qty > 0 ? Math.round((b.totalCost || 0) / qty) : 0;
      return [
        b.batchCode || '',
        b.materialName || '',
        b.supplierName || '',
        qty,
        itemsCount,
        `${pct}%`,
        b.totalCost || 0,
        unitPrice,
        b.purchaseDate || b.createdAt?.slice(0, 10) || '',
      ];
    });
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map((cell: any) => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `批次数据_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${filteredBatches.length} 条批次数据`);
  }

  // Client-side search filter by batchCode (before early return to satisfy hooks rules)
  const filteredBatches = useMemo(() => {
    if (!debouncedSearch.trim()) return batches;
    const q = debouncedSearch.trim().toLowerCase();
    return batches.filter((b: any) => (b.batchCode || '').toLowerCase().includes(q));
  }, [batches, debouncedSearch]);

  // ROI Leaderboard: top 5 batches with sales, sorted by profit margin
  const roiLeaderboard = useMemo(() => {
    return batches
      .filter((b: any) => (b.soldCount || 0) > 0)
      .map((b: any) => {
        const revenue = b.revenue || 0;
        const cost = b.totalCost || 0;
        const margin = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
        const profit = revenue - cost;
        return { ...b, margin, profit };
      })
      .sort((a: any, b: any) => b.margin - a.margin)
      .slice(0, 5);
  }, [batches]);

  if (loading && batches.length === 0) return <LoadingSkeleton />;

  const totalCost = batches.reduce((s, b) => s + (b.totalCost || 0), 0);
  const totalRevenue = batches.reduce((s, b) => s + (b.revenue || 0), 0);

  // Batch statistics
  const completedCount = batches.filter(b => (b.itemsCount || 0) >= (b.quantity || 0) && (b.quantity || 0) > 0).length;
  const inProgressCount = batches.filter(b => (b.itemsCount || 0) > 0 && (b.itemsCount || 0) < (b.quantity || 0)).length;
  const notStartedCount = batches.filter(b => (b.itemsCount || 0) === 0 && (b.quantity || 0) > 0).length;

  const allocMethodLabels: Record<string, string> = { equal: '均摊', by_weight: '按克重', by_price: '按售价' };

  return (
    <div className="space-y-6">
      {/* Batch Statistics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总批次</p>
                <p className="text-lg font-bold tabular-nums">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">已完成(100%)</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <PlayCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">进行中</p>
                <p className="text-lg font-bold text-amber-600 tabular-nums">{inProgressCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-gray-400 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Ban className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">未开始</p>
                <p className="text-lg font-bold text-gray-500 tabular-nums">{notStartedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总成本</p>
                <p className="text-lg font-bold text-purple-600 tabular-nums">{formatPrice(totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 回本排行榜 */}
      {roiLeaderboard.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium flex items-center gap-1.5 mb-3">
              <Trophy className="h-4 w-4 text-amber-500" />回本排行榜
              <Badge variant="secondary" className="text-[10px] ml-1">TOP {roiLeaderboard.length}</Badge>
            </p>
            <div className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1">
              {roiLeaderboard.map((b: any, idx: number) => {
                const barColor = b.margin >= 100 ? 'bg-emerald-500' : b.margin >= 50 ? 'bg-sky-500' : 'bg-amber-500';
                const textColor = b.margin >= 100 ? 'text-emerald-600 dark:text-emerald-400' : b.margin >= 50 ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400';
                return (
                  <div key={b.id} className="snap-start shrink-0 w-48 h-28 rounded-lg border border-border bg-card hover:shadow-md transition-shadow cursor-pointer p-3 flex flex-col justify-between" onClick={() => setDetailBatchId(b.id)}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium truncate max-w-[100px]">{b.batchCode}</span>
                      <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
                    </div>
                    <div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" style={{ height: '4px' }}>
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(Math.max(b.margin, 0), 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{b.margin.toFixed(1)}%</span>
                      <span className={`text-[10px] font-medium tabular-nums ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {b.profit >= 0 ? '+' : ''}{formatPrice(b.profit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><Layers className="h-16 w-16 text-sky-500" /></div>
            <p className="text-sm text-muted-foreground">总批次</p><p className="text-2xl font-bold">{pagination.total}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><CheckCircle className="h-16 w-16 text-emerald-500" /></div>
            <p className="text-sm text-muted-foreground">已回本</p><p className="text-2xl font-bold text-emerald-600">{batches.filter(b => b.status === 'paid_back' || b.status === 'cleared').length}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><TrendingUp className="h-16 w-16 text-amber-500" /></div>
            <p className="text-sm text-muted-foreground">销售中</p><p className="text-2xl font-bold text-sky-600">{batches.filter(b => b.status === 'selling').length}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><DollarSign className="h-16 w-16 text-purple-500" /></div>
            <p className="text-sm text-muted-foreground">总投入</p><p className="text-2xl font-bold">{formatPrice(totalCost)}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-orange-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><ClipboardList className="h-16 w-16 text-orange-500" /></div>
            <p className="text-sm text-muted-foreground">待录入</p><p className="text-2xl font-bold text-orange-600">{batches.filter(b => (b.itemsCount || 0) < (b.quantity || 0)).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={() => setShowCreate(true)}><Plus className="h-3 w-3 mr-1" />新建批次</Button>
        <Button size="sm" variant="outline" className="h-9 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300" onClick={() => { if (filteredBatches.length > 0) setQuickAddBatch(filteredBatches[0]); else toast.error('没有可用的批次'); }}>
          <Package className="h-3 w-3 mr-1" />快速添加货品
        </Button>
        <Button size="sm" variant="outline" className="h-9" onClick={handleExportBatchCSV} disabled={filteredBatches.length === 0}><FileDown className="h-3 w-3 mr-1" />导出CSV</Button>
        <a href={exportApi.batches()} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="h-9"><FileDown className="h-3 w-3 mr-1" />导出</Button>
        </a>
        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索批次编号..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="h-9 w-48 md:w-56 pl-8 pr-8"
          />
          {searchText && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSearchText('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Search result count */}
      {debouncedSearch.trim() && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <Search className="h-3.5 w-3.5" />
          <span>找到 <span className="font-medium text-foreground">{filteredBatches.length}</span> 个批次</span>
        </div>
      )}

      {filteredBatches.length === 0 ? (
        <EmptyState icon={Layers} title="暂无批次" desc="还没有创建任何批次" />
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>批次编号</TableHead><TableHead>材质</TableHead><TableHead className="text-right">总成本</TableHead>
                      <TableHead className="text-right">单价</TableHead>
                      <TableHead className="text-right">数量</TableHead><TableHead className="text-right">已录入</TableHead><TableHead>分摊方式</TableHead><TableHead className="text-right">已售</TableHead>
                      <TableHead className="text-right">已回款</TableHead><TableHead className="text-right">利润</TableHead><TableHead>回本进度</TableHead><TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map(b => (
                      <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailBatchId(b.id)}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-1.5">
                            {b.batchCode}
                            {(b.itemsCount || 0) > 0 ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">已关联货品</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">未录入</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{b.materialName}</TableCell>
                        <TableCell className="text-right">{formatPrice(b.totalCost)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {b.quantity > 0 ? formatPrice(b.totalCost / b.quantity) : '-'}
                          {b.soldCount > 0 && (() => {
                            const avgSellingPrice = (b.revenue || 0) / b.soldCount;
                            return <span className="text-[10px] block text-emerald-600">均售价¥{Math.round(avgSellingPrice).toLocaleString()}</span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">{b.quantity}</TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const itemsCount = b.itemsCount || 0;
                            const quantity = b.quantity || 0;
                            const pct = quantity > 0 ? Math.round((itemsCount / quantity) * 100) : 0;
                            const barColor = pct === 0 ? 'bg-gray-300 dark:bg-gray-600' : pct <= 50 ? 'bg-amber-500' : pct < 100 ? 'bg-sky-500' : 'bg-emerald-500';
                            const isInProgress = pct > 0 && pct < 100;
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">进度</span>
                                  <span className={itemsCount >= quantity ? 'text-emerald-600 font-medium text-xs' : itemsCount > 0 ? 'text-amber-600 text-xs' : 'text-muted-foreground text-xs'}>
                                    {itemsCount}/{quantity} {pct}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${barColor} ${isInProgress ? 'animate-pulse' : ''}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell><Badge variant="outline">{allocMethodLabels[b.costAllocMethod] || b.costAllocMethod}</Badge></TableCell>
                        <TableCell className="text-right">{b.soldCount}/{b.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{formatPrice(b.revenue)}</TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const profit = (b.revenue || 0) - (b.totalCost || 0);
                            const margin = (b.revenue || 0) > 0 ? (profit / (b.revenue || 0)) * 100 : 0;
                            return (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {profit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                  {formatPrice(profit)}
                                </span>
                                <span className={`text-[10px] tabular-nums ${margin >= 0 ? 'text-emerald-500 dark:text-emerald-400/70' : 'text-red-500 dark:text-red-400/70'}`}>
                                  {margin.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell><PaybackBar rate={b.paybackRate} /></TableCell>
                        <TableCell><StatusBadge status={b.status} /></TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDetailBatchId(b.id)} title="查看详情"><Eye className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600" onClick={() => openEditDialog(b)} title="编辑"><Pencil className="h-3 w-3" /></Button>
                            {b.itemsCount === b.quantity && b.soldCount === 0 && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAllocate(b.id)}>分摊</Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => setDeleteBatch(b)} title="删除"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredBatches.map(b => (
              <Card key={b.id} className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onClick={() => setDetailBatchId(b.id)}>
                <CardContent className="p-4 space-y-2">
                  {/* Header: batch code + status */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{b.batchCode}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  {/* Material + entry progress */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{b.materialName}</span>
                    {(() => {
                      const itemsCount = b.itemsCount || 0;
                      const quantity = b.quantity || 0;
                      const pct = quantity > 0 ? Math.round((itemsCount / quantity) * 100) : 0;
                      const barColor = pct === 0 ? 'bg-gray-300 dark:bg-gray-600' : pct <= 50 ? 'bg-amber-500' : pct < 100 ? 'bg-sky-500' : 'bg-emerald-500';
                      const isInProgress = pct > 0 && pct < 100;
                      return (
                        <div className="flex-1 ml-3 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">进度</span>
                            <span className={`text-xs ${itemsCount >= quantity ? 'text-emerald-600 font-medium' : itemsCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                              {itemsCount}/{quantity}件 {pct}%
                            </span>
                          </div>
                          <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor} ${isInProgress ? 'animate-pulse' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Cost + Revenue + Profit row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">总成本</p>
                      <p className="font-medium">{formatPrice(b.totalCost)}</p>
                      {b.quantity > 0 && <p className="text-xs text-muted-foreground">单价 {formatPrice(b.totalCost / b.quantity)}</p>}
                      {b.soldCount > 0 && (() => {
                        const avgSellingPrice = (b.revenue || 0) / b.soldCount;
                        return <p className="text-xs text-emerald-600">均售价 {formatPrice(avgSellingPrice)}</p>;
                      })()}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">已回款</p>
                      <p className="font-medium text-emerald-600">{formatPrice(b.revenue)}</p>
                    </div>
                  </div>
                  {/* Profit row */}
                  {(() => {
                    const profit = (b.revenue || 0) - (b.totalCost || 0);
                    const margin = (b.revenue || 0) > 0 ? (profit / (b.revenue || 0)) * 100 : 0;
                    return (
                      <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40 rounded-lg">
                        <span className="text-xs text-muted-foreground">利润</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium tabular-nums ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {profit >= 0 ? '+' : ''}{formatPrice(profit)}
                          </span>
                          <span className={`text-xs tabular-nums ${margin >= 0 ? 'text-emerald-500 dark:text-emerald-400/70' : 'text-red-500 dark:text-red-400/70'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Payback bar */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>回本进度</span>
                      <span>{(b.paybackRate * 100).toFixed(1)}%</span>
                    </div>
                    <PaybackBar rate={b.paybackRate} />
                  </div>
                  {/* Sold count */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>已售 {b.soldCount}/{b.quantity}</span>
                    {b.purchaseDate && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.purchaseDate}</span>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 pt-1 border-t" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={() => setDetailBatchId(b.id)}><Eye className="h-3 w-3 mr-1" />详情</Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-amber-600" onClick={() => openEditDialog(b)}><Pencil className="h-3 w-3" /></Button>
                    {b.itemsCount === b.quantity && b.soldCount === 0 && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleAllocate(b.id)}>分摊</Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={() => setDeleteBatch(b)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Pagination page={pagination.page} pages={pagination.pages} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} />

      {/* Dialogs */}
      <BatchCreateDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={fetchBatches} />
      <BatchDetailDialog batchId={detailBatchId} open={detailBatchId != null} onOpenChange={o => { if (!o) setDetailBatchId(null); }} />
      {/* Quick Add Item Dialog */}
      {quickAddBatch && (
        <ItemCreateDialog
          open={quickAddBatch !== null}
          onOpenChange={open => { if (!open) setQuickAddBatch(null); }}
          onSuccess={() => { setQuickAddBatch(null); fetchBatches(); }}
          defaultBatchId={quickAddBatch.id}
          defaultBatchInfo={{ materialId: quickAddBatch.materialId, supplierId: quickAddBatch.supplierId, typeId: quickAddBatch.typeId, purchaseDate: quickAddBatch.purchaseDate }}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={open => setEditDialog({ open, batch: open ? editDialog.batch : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑批次</DialogTitle>
            <DialogDescription>{editDialog.batch?.batchCode}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>总成本</Label><Input type="number" value={editForm.totalCost} onChange={e => setEditForm(f => ({ ...f, totalCost: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>数量</Label><Input type="number" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>采购日期</Label><Input type="date" value={editForm.purchaseDate} onChange={e => setEditForm(f => ({ ...f, purchaseDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>供应商</Label><Input value={editForm.supplierName} onChange={e => setEditForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="可选" /></div>
            <div className="space-y-1"><Label>备注</Label><Input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="可选" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, batch: null })}>取消</Button>
            <Button onClick={handleEdit} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteBatch !== null}
        onOpenChange={open => { if (!open) setDeleteBatch(null); }}
        title="确认删除批次"
        description={deleteBatch ? `确定要删除批次「${deleteBatch.batchCode}」(${deleteBatch.materialName})？此操作不可撤销，关联的货品不会被删除。` : ''}
        confirmText="确认删除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default BatchesTab;
