'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { itemsApi, dictsApi } from '@/lib/api';
import type { ItemSummary, DictMaterial, DictType, DictTag, MaterialComponentInput, ItemMaterialComponent } from '@/lib/api.types';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { formatPrice, StatusBadge } from './shared';
import { parseSpecFields } from './settings-tab';
import { MATERIAL_CATEGORIES } from '@/lib/constants';
import EditBasicFields from './item-edit/edit-basic-fields';
import EditSpecFields from './item-edit/edit-spec-fields';
import { MaterialComponentEditor } from './shared/material-component-editor';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import { Copy, Gem, Type } from 'lucide-react';

// ========== Item Edit Dialog ==========
function ItemEditDialog({ itemId, open, onOpenChange, onSuccess }: { itemId: number | null; open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const { handleError } = useErrorHandler();
  const [item, setItem] = useState<ItemSummary | null>(null);
  const [types, setTypes] = useState<DictType[]>([]);
  const [tags, setTags] = useState<DictTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({});
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [materialCategory, setMaterialCategory] = useState('');
  const [materialSubType, setMaterialSubType] = useState('');
  // ADR-020: 货品类型与材质组件
  const [compositeType, setCompositeType] = useState<'single' | 'inlay' | 'composite'>('single');
  const [materialComponents, setMaterialComponents] = useState<MaterialComponentInput[]>([]);
  const [form, setForm] = useState({
    name: '', sellingPrice: 0, floorPrice: 0, counter: '', certNo: '', notes: '', origin: '',
    tagIds: [] as number[],
    materialId: '', typeId: '',
    weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '',
  });
  // Track original values for diff indicator
  const [originalForm, setOriginalForm] = useState<typeof form | null>(null);

  useEffect(() => {
    if (open) {
      dictsApi.getTypes().then(setTypes).catch(() => {});
      dictsApi.getMaterials().then(setMaterials).catch(() => {});
    }
  }, [open]);

  // 当材质变化时，重新加载该材质下的器型和标签
  function onMaterialChange(materialIdStr: string) {
    setForm(f => ({ ...f, materialId: materialIdStr }));
    const materialIdNum = materialIdStr ? Number(materialIdStr) : null;
    if (materialIdNum) {
      dictsApi.getTypes(false, materialIdNum).then(newTypes => {
        setTypes(newTypes);
        // 如果当前 typeId 不在新器型列表中，清零
        setForm(f => {
          if (f.typeId && !newTypes.some(t => String(t.id) === f.typeId)) {
            return { ...f, typeId: '' };
          }
          return f;
        });
      }).catch(() => {});
      dictsApi.getTags(undefined, false, materialIdNum).then(newTags => {
        setTags(newTags);
        // 清零不兼容的标签
        setForm(f => ({
          ...f,
          tagIds: f.tagIds.filter(id => newTags.some(t => t.id === id))
        }));
      }).catch(() => {});
    } else {
      dictsApi.getTypes().then(setTypes).catch(() => {});
      dictsApi.getTags().then(setTags).catch(() => {});
    }
  }

  useEffect(() => {
    if (open && itemId) {
      setLoading(true);
      itemsApi.getItem(itemId).then((data: ItemSummary) => {
        setItem(data);
        const specObj = data.spec || {};
        setForm({
          name: data.name || '',
          sellingPrice: data.sellingPrice || 0,
          floorPrice: data.floorPrice || 0,
          counter: data.counter != null ? String(data.counter) : '',
          certNo: data.certNo || '',
          notes: data.notes || '',
          origin: data.origin || '',
          tagIds: data.tags ? data.tags.map((t: DictTag) => t.id) : [],
          materialId: String(data.materialId || ''),
          typeId: String(data.typeId || ''),
          weight: specObj.weight || '',
          metalWeight: specObj.metalWeight || '',
          size: specObj.size || '',
          braceletSize: specObj.braceletSize || '',
          beadCount: specObj.beadCount || '',
          beadDiameter: specObj.beadDiameter || '',
          ringSize: specObj.ringSize || '',
        });
        // ADR-020: 加载货品类型与材质组件
        setCompositeType((data.compositeType as 'single' | 'inlay' | 'composite') || 'single');
        setMaterialComponents(
          (data.materialComponents || []).map((c: ItemMaterialComponent) => ({
            materialId: c.materialId,
            role: c.role,
            weight: c.weight,
            costPrice: c.costPrice,
            sellingPrice: c.sellingPrice,
            sortOrder: c.sortOrder,
            notes: c.notes,
          }))
        );
      }).catch(() => {
        toast.error('加载货品信息失败');
      }).finally(() => setLoading(false));
    } else {
      setItem(null);
      setOriginalForm(null);
    }
  }, [open, itemId]);

  // Store original values when item loads
  useEffect(() => {
    if (item && !loading) {
      setOriginalForm({ ...form });
    }
  }, [item?.id]);

  // ========== 材质级联筛选 ==========
  const filteredByCategory = useMemo(() => {
    if (!materialCategory) return materials;
    return materials.filter(m => m.category === materialCategory);
  }, [materials, materialCategory]);

  const subTypes = useMemo(() => {
    const set = new Set<string>();
    filteredByCategory.forEach(m => {
      if (m.subType) set.add(m.subType);
    });
    return Array.from(set).sort();
  }, [filteredByCategory]);

  const filteredMaterials = useMemo(() => {
    if (!materialSubType) return filteredByCategory;
    return filteredByCategory.filter(m => m.subType === materialSubType);
  }, [filteredByCategory, materialSubType]);

  // 当 item 和 materials 都加载完成后，初始化级联选择器的值
  useEffect(() => {
    if (!item || materials.length === 0) return;
    const mat = materials.find(m => m.id === Number(form.materialId));
    if (mat) {
      setMaterialCategory(mat.category || '');
      setMaterialSubType(mat.subType || '');
    }
    // 根据 item 的材质加载器型和标签
    if (form.materialId) {
      const materialIdNum = Number(form.materialId);
      dictsApi.getTypes(false, materialIdNum).then(setTypes).catch(() => {});
      dictsApi.getTags(undefined, false, materialIdNum).then(setTags).catch(() => {});
    }
  }, [item?.id, materials.length]);

  const selectedType = types.find((t: DictType) => String(t.id) === form.typeId);
  const typeSpecFields = parseSpecFields(selectedType?.specFields);
  // When no type is selected, show all spec fields; otherwise show only type-specific fields
  const ALL_SPEC_FIELDS: Record<string, { required: boolean }> = {
    weight: { required: false }, metalWeight: { required: false }, size: { required: false },
    braceletSize: { required: false }, beadCount: { required: false }, beadDiameter: { required: false }, ringSize: { required: false },
  };
  const specFieldsObj = Object.keys(typeSpecFields).length > 0 ? typeSpecFields : ALL_SPEC_FIELDS;
  const specFieldKeys = Object.keys(specFieldsObj);

  function toggleTag(tagId: number) {
    const ids = form.tagIds.includes(tagId) ? form.tagIds.filter(id => id !== tagId) : [...form.tagIds, tagId];
    setForm(f => ({ ...f, tagIds: ids }));
  }

  // 校验必填字段
  function validateRequiredFields(): string | null {
    // 柜台号必填
    if (!form.counter) return '请输入柜台号';
    // 器型必填规格字段
    for (const field of specFieldKeys) {
      if (specFieldsObj[field]?.required && !form[field as keyof typeof form]) {
        const label = SPEC_FIELD_LABEL_MAP[field] || field;
        return `请输入${label}`;
      }
    }
    return null;
  }

  // Check if a field has changed from original
  function isFieldChanged(field: string) {
    if (!originalForm) return false;
    return String(form[field as keyof typeof form]) !== String(originalForm[field as keyof typeof originalForm]);
  }

  // Count how many fields have changed
  function getChangedFieldsCount() {
    if (!originalForm) return 0;
    let count = 0;
    const keys = Object.keys(originalForm) as (keyof typeof form)[];
    for (const key of keys) {
      if (key === 'tagIds') {
        if (JSON.stringify(form.tagIds) !== JSON.stringify(originalForm.tagIds)) count++;
      } else {
        if (String(form[key]) !== String(originalForm[key])) count++;
      }
    }
    return count;
  }

  function isFormChanged() {
    return getChangedFieldsCount() > 0;
  }

  function onFieldChange(field: keyof typeof form, value: string | number | number[]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleTag(tagId: number) {
    const ids = form.tagIds.includes(tagId) ? form.tagIds.filter(id => id !== tagId) : [...form.tagIds, tagId];
    setForm(f => ({ ...f, tagIds: ids }));
  }

  async function handleSave() {
    if (!itemId) return;
    const validationError = validateRequiredFields();
    if (validationError) { toast.error(validationError); return; }

    setSaving(true);
    try {
      const spec: Record<string, string | number> = {};
      specFieldKeys.forEach(f => { if (form[f as keyof typeof form]) spec[f] = String(form[f as keyof typeof form]); });
      await itemsApi.updateItem(itemId, {
        name: form.name || undefined,
        sellingPrice: form.sellingPrice,
        floorPrice: form.floorPrice || undefined,
        counter: form.counter ? Number(form.counter) : undefined,
        certNo: form.certNo || undefined,
        notes: form.notes || undefined,
        origin: form.origin || undefined,
        materialId: form.materialId ? Number(form.materialId) : undefined,
        typeId: form.typeId ? Number(form.typeId) : undefined,
        spec: Object.keys(spec).length > 0 ? spec : undefined,
        tagIds: form.tagIds,
        // ADR-020: 货品类型与材质组件
        compositeType,
        components: compositeType !== 'single' && materialComponents.length > 0
          ? materialComponents.filter(c => c.materialId > 0)
          : compositeType === 'single' ? [] : undefined,
      });
      toast.success('货品更新成功！');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      handleError(error, { title: '更新失败' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateAsNew() {
    if (!item) return;
    setSaving(true);
    try {
      const spec: Record<string, string | number> = {};
      specFieldKeys.forEach(f => { if (form[f as keyof typeof form]) spec[f] = String(form[f as keyof typeof form]); });
      await itemsApi.createItem({
        materialId: form.materialId ? Number(form.materialId) : item.materialId,
        typeId: form.typeId ? Number(form.typeId) : item.typeId || undefined,
        costPrice: item.costPrice || undefined,
        sellingPrice: form.sellingPrice || item.sellingPrice,
        name: form.name || undefined,
        origin: form.origin || undefined,
        counter: form.counter ? Number(form.counter) : undefined,
        certNo: form.certNo || undefined,
        notes: form.notes || undefined,
        supplierId: item.supplierId || undefined,
        purchaseDate: item.purchaseDate || undefined,
        batchId: item.batchId || undefined,
        spec: Object.keys(spec).length > 0 ? spec : undefined,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
      });
      toast.success('已复制为新货品！');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      handleError(error, { title: '复制失败' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndContinue() {
    if (!itemId) return;
    const validationError = validateRequiredFields();
    if (validationError) { toast.error(validationError); return; }

    setSaving(true);
    try {
      const spec: Record<string, string | number> = {};
      specFieldKeys.forEach(f => { if (form[f as keyof typeof form]) spec[f] = String(form[f as keyof typeof form]); });
      await itemsApi.updateItem(itemId, {
        name: form.name || undefined,
        sellingPrice: form.sellingPrice,
        floorPrice: form.floorPrice || undefined,
        counter: form.counter ? Number(form.counter) : undefined,
        certNo: form.certNo || undefined,
        notes: form.notes || undefined,
        origin: form.origin || undefined,
        materialId: form.materialId ? Number(form.materialId) : undefined,
        typeId: form.typeId ? Number(form.typeId) : undefined,
        spec: Object.keys(spec).length > 0 ? spec : undefined,
        tagIds: form.tagIds,
      });
      toast.success('货品更新成功！');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      handleError(error, { title: '更新失败' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑货品</DialogTitle>
          <DialogDescription>{item?.skuCode || ''}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3 py-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>
        ) : item ? (
          <div className="space-y-4 py-2">
            {/* Non-editable info */}
            <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-3 rounded-lg">
              <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{item.skuCode}</span></div>
              <div><span className="text-muted-foreground">状态:</span> <StatusBadge status={item.status} /></div>
              <div><span className="text-muted-foreground">成本价:</span> {formatPrice(item.costPrice)}</div>
              <div><span className="text-muted-foreground">分摊成本:</span> {formatPrice(item.allocatedCost)}</div>
            </div>

            {/* 材质（三级级联：大类 → 子类 → 材质） */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Gem className="h-3 w-3" />
                材质
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <Select
                  value={materialCategory}
                  onValueChange={v => {
                    setMaterialCategory(v);
                    setMaterialSubType('');
                    onMaterialChange('');
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="大类" />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subTypes.length > 0 && (
                  <Select
                    value={materialSubType}
                    onValueChange={v => {
                      setMaterialSubType(v);
                      onMaterialChange('');
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="子类" />
                    </SelectTrigger>
                    <SelectContent>
                      {subTypes.map(s => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={form.materialId}
                  onValueChange={onMaterialChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="材质" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMaterials.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 器型 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Type className="h-3 w-3" />
                器型
              </label>
              <Select
                value={form.typeId}
                onValueChange={v => setForm(f => ({ ...f, typeId: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择器型" />
                </SelectTrigger>
                <SelectContent>
                  {types.filter(t => t.isActive).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Changed indicator banner */}
            {isFormChanged() && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                有 {getChangedFieldsCount()} 个字段已修改
              </div>
            )}

            {/* Editable fields */}
            <EditBasicFields
              form={form}
              onChange={onFieldChange}
              isFieldChanged={isFieldChanged}
            />
            {/* Dynamic spec fields + Tags */}
            <EditSpecFields
              form={form}
              onChange={onFieldChange}
              tags={tags}
              item={item}
              specFieldsObj={specFieldsObj}
              specFieldKeys={specFieldKeys}
              customFields={customFields}
              setCustomFields={setCustomFields}
              onTagToggle={toggleTag}
            />
            {/* ADR-020: 货品类型选择 + 材质组件编辑器 */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div>
                <Label className="text-xs text-muted-foreground">货品类型</Label>
                <Select
                  value={compositeType}
                  onValueChange={(v) => {
                    setCompositeType(v as 'single' | 'inlay' | 'composite');
                    if (v === 'single') setMaterialComponents([]);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">单一型</SelectItem>
                    <SelectItem value="inlay">镶嵌型（主石+镶材+伴石）</SelectItem>
                    <SelectItem value="composite">组合型（多材质并列）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {compositeType !== 'single' && (
                <MaterialComponentEditor
                  compositeType={compositeType}
                  components={materialComponents}
                  onChange={setMaterialComponents}
                  materials={materials}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">未找到货品信息</div>
        )}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">取消</Button>
            <Button variant="outline" onClick={handleDuplicateAsNew} className="flex-1 sm:flex-none text-amber-600 hover:text-amber-700 border-amber-300 hover:bg-amber-50" disabled={saving || loading} title="复制当前所有值创建一个新货品（不复制SKU）">
              <Copy className="h-3 w-3 mr-1" />复制为新货品
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={handleSaveAndContinue} className="bg-sky-600 hover:bg-sky-700 flex-1 sm:flex-none" disabled={saving || loading}>{saving ? '保存中...' : '保存并继续'}</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none" disabled={saving || loading}>{saving ? '保存中...' : '保存修改'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItemEditDialog;
