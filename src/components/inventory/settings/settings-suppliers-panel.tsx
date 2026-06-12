'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Supplier, SupplierStats } from '@/lib/api.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Factory, Plus, Pencil, Trash2, Phone, Search, X,
  TrendingUp, Package, DollarSign, ChevronDown, ChevronUp,
  Calendar, Hash, Layers,
} from 'lucide-react';
import { EmptyState } from '../shared';
import { suppliersApi } from '@/lib/api';
import { toast } from 'sonner';
import { useSettings } from './settings-context';

/** 统计摘要数据 */
interface StatsSummary {
  totalAmount: number;
  totalCount: number;
  avgPrice: number;
}

/** 进货批次明细项 */
interface PurchaseItem {
  id: number;
  batchCode: string;
  materialName: string;
  typeName: string;
  quantity: number;
  totalCost: number;
  purchaseDate: string | null;
  createdAt: string;
}

export default function SettingsSuppliersPanel() {
  const { suppliers, refreshSuppliers } = useSettings();
  // ─── 搜索状态 ───
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchTimerRef.current = setTimeout(() => setDebouncedSupplierSearch(supplierSearch), 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [supplierSearch]);

  // ─── Dialog 状态 ───
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', notes: '' });

  // ─── 统计数据状态 ───
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ─── 展开的供应商ID + 该供应商进货明细 ───
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  // 加载统计汇总
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    suppliersApi
      .getSupplierStats()
      .then((data: SupplierStats) => {
        if (!cancelled && data?.total) setStats(data.total);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── CRUD Handlers ───
  async function handleCreateSupplier() {
    try {
      await suppliersApi.createSupplier(supplierForm);
      toast.success('供应商创建成功');
      setShowCreateSupplier(false);
      setSupplierForm({ name: '', contact: '', phone: '', notes: '' });
      await refreshSuppliers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '创建失败');
    }
  }

  async function handleUpdateSupplier() {
    if (!editSupplier) return;
    try {
      await suppliersApi.updateSupplier(editSupplier.id, supplierForm);
      toast.success('供应商更新成功');
      setEditSupplier(null);
      setSupplierForm({ name: '', contact: '', phone: '', notes: '' });
      await refreshSuppliers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '更新失败');
    }
  }

  async function handleDeleteSupplier() {
    if (!deleteSupplier) return;
    try {
      await suppliersApi.deleteSupplier(deleteSupplier.id);
      toast.success('供应商已删除');
      setDeleteSupplier(null);
      await refreshSuppliers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  }

  function openEditSupplierDialog(s: Supplier) {
    setEditSupplier(s);
    setSupplierForm({ name: s.name || '', contact: s.contact || '', phone: s.phone || '', notes: s.notes || '' });
  }

  // 展开/收起供应商进货明细
  const toggleExpand = async (supplierId: number) => {
    if (expandedId === supplierId) {
      setExpandedId(null);
      setPurchases([]);
      return;
    }
    setExpandedId(supplierId);
    setPurchasesLoading(true);
    try {
      const data = await suppliersApi.getSupplierPurchases(supplierId, { size: 50 });
      setPurchases(data?.items ?? []);
    } catch {
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  };

  // 格式化金额
  const fmt = (n: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  // ─── 过滤供应商 ───
  const filteredSuppliers = (() => {
    const q = debouncedSupplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s: Supplier) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.contact || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q),
    );
  })();

  return (
    <>
      <Card className="border-l-4 border-l-teal-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-4 w-4 text-teal-500" />
              供应商 ({suppliers.length})
            </CardTitle>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
              onClick={() => { setShowCreateSupplier(true); setSupplierForm({ name: '', contact: '', phone: '', notes: '' }); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              新增供应商
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* ═══ 统计卡片 ═══ */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3 w-3 text-emerald-500" />
                  总进货金额
                </div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {statsLoading ? '...' : fmt(stats.totalAmount)}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <Package className="h-3 w-3 text-blue-500" />
                  总进货件数
                </div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                  {statsLoading ? '...' : stats.totalCount}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3 text-amber-500" />
                  均价
                </div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                  {statsLoading ? '...' : fmt(stats.avgPrice)}
                </div>
              </div>
            </div>
          )}

          {/* ═══ 供应商搜索 ═══ */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索名称、联系人、电话..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="h-9 pl-8 pr-8"
              />
              {supplierSearch && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSupplierSearch('')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {debouncedSupplierSearch.trim() && (
              <p className="text-xs text-muted-foreground mt-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                找到{' '}
                <span className="font-medium text-foreground">
                  {filteredSuppliers.length}
                </span>{' '}
                个供应商
              </p>
            )}
          </div>

          {/* ═══ 供应商列表 ═══ */}
          {suppliers.length === 0 ? (
            <EmptyState
              icon={Factory}
              title="暂无供应商"
              desc="还没有添加任何供应商"
            />
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              无匹配的供应商
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSuppliers.map((s: Supplier) => {
                const isExpanded = expandedId === s.id;
                return (
                  <div key={s.id}>
                    {/* 供应商卡片 */}
                    <div
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isExpanded
                          ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700'
                          : 'bg-muted/50 border-transparent hover:border-teal-200 dark:hover:border-teal-800'
                      }`}
                      onClick={() => toggleExpand(s.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium flex items-center gap-1">
                          {s.name}
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-teal-500" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </p>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-amber-600"
                            onClick={() => openEditSupplierDialog(s)}
                            title="编辑"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-600"
                            onClick={() => setDeleteSupplier(s)}
                            title="删除"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {s.contact && (
                        <p className="text-sm text-muted-foreground">
                          {s.contact}
                        </p>
                      )}
                      {s.phone && (
                        <a
                          href={`tel:${s.phone}`}
                          className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3" />
                          {s.phone}
                        </a>
                      )}
                      {s.notes && (
                        <p className="text-sm text-muted-foreground truncate">
                          {s.notes}
                        </p>
                      )}
                    </div>

                    {/* 展开的进货明细 */}
                    {isExpanded && (
                      <div className="mt-1 ml-2 border-l-2 border-teal-300 dark:border-teal-700 pl-3 py-1">
                        {purchasesLoading ? (
                          <p className="text-xs text-muted-foreground py-2">
                            加载中...
                          </p>
                        ) : purchases.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">
                            该供应商暂无进货批次
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {purchases.map((p) => (
                              <div
                                key={p.id}
                                className="bg-muted/40 rounded p-2 text-xs"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono font-medium text-teal-700 dark:text-teal-400">
                                    <Hash className="h-3 w-3 inline mr-0.5" />
                                    {p.batchCode}
                                  </span>
                                  <span className="text-muted-foreground">
                                    <Calendar className="h-3 w-3 inline mr-0.5" />
                                    {p.purchaseDate || p.createdAt.slice(0, 10)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <span>
                                    <Layers className="h-3 w-3 inline mr-0.5" />
                                    {p.materialName} {p.typeName !== '—' ? `/ ${p.typeName}` : ''}
                                  </span>
                                  <span>
                                    <Package className="h-3 w-3 inline mr-0.5" />
                                    {p.quantity} 件
                                  </span>
                                  <span className="font-medium text-foreground">
                                    <DollarSign className="h-3 w-3 inline mr-0.5" />
                                    {fmt(p.totalCost)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Supplier Dialog */}
      <Dialog open={showCreateSupplier} onOpenChange={setShowCreateSupplier}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增供应商</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="供应商名称" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>联系人</Label><Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} placeholder="联系人姓名" /></div>
              <div className="space-y-1"><Label><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />电话</span></Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="手机号码" /></div>
            </div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} placeholder="可选" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSupplier(false)}>取消</Button>
            <Button onClick={handleCreateSupplier} className="bg-emerald-600 hover:bg-emerald-700" disabled={!supplierForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={editSupplier !== null} onOpenChange={open => { if (!open) setEditSupplier(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑供应商</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>联系人</Label><Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} /></div>
              <div className="space-y-1"><Label><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />电话</span></Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplier(null)}>取消</Button>
            <Button onClick={handleUpdateSupplier} className="bg-emerald-600 hover:bg-emerald-700" disabled={!supplierForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Supplier Confirm Dialog */}
      <Dialog open={deleteSupplier !== null} onOpenChange={open => { if (!open) setDeleteSupplier(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除供应商「{deleteSupplier?.name}」吗？此操作不可恢复。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSupplier(null)}>取消</Button>
            <Button onClick={handleDeleteSupplier} className="bg-red-600 hover:bg-red-700">确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
