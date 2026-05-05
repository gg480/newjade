'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { batchesApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, EmptyState, LoadingSkeleton, ConfirmDialog } from './shared';
import BatchCreateDialog from './batch-create-dialog';
import BatchDetailDialog from './batch-detail-dialog';
import Pagination from './pagination';
import ItemCreateDialog from './item-create-dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { BatchesFilterBar } from './batches/batches-filter-bar';
import { BatchesTable } from './batches/batches-table';

import { Layers } from 'lucide-react';

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

  // Refresh key for manual reload triggers
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  // Auto-load batches on mount and when deps change
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await batchesApi.getBatches({ page: pagination.page, size: pagination.size });
        if (!cancelled) {
          setBatches(data.items || []);
          setPagination(data.pagination || { total: 0, page: 1, size: 20, pages: 0 });
        }
      } catch (e) { console.error('[BatchesTab]', e); if (!cancelled) toast.error('加载批次失败'); } finally { if (!cancelled) setLoading(false); }
    };
    loadData();
    return () => { cancelled = true; };
  }, [pagination.page, refreshKey]);

  async function handleAllocate(batchId: number) {
    try {
      const result = await batchesApi.allocateBatch(batchId);
      toast.success(`成本分摊完成！共 ${result.items?.length || 0} 件货品`);
      refresh();
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
      refresh();
    } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDelete() {
    if (!deleteBatch) return;
    try {
      await batchesApi.deleteBatch(deleteBatch.id);
      toast.success('批次删除成功');
      setDeleteBatch(null);
      refresh();
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
      <BatchesFilterBar
        pagination={pagination}
        totalCost={totalCost}
        completedCount={completedCount}
        inProgressCount={inProgressCount}
        notStartedCount={notStartedCount}
        roiLeaderboard={roiLeaderboard}
        searchText={searchText}
        onSearchChange={setSearchText}
        debouncedSearch={debouncedSearch}
        filteredBatches={filteredBatches}
        onNewBatch={() => setShowCreate(true)}
        onQuickAddItem={() => { if (filteredBatches.length > 0) setQuickAddBatch(filteredBatches[0]); else toast.error('没有可用的批次'); }}
        onExportCSV={handleExportBatchCSV}
      />
      {filteredBatches.length === 0 ? (
        <EmptyState icon={Layers} title="暂无批次" desc="还没有创建任何批次" />
      ) : (
        <BatchesTable
          filteredBatches={filteredBatches}
          onViewDetail={setDetailBatchId}
          onEdit={openEditDialog}
          onDelete={setDeleteBatch}
          onAllocate={handleAllocate}
          allocMethodLabels={allocMethodLabels}
        />
      )}

      <Pagination page={pagination.page} pages={pagination.pages} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} />

      {/* Dialogs */}
      <BatchCreateDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={refresh} />
      <BatchDetailDialog
        batchId={detailBatchId}
        open={detailBatchId != null}
        onOpenChange={o => {
          if (!o) {
            setDetailBatchId(null);
            // Detail dialog can create/edit batch items; refresh parent list on close.
            refresh();
          }
        }}
      />
      {/* Quick Add Item Dialog */}
      {quickAddBatch && (
        <ItemCreateDialog
          open={quickAddBatch !== null}
          onOpenChange={open => { if (!open) setQuickAddBatch(null); }}
          onSuccess={() => { setQuickAddBatch(null); refresh(); }}
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
