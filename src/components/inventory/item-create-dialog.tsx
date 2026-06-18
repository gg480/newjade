'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { itemsApi, batchesApi, suppliersApi, dictsApi, pricingApi } from '@/lib/api';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import type { DictMaterial, DictType, DictTag, Batch, Supplier, PaginatedData, PricingResult, MaterialComponentInput } from '@/lib/api.types';
import { parseSpecFields, SPEC_FIELD_LABEL_MAP } from './settings-tab';
import HighValueForm from './item-create/high-value-form';
import BatchItemForm from './item-create/batch-item-form';
import { MaterialComponentEditor } from './shared/material-component-editor';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import SupplierQuickAddDialog from './supplier-quick-add-dialog';

import { Gem, Layers } from 'lucide-react';

// ========== Item Creation Dialog ==========
function ItemCreateDialog({ open, onOpenChange, onSuccess, defaultBatchId, defaultBatchInfo }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void; defaultBatchId?: number; defaultBatchInfo?: { materialId?: number; supplierId?: number; purchaseDate?: string; typeId?: number } }) {
  const { handleError } = useErrorHandler();
  const [mode, setMode] = useState<'high_value' | 'batch'>('high_value');
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);
  const [tags, setTags] = useState<DictTag[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSupplierAdd, setShowSupplierAdd] = useState(false);
  const [tagMismatch, setTagMismatch] = useState<{ mode: 'high_value' | 'batch'; invalidTagIds: number[]; invalidTagNames: string[] } | null>(null);
  const [pricingSuggestion, setPricingSuggestion] = useState<(PricingResult & { suggestedPrice?: number }) | null>(null);
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

  // ADR-020: 货品类型与材质组件
  const [compositeType, setCompositeType] = useState<'single' | 'inlay' | 'composite'>('single');
  const [materialComponents, setMaterialComponents] = useState<MaterialComponentInput[]>([]);

  // ADR-020: 镶嵌型/组合型价格联动汇算
  // 成本价 = 所有组件 costPrice 之和
  // 售价 = 主石+伴石售价之和（镶材动态价由后端按 MetalPrice 计算，前端不汇算）
  // 组合型售价 = 所有组件 sellingPrice 之和
  useEffect(() => {
    if (compositeType === 'single' || materialComponents.length === 0) return;
    const sumCost = materialComponents.reduce((sum, c) => sum + (c.costPrice ?? 0), 0);
    const sumSelling = compositeType === 'inlay'
      ? materialComponents
          .filter(c => c.role === 'main_stone' || c.role === 'companion_stone')
          .reduce((sum, c) => sum + (c.sellingPrice ?? 0), 0)
      : materialComponents.reduce((sum, c) => sum + (c.sellingPrice ?? 0), 0);
    setHighValueForm(f => ({
      ...f,
      costPrice: Math.round(sumCost * 100) / 100,
      sellingPrice: Math.round(sumSelling * 100) / 100,
    }));
  }, [compositeType, materialComponents]);

  const [batchForm, setBatchForm] = useState({
    batchId: '', typeId: '', sellingPrice: 0, name: '', counter: '', certNo: '', notes: '',
    weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '',
    tagIds: [] as number[],
  });

  useEffect(() => {
    if (open) {
      dictsApi.getMaterials().then(setMaterials).catch(() => {});
      dictsApi.getTypes().then(setTypes).catch(() => {});
      suppliersApi.getSuppliers().then((s: PaginatedData<Supplier>) => setSuppliers(s?.items || s || [])).catch(() => {});
      batchesApi.getBatches({ size: 100 }).then((d: PaginatedData<Batch>) => setBatches(d?.items || [])).catch(() => {});

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
    () => batches.find((b: Batch) => String(b.id) === String(batchForm.batchId)),
    [batches, batchForm.batchId],
  );
  const highValueMaterialId = highValueForm.materialId ? Number(highValueForm.materialId) : null;
  const batchMaterialId = selectedBatch?.materialId ? Number(selectedBatch.materialId) : null;

  // ADR-020: 镶嵌型/组合型时，标签按主材质联动
  // 镶嵌型取主石 materialId，组合型取首个有效组件 materialId
  const compositeMainMaterialId = useMemo(() => {
    if (compositeType === 'single' || materialComponents.length === 0) return null;
    const valid = materialComponents.filter(c => c.materialId > 0);
    if (valid.length === 0) return null;
    if (compositeType === 'inlay') {
      const mainStone = valid.find(c => c.role === 'main_stone');
      return mainStone?.materialId ?? null;
    }
    // 组合型：取第一个组件
    return valid[0].materialId;
  }, [compositeType, materialComponents]);

  const currentMaterialId = mode === 'high_value'
    ? (compositeType !== 'single' ? compositeMainMaterialId : highValueMaterialId)
    : batchMaterialId;

  useEffect(() => {
    if (!open) return;
    dictsApi.getTags(undefined, false, currentMaterialId || undefined).then((list: DictTag[]) => {
      setTags(list);
    }).catch(() => {});
  }, [open, currentMaterialId]);

  useEffect(() => {
    setTagMismatch(null);
  }, [mode, currentMaterialId]);

  // 根据大类筛选材质（含子类）
  const filteredByCategory = materials.filter((m: DictMaterial) => {
    if (!materialCategory) return true;
    return m.category === materialCategory;
  });

  // 动态提取子类列表
  const subTypes = useMemo(() => {
    const types = new Set<string>();
    filteredByCategory.forEach((m: DictMaterial) => { if (m.subType) types.add(m.subType); });
    return Array.from(types).sort();
  }, [filteredByCategory]);

  // 根据大类+子类筛选材质
  const filteredMaterials = useMemo(() => {
    return filteredByCategory.filter((m: DictMaterial) => {
      if (!materialSubType) return true;
      return m.subType === materialSubType;
    });
  }, [filteredByCategory, materialSubType]);

  // ===== 批次模式 =====
  const batchFilteredByCategory = useMemo(() => materials.filter((m: DictMaterial) => {
    if (!batchMaterialCategory) return true;
    return m.category === batchMaterialCategory;
  }), [materials, batchMaterialCategory]);

  const batchSubTypes = useMemo(() => {
    const types = new Set<string>();
    batchFilteredByCategory.forEach((m: DictMaterial) => { if (m.subType) types.add(m.subType); });
    return Array.from(types).sort();
  }, [batchFilteredByCategory]);

  const batchFilteredMaterials = useMemo(() => {
    return batchFilteredByCategory.filter((m: DictMaterial) => {
      if (!batchMaterialSubType) return true;
      return m.subType === batchMaterialSubType;
    });
  }, [batchFilteredByCategory, batchMaterialSubType]);

  const selectedType = types.find((t: DictType) => String(t.id) === (mode === 'high_value' ? highValueForm.typeId : batchForm.typeId));
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
    // ADR-020: 镶嵌型/组合型成本价由组件汇算，跳过前端成本价校验（后端 computedCostPrice 兜底）
    if (isHighValue && compositeType === 'single' && !highValueForm.costPrice) return '请输入成本价';
    // 器型必填规格字段
    for (const field of specFieldKeys) {
      if (specFieldsObj[field]?.required && !form[field as keyof typeof form]) {
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
        // ADR-020: 镶嵌型/组合型材质校验，主石 materialId 作为 Item.materialId
        let itemMaterialId: number;
        if (compositeType !== 'single') {
          const validComponents = materialComponents.filter(c => c.materialId > 0);
          if (compositeType === 'inlay') {
            const mainStone = validComponents.find(c => c.role === 'main_stone');
            const settingMaterial = validComponents.find(c => c.role === 'setting_material');
            if (!mainStone) { toast.error('请选择主石材质'); setSaving(false); return; }
            if (!settingMaterial) { toast.error('请选择镶材材质'); setSaving(false); return; }
            itemMaterialId = mainStone.materialId;
          } else {
            // 组合型：取第一个组件的材质作为主材质
            if (validComponents.length === 0) { toast.error('请至少添加一个材质组件'); setSaving(false); return; }
            itemMaterialId = validComponents[0].materialId;
          }
        } else {
          if (!highValueForm.materialId) { toast.error('请选择材质'); setSaving(false); return; }
          itemMaterialId = Number(highValueForm.materialId);
        }
        // ADR-020: 镶嵌型/组合型售价由组件汇算，提示引导用户填写组件售价
        if (!highValueForm.sellingPrice) {
          toast.error(compositeType !== 'single' ? '请填写组件售价（主石/伴石）' : '请输入售价');
          setSaving(false); return;
        }
        const validationError = validateRequiredFields(highValueForm, true);
        if (validationError) { toast.error(validationError); setSaving(false); return; }
        const spec: Record<string, string | number> = {};
        specFieldKeys.forEach(f => { if (highValueForm[f as keyof typeof highValueForm]) spec[f] = String(highValueForm[f as keyof typeof highValueForm]); });
        await itemsApi.createItem({
          materialId: itemMaterialId,
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
          // ADR-020: 货品类型与材质组件
          compositeType,
          components: compositeType !== 'single' && materialComponents.length > 0
            ? materialComponents.filter(c => c.materialId > 0)
            : undefined,
        });
        toast.success('高货入库成功！');
      } else {
        if (!batchForm.batchId) { toast.error('请选择批次'); setSaving(false); return; }
        if (!batchForm.sellingPrice) { toast.error('请输入售价'); setSaving(false); return; }
        const validationError = validateRequiredFields(batchForm, false);
        if (validationError) { toast.error(validationError); setSaving(false); return; }
        const spec: Record<string, string | number> = {};
        specFieldKeys.forEach(f => { if (batchForm[f as keyof typeof batchForm]) spec[f] = String(batchForm[f as keyof typeof batchForm]); });
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
    } catch (error: unknown) {
      // 处理标签与材质不匹配的特殊错误
      if (error instanceof Error && error.message?.includes('TAG_MATERIAL_MISMATCH')) {
        const details = (error as Record<string, unknown>).details as Record<string, unknown> | undefined;
        const invalidTagIds = (details?.invalidTagIds as number[]) || [];
        const invalidTagNames = (details?.invalidTagNames as string[]) || [];
        setTagMismatch({ mode, invalidTagIds, invalidTagNames });
        toast.error(invalidTagNames.length > 0 ? `标签与材质不匹配：${invalidTagNames.join('、')}` : '存在标签与材质不匹配');
        return;
      }
      handleError(error, { title: '入库失败' });
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
    } catch (error) {
      handleError(error, { title: '定价计算失败' });
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
            <>
              {/* ADR-020: 货品类型选择（提前到表单最前，决定后续材质录入方式） */}
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">货品类型 <span className="text-red-500">*</span></Label>
                  <Select
                    value={compositeType}
                    onValueChange={(v) => {
                      setCompositeType(v as 'single' | 'inlay' | 'composite');
                      if (v === 'single') {
                        setMaterialComponents([]);
                      } else if (v === 'inlay') {
                        // 镶嵌型初始化主石+镶材（伴石可选，不初始化）
                        setMaterialComponents([
                          { materialId: 0, role: 'main_stone', weight: null, costPrice: null, sellingPrice: null, sortOrder: 0 },
                          { materialId: 0, role: 'setting_material', weight: null, costPrice: null, sellingPrice: null, sortOrder: 1 },
                        ]);
                      } else {
                        // 组合型初始化一个空组件
                        setMaterialComponents([
                          { materialId: 0, role: 'component', weight: null, costPrice: null, sellingPrice: null, sortOrder: 0 },
                        ]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">单一型</SelectItem>
                      <SelectItem value="inlay">镶嵌型（主石+镶材+伴石）</SelectItem>
                      <SelectItem value="composite">组合型（多材质并列）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                hideMaterialSelect={compositeType !== 'single'}
                materialEditor={
                  compositeType !== 'single' ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {compositeType === 'inlay' ? '镶嵌材质（主石+镶材+伴石）' : '组合材质（多组件）'}
                      </Label>
                      <MaterialComponentEditor
                        compositeType={compositeType}
                        components={materialComponents}
                        onChange={setMaterialComponents}
                        materials={materials}
                      />
                    </div>
                  ) : undefined
                }
              />
            </>
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
