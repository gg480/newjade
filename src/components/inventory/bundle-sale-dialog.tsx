'use client';

import React, { useState, useEffect } from 'react';
import { itemsApi, salesApi, customersApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice } from './shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

// ========== Bundle Sale Dialog ==========
function BundleSaleDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    selectedItemIds: [] as number[], totalPrice: 0, allocMethod: 'by_ratio',
    chainItemIds: [] as number[], channel: 'store', saleDate: new Date().toISOString().slice(0, 10),
    customerId: '', note: '',
  });

  useEffect(() => {
    if (open) {
      itemsApi.getItems({ status: 'in_stock', size: 200 }).then((d: any) => setItems(d?.items || [])).catch(() => {});
      customersApi.getCustomers({ size: 200 }).then((d: any) => setCustomers(d?.items || [])).catch(() => {});
    }
  }, [open]);

  function toggleItem(id: number) {
    const ids = form.selectedItemIds.includes(id) ? form.selectedItemIds.filter(i => i !== id) : [...form.selectedItemIds, id];
    const selected = items.filter(i => ids.includes(i.id));
    const total = selected.reduce((sum, i) => sum + (i.sellingPrice || 0), 0);
    setForm(f => ({ ...f, selectedItemIds: ids, totalPrice: total }));
  }

  function toggleChainItem(id: number) {
    const ids = form.chainItemIds.includes(id) ? form.chainItemIds.filter(i => i !== id) : [...form.chainItemIds, id];
    setForm(f => ({ ...f, chainItemIds: ids }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (form.selectedItemIds.length < 2) { toast.error('套装销售至少选择2件货品'); setSaving(false); return; }
      if (!form.totalPrice) { toast.error('请输入总价'); setSaving(false); return; }
      await salesApi.createBundleSale({
        itemIds: form.selectedItemIds,
        totalPrice: form.totalPrice,
        allocMethod: form.allocMethod,
        chainItemIds: form.allocMethod === 'chain_at_cost' ? form.chainItemIds : undefined,
        channel: form.channel,
        saleDate: form.saleDate,
        customerId: form.customerId ? Number(form.customerId) : undefined,
        note: form.note || undefined,
      });
      toast.success('套装销售成功！');
      setForm({ selectedItemIds: [], totalPrice: 0, allocMethod: 'by_ratio', chainItemIds: [], channel: 'store', saleDate: new Date().toISOString().slice(0, 10), customerId: '', note: '' });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || '套装销售失败');
    } finally {
      setSaving(false);
    }
  }

  const selectedItems = items.filter(i => form.selectedItemIds.includes(i.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>套装销售</DialogTitle><DialogDescription>多件货品打包一起销售</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          {/* Item Selection */}
          <div className="space-y-1">
            <Label className="text-xs">选择货品 (至少2件)</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 custom-scrollbar">
              {items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">没有在库货品</p> : items.map(item => (
                <label key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/50 rounded cursor-pointer text-sm">
                  <Checkbox checked={form.selectedItemIds.includes(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                  <span className="font-mono text-xs">{item.skuCode}</span>
                  <span className="flex-1 truncate">{item.name || item.typeName || '-'}</span>
                  <span className="text-emerald-600 font-medium">{formatPrice(item.sellingPrice)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Selected summary */}
          {selectedItems.length > 0 && (
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-sm">
              <p className="font-medium">已选 {selectedItems.length} 件，标价合计: {formatPrice(form.totalPrice)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">套装总价 *</Label><Input type="number" value={form.totalPrice || ''} onChange={e => setForm(f => ({ ...f, totalPrice: parseFloat(e.target.value) || 0 }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">分摊方式</Label>
              <Select value={form.allocMethod} onValueChange={v => setForm(f => ({ ...f, allocMethod: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="by_ratio">按售价比例</SelectItem>
                  <SelectItem value="chain_at_cost">链按售价+余入主件</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chain item selection */}
          {form.allocMethod === 'chain_at_cost' && selectedItems.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">链类货品 (按售价计入成本)</Label>
              <div className="flex flex-wrap gap-2">
                {selectedItems.map(item => (
                  <label key={item.id} className="flex items-center gap-1 cursor-pointer">
                    <Checkbox checked={form.chainItemIds.includes(item.id)} onCheckedChange={() => toggleChainItem(item.id)} />
                    <span className="text-xs">{item.skuCode}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">销售渠道</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="store">门店</SelectItem><SelectItem value="wechat">微信</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">销售日期</Label><Input type="date" value={form.saleDate} onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))} className="h-9" /></div>
          </div>

          <div className="space-y-1"><Label className="text-xs">客户</Label>
            <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="选择客户 (可选)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不选择</SelectItem>
                {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.phone ? ` (${c.phone})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1"><Label className="text-xs">备注</Label><Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-16" placeholder="可选" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>{saving ? '处理中...' : '确认套装销售'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BundleSaleDialog;
