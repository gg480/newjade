'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { dictsApi, suppliersApi, batchesApi } from '@/lib/api';
import { toast } from 'sonner';
import { MATERIAL_CATEGORIES } from './settings-tab';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Zap, FileText } from 'lucide-react';

// ========== Category abbreviation map ==========
const CATEGORY_ABBR: Record<string, string> = {
  '玉': 'Y',
  '贵金属': 'G',
  '水晶': 'S',
  '文玩': 'W',
  '其他': 'Q',
};

// ========== Batch Create Dialog ==========
function BatchCreateDialog({ open, onOpenChange, onSuccess, initialMaterialId, initialSupplierId }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void; initialMaterialId?: string; initialSupplierId?: string }) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [materialCategory, setMaterialCategory] = useState('');
  const [quickMode, setQuickMode] = useState(false);
  const [form, setForm] = useState({
    batchCode: '', materialId: '', typeId: '', quantity: 1, totalCost: 0,
    costAllocMethod: 'equal', supplierId: '', purchaseDate: '', notes: '',
  });

  // Quick mode form
  const [quickCategory, setQuickCategory] = useState('');
  const [quickSupplierId, setQuickSupplierId] = useState('');
  const [quickQuantity, setQuickQuantity] = useState(10);
  const [quickTotalCost, setQuickTotalCost] = useState(0);

  useEffect(() => {
    if (open) {
      dictsApi.getMaterials().then(setMaterials).catch(() => {});
      dictsApi.getTypes().then(setTypes).catch(() => {});
      suppliersApi.getSuppliers().then((s: any) => setSuppliers(s?.items || s || [])).catch(() => {});
      // Pre-fill material and supplier if provided
      if (initialMaterialId) {
        setForm(f => ({ ...f, materialId: initialMaterialId }));
        // Infer material category from the material
        dictsApi.getMaterials().then((mats: any[]) => {
          const mat = mats.find((m: any) => String(m.id) === String(initialMaterialId));
          if (mat?.category) {
            setMaterialCategory(mat.category);
            setQuickCategory(mat.category);
          }
        }).catch(() => {});
      }
      if (initialSupplierId) {
        setForm(f => ({ ...f, supplierId: initialSupplierId }));
        setQuickSupplierId(initialSupplierId);
      }
    }
  }, [open]);

  // 根据大类筛选材质
  const filteredMaterials = materials.filter((m: any) => {
    if (!materialCategory) return true;
    return m.category === materialCategory;
  });

  // Auto-generated batch code for quick mode
  const quickBatchCode = useMemo(() => {
    if (!quickCategory) return '';
    const abbr = CATEGORY_ABBR[quickCategory] || 'X';
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const seq = String(Math.floor(Math.random() * 900) + 100);
    return `${abbr}-${dateStr}-${seq}`;
  }, [quickCategory]);

  // Estimated per-unit cost for quick mode
  const quickPerUnitCost = quickQuantity > 0 ? (quickTotalCost / quickQuantity) : 0;

  async function handleSave() {
    setSaving(true);
    try {
      if (!form.batchCode) { toast.error('请输入批次编号'); setSaving(false); return; }
      if (!form.materialId) { toast.error('请选择材质'); setSaving(false); return; }
      if (!form.quantity || form.quantity < 1) { toast.error('请输入有效数量'); setSaving(false); return; }
      await batchesApi.createBatch({
        batchCode: form.batchCode,
        materialId: Number(form.materialId),
        typeId: form.typeId ? Number(form.typeId) : undefined,
        quantity: form.quantity,
        totalCost: form.totalCost || 0,
        costAllocMethod: form.costAllocMethod,
        supplierId: form.supplierId ? Number(form.supplierId) : undefined,
        purchaseDate: form.purchaseDate || undefined,
        notes: form.notes || undefined,
      });
      toast.success('批次创建成功！');
      setForm({ batchCode: '', materialId: '', typeId: '', quantity: 1, totalCost: 0, costAllocMethod: 'equal', supplierId: '', purchaseDate: '', notes: '' });
      setMaterialCategory('');
      // Clear initial values after use
      void initialMaterialId;
      void initialSupplierId;
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || '创建失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickSave() {
    setSaving(true);
    try {
      if (!quickCategory) { toast.error('请选择材质大类'); setSaving(false); return; }
      if (!quickQuantity || quickQuantity < 1) { toast.error('请输入有效数量'); setSaving(false); return; }
      // Find the first material in the selected category
      const mat = materials.find((m: any) => m.category === quickCategory);
      if (!mat) { toast.error('该大类下没有可用材质'); setSaving(false); return; }
      await batchesApi.createBatch({
        batchCode: quickBatchCode,
        materialId: mat.id,
        quantity: quickQuantity,
        totalCost: quickTotalCost || 0,
        costAllocMethod: 'equal',
        supplierId: quickSupplierId ? Number(quickSupplierId) : undefined,
        purchaseDate: new Date().toISOString().slice(0, 10),
      });
      toast.success(`批次 ${quickBatchCode} 创建成功！`);
      setQuickCategory('');
      setQuickSupplierId('');
      setQuickQuantity(10);
      setQuickTotalCost(0);
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || '创建失败');
    } finally {
      setSaving(false);
    }
  }

  // Quick mode filtered materials (just for validation)
  const quickFilteredMaterials = materials.filter((m: any) => {
    if (!quickCategory) return true;
    return m.category === quickCategory;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>新建批次</DialogTitle>
              <DialogDescription>创建新的通货批次</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${!quickMode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setQuickMode(false)}
          >
            <FileText className="h-3.5 w-3.5" />
            完整模式
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${quickMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setQuickMode(true)}
          >
            <Zap className="h-3.5 w-3.5" />
            快速批量创建
          </button>
        </div>

        {quickMode ? (
          /* ===== Quick Mode ===== */
          <div className="space-y-4 py-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">快速模式只需填写基本信息，自动生成批次编号</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">材质大类 *</Label>
              <Select value={quickCategory} onValueChange={v => setQuickCategory(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择材质大类" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">供应商</Label>
              <Select value={quickSupplierId || '_none'} onValueChange={v => setQuickSupplierId(v === '_none' ? '' : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择供应商（可选）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">无</SelectItem>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">数量 *</Label>
                <Input type="number" value={quickQuantity} onChange={e => setQuickQuantity(parseInt(e.target.value) || 1)} className="h-9" min={1} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">总成本 *</Label>
                <Input type="number" value={quickTotalCost || ''} onChange={e => setQuickTotalCost(parseFloat(e.target.value) || 0)} className="h-9" />
              </div>
            </div>
            {/* Auto-generated info */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">自动批次编号</span>
                <span className="font-mono font-medium">{quickBatchCode || '请先选择材质大类'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">预估单件成本</span>
                <span className="font-medium text-emerald-600">
                  {quickQuantity > 0 && quickTotalCost > 0
                    ? `¥${(quickTotalCost / quickQuantity).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : '¥0'}
                </span>
              </div>
              {quickFilteredMaterials.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">对应材质</span>
                  <Badge variant="outline" className="text-xs">{quickFilteredMaterials[0].name}</Badge>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ===== Normal Mode ===== */
          <div className="space-y-4 py-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
            <div className="space-y-1"><Label className="text-xs">批次编号 *</Label><Input value={form.batchCode} onChange={e => setForm(f => ({ ...f, batchCode: e.target.value }))} className="h-9" placeholder="如: HT-20260101-001" /></div>
            {/* Material Category Cascade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">材质大类</Label>
                <Select value={materialCategory} onValueChange={v => {
                  setMaterialCategory(v === '_all' ? '' : v);
                  setForm(f => ({ ...f, materialId: '' }));
                }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="全部大类" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">全部大类</SelectItem>
                    {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">材质 *</Label>
                <Select value={form.materialId} onValueChange={v => setForm(f => ({ ...f, materialId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="选择材质" /></SelectTrigger>
                  <SelectContent>{filteredMaterials.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">器型</Label>
              <Select value={form.typeId} onValueChange={v => setForm(f => ({ ...f, typeId: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择器型" /></SelectTrigger>
                <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">数量 *</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} className="h-9" min={1} /></div>
              <div className="space-y-1"><Label className="text-xs">总成本 *</Label><Input type="number" value={form.totalCost || ''} onChange={e => setForm(f => ({ ...f, totalCost: parseFloat(e.target.value) || 0 }))} className="h-9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">分摊方式</Label>
                <Select value={form.costAllocMethod} onValueChange={v => setForm(f => ({ ...f, costAllocMethod: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">均摊</SelectItem>
                    <SelectItem value="by_weight">按克重</SelectItem>
                    <SelectItem value="by_price">按售价</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">供应商</Label>
                <Select value={form.supplierId} onValueChange={v => setForm(f => ({ ...f, supplierId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="选择供应商" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">采购日期</Label><Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">备注</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-16" placeholder="可选" /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          {quickMode ? (
            <Button onClick={handleQuickSave} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? '创建中...' : <><Zap className="h-4 w-4 mr-1" />确认创建</>}
            </Button>
          ) : (
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>{saving ? '创建中...' : '创建批次'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BatchCreateDialog;
