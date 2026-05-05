'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { itemsApi, batchesApi, suppliersApi, dictsApi, pricingApi } from '@/lib/api';
import { toast } from 'sonner';
import { parseSpecFields, SPEC_FIELD_LABEL_MAP } from './settings-tab';
import HighValueForm from './item-create/high-value-form';
import BatchItemForm from './item-create/batch-item-form';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import SupplierQuickAddDialog from './supplier-quick-add-dialog';

import { Gem, Layers } from 'lucide-react';

// ========== Item Creation Dialog ==========
function ItemCreateDialog({ open, onOpenChange, onSuccess, defaultBatchId, defaultBatchInfo }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void; defaultBatchId?: number; defaultBatchInfo?: { materialId?: number; supplierId?: number; purchaseDate?: string; typeId?: number } }) {
  const [mode, setMode] = useState<'high_value' | 'batch'>('high_value');
  const [materials, setMaterials] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSupplierAdd, setShowSupplierAdd] = useState(false);
  const [tagMismatch, setTagMismatch] = useState<{ mode: 'high_value' | 'batch'; invalidTagIds: number[]; invalidTagNames: string[] } | null>(null);
  const [pricingSuggestion, setPricingSuggestion] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({});

  // 级联选择: 大类 → 子类 → 材质
  const [materialCategory, setMaterialCategory] = useState('');
  const [materialSubType, setMaterialSubType] = useState('');
  const [batchMaterialCategory, setBatchMaterialCategory] = useState('');
  const [batchMaterialSubType, setBatchMaterialSubType] = useState('');

  const [highValueForm, setHighValueForm] = useState({
    materialId: '', typeId: '', costPrice: 0, sellingPrice: 0, name: '',
    origin: '', counter: '', certNo: '', notes: '', supplierId: '', purchaseDate: new Date().toISOString().slice(0, 10),
    weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '',
    tagIds: [] as number[],
  });

  const [batchForm, setBatchForm] = useState({
    batchId: '', typeId: '', sellingPrice: 0, name: '', counter: '', certNo: '', notes: '',
    weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '',
    tagIds: [] as number[],
  });

  useEffect(() => {
    if (open) {
      dictsApi.getMaterials().then(setMaterials).catch(() => {});
      dictsApi.getTypes().then(setTypes).catch(() => {});
      suppliersApi.getSuppliers().then((s: any) => setSuppliers(s?.items || s || [])).catch(() => {});
      batchesApi.getBatches({ size: 100 }).then((d: any) => setBatches(d?.items || [])).catch(() => {});

      // Pre-configure for batch mode if defaultBatchId is provided
      if (defaultBatchId) {
        setMode('batch');
        setBatchForm(f => ({
          ...f,
          batchId: String(defaultBatchId),
          ...(defaultBatchInfo?.typeId ? { typeId: String(defaultBatchInfo.typeId) } : {}),
        }));
      }
    }
  }, [open, defaultBatchId, defaultBatchInfo]);

  const selectedBatch = useMemo(
    () => batches.find((b: any) => String(b.id) === String(batchForm.batchId)),
    [batches, batchForm.batchId],
  );
  const highValueMaterialId = highValueForm.materialId ? Number(highValueForm.materialId) : null;
  const batchMaterialId = selectedBatch?.materialId ? Number(selectedBatch.materialId) : null;
  const currentMaterialId = mode === 'high_value' ? highValueMaterialId : batchMaterialId;

  useEffect(() => {
    if (!open) return;
    dictsApi.getTags(undefined, false, currentMaterialId || undefined).then((list: any[]) => {
      setTags(list);
    }).catch(() => {});
  }, [open, currentMaterialId]);

  useEffect(() => {
    setTagMismatch(null);
  }, [mode, currentMaterialId]);

  // 根据大类筛选材质（含子类）
  const filteredByCategory = materials.filter((m: any) => {
    if (!materialCategory) return true;
    return m.category === materialCategory;
  });

  // 动态提取子类列表
  const subTypes = useMemo(() => {
    const types = new Set<string>();
    filteredByCategory.forEach((m: any) => { if (m.subType) types.add(m.subType); });
    return Array.from(types).sort();
  }, [filteredByCategory]);

  // 根据大类+子类筛选材质
  const filteredMaterials = useMemo(() => {
    return filteredByCategory.filter((m: any) => {
      if (!materialSubType) return true;
      return m.subType === materialSubType;
    });
  }, [filteredByCategory, materialSubType]);

  // Batch mode 同理
  const batchFilteredByCategory = useMemo(() => materials.filter((m: any) => {
    if (!batchMaterialCategory) return true;
    return m.category === batchMaterialCategory;
  }), [materials, batchMaterialCategory]);

  const batchSubTypes = useMemo(() => {
    const types = new Set<string>();
    batchFilteredByCategory.forEach((m: any) => { if (m.subType) types.add(m.subType); });
    return Array.from(types).sort();
  }, [batchFilteredByCategory]);

  const batchFilteredMaterials = useMemo(() => {
    return batchFilteredByCategory.filter((m: any) => {
      if (!batchMaterialSubType) return true;
      return m.subType === batchMaterialSubType;
    });
  }, [batchFilteredByCategory, batchMaterialSubType]);

  const selectedType = types.find((t: any) => String(t.id) === (mode === 'high_value' ? highValueForm.typeId : batchForm.typeId));
  const typeSpecFields = parseSpecFields(selectedType?.specFields);
  // When no type is selected, show all spec fields; otherwise show only type-specific fields
  const ALL_SPEC_FIELDS: Record<string, { required: boolean }> = {
    weight: { required: false }, metalWeight: { required: false }, size: { required: false },
    braceletSize: { required: false }, beadCount: { required: false }, beadDiameter: { required: false }, ringSize: { required: false },
  };
  const specFieldsObj = Object.keys(typeSpecFields).length > 0 ? typeSpecFields : ALL_SPEC_FIELDS;
  const specFieldKeys = Object.keys(specFieldsObj);

  // 校验必填字段
  function validateRequiredFields(form: typeof highValueForm | typeof batchForm, isHighValue: boolean): string | null {
    if (!form.typeId) return '请选择器型';
    // 高货模式才校验成本价，通货模式成本由批次分摊
    if (isHighValue && !(form as any).costPrice) return '请输入成本价';
    // 器型必填规格字段
    for (const field of specFieldKeys) {
      if (specFieldsObj[field]?.required && !(form as any)[field]) {
        const label = SPEC_FIELD_LABEL_MAP[field] || field;
        return `请输入${label}`;
      }
    }
    return null;
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (mode === 'high_value') {
        if (!highValueForm.materialId) { toast.error('请选择材质'); setSaving(false); return; }
        if (!highValueForm.sellingPrice) { toast.error('请输入售价'); setSaving(false); return; }
        const validationError = validateRequiredFields(highValueForm, true);
        if (validationError) { toast.error(validationError); setSaving(false); return; }
        const spec: Record<string, any> = {};
        specFieldKeys.forEach(f => { if ((highValueForm as any)[f]) spec[f] = (highValueForm as any)[f]; });
        await itemsApi.createItem({
          materialId: Number(highValueForm.materialId),
          typeId: highValueForm.typeId ? Number(highValueForm.typeId) : undefined,
          costPrice: highValueForm.costPrice || undefined,
          sellingPrice: highValueForm.sellingPrice,
          name: highValueForm.name || undefined,
          origin: highValueForm.origin || undefined,
          counter: highValueForm.counter ? Number(highValueForm.counter) : undefined,
          certNo: highValueForm.certNo || undefined,
          notes: highValueForm.notes || undefined,
          supplierId: highValueForm.supplierId ? Number(highValueForm.supplierId) : undefined,
          purchaseDate: highValueForm.purchaseDate || undefined,
          spec: Object.keys(spec).length > 0 ? spec : undefined,
          tagIds: highValueForm.tagIds.length > 0 ? highValueForm.tagIds : undefined,
        });
        toast.success('高货入库成功！');
      } else {
        if (!batchForm.batchId) { toast.error('请选择批次'); setSaving(false); return; }
        if (!batchForm.sellingPrice) { toast.error('请输入售价'); setSaving(false); return; }
        const validationError = validateRequiredFields(batchForm, false);
        if (validationError) { toast.error(validationError); setSaving(false); return; }
        const spec: Record<string, any> = {};
        specFieldKeys.forEach(f => { if ((batchForm as any)[f]) spec[f] = (batchForm as any)[f]; });
        await itemsApi.createItem({
          batchId: Number(batchForm.batchId),
          typeId: batchForm.typeId ? Number(batchForm.typeId) : undefined,
          sellingPrice: batchForm.sellingPrice,
          name: batchForm.name || undefined,
          counter: batchForm.counter ? Number(batchForm.counter) : undefined,
          certNo: batchForm.certNo || undefined,
          notes: batchForm.notes || undefined,
          spec: Object.keys(spec).length > 0 ? spec : undefined,
          tagIds: batchForm.tagIds.length > 0 ? batchForm.tagIds : undefined,
        });
        toast.success('通货入库成功！');
      }
      setHighValueForm({ materialId: '', typeId: '', costPrice: 0, sellingPrice: 0, name: '', origin: '', counter: '', certNo: '', notes: '', supplierId: '', purchaseDate: '', weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '', tagIds: [] });
      setBatchForm({ batchId: '', typeId: '', sellingPrice: 0, name: '', counter: '', certNo: '', notes: '', weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '', tagIds: [] });
      setMaterialCategory('');
      setMaterialSubType('');
      setBatchMaterialCategory('');
      setBatchMaterialSubType('');
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      if (e?.message?.includes('TAG_MATERIAL_MISMATCH')) {
        const invalidTagIds = e?.details?.invalidTagIds || [];
        const invalidTagNames = e?.details?.invalidTagNames || [];
        setTagMismatch({ mode, invalidTagIds, invalidTagNames });
        toast.error(invalidTagNames.length > 0 ? `标签与材质不匹配：${invalidTagNames.join('、')}` : '存在标签与材质不匹配');
        return;
      }
      toast.error(e.message || '入库失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleCalculatePrice() {
    if (!highValueForm.costPrice || !highValueForm.materialId) return;
    setPricingLoading(true);
    try {
      const result = await pricingApi.calculate({
        costPrice: highValueForm.costPrice,
        materialId: Number(highValueForm.materialId),
        typeId: highValueForm.typeId ? Number(highValueForm.typeId) : undefined,
        weight: highValueForm.weight ? parseFloat(highValueForm.weight) : undefined,
      });
      setPricingSuggestion(result);
    } catch (e: any) {
      toast.error(e.message || '定价计算失败');
    } finally {
      setPricingLoading(false);
    }
  }

  function handleApplyPrice() {
    if (pricingSuggestion?.suggestedPrice) {
      setHighValueForm(f => ({ ...f, sellingPrice: pricingSuggestion.suggestedPrice }));
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增入库</DialogTitle>
          <DialogDescription>添加新货品到库存</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'high_value' ? 'default' : 'outline'} onClick={() => setMode('high_value')} className={mode === 'high_value' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
              <Gem className="h-3 w-3 mr-1" /> 高货入库
            </Button>
            <Button size="sm" variant={mode === 'batch' ? 'default' : 'outline'} onClick={() => setMode('batch')} className={mode === 'batch' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
              <Layers className="h-3 w-3 mr-1" /> 通货入库
            </Button>
          </div>

          {mode === 'high_value' ? (
            <HighValueForm
              form={highValueForm}
              setForm={setHighValueForm}
              materialCategory={materialCategory}
              setMaterialCategory={setMaterialCategory}
              materialSubType={materialSubType}
              setMaterialSubType={setMaterialSubType}
              materials={materials}
              filteredMaterials={filteredMaterials}
              subTypes={subTypes}
              types={types}
              tags={tags}
              suppliers={suppliers}
              currentMaterialId={currentMaterialId}
              specFieldsObj={specFieldsObj}
              specFieldKeys={specFieldKeys}
              customFields={customFields}
              setCustomFields={setCustomFields}
              pricingSuggestion={pricingSuggestion}
              setPricingSuggestion={setPricingSuggestion}
              pricingLoading={pricingLoading}
              setTagMismatch={setTagMismatch}
              onOpenSupplierAdd={() => setShowSupplierAdd(true)}
              onCalculatePrice={handleCalculatePrice}
              onApplyPrice={handleApplyPrice}
            />
          ) : (
            <BatchItemForm
              form={batchForm}
              setForm={setBatchForm}
              batchMaterialCategory={batchMaterialCategory}
              setBatchMaterialCategory={setBatchMaterialCategory}
              batchMaterialSubType={batchMaterialSubType}
              setBatchMaterialSubType={setBatchMaterialSubType}
              batches={batches}
              batchSubTypes={batchSubTypes}
              types={types}
              tags={tags}
              materials={materials}
              currentMaterialId={currentMaterialId}
              specFieldsObj={specFieldsObj}
              specFieldKeys={specFieldKeys}
              customFields={customFields}
              setCustomFields={setCustomFields}
              setTagMismatch={setTagMismatch}
              selectedBatch={selectedBatch}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>{saving ? '保存中...' : '确认入库'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <SupplierQuickAddDialog
        open={showSupplierAdd}
        onOpenChange={setShowSupplierAdd}
        onCreated={(s) => {
          suppliersApi.getSuppliers().then((res: unknown) => setSuppliers((res as { items?: unknown[] })?.items || res || [])).catch(() => {});
          setHighValueForm(f => ({ ...f, supplierId: String(s.id) }));
        }}
      />
    </>
  );
}

export default ItemCreateDialog;
