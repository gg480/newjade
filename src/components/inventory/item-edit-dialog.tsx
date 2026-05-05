'use client';

import React, { useState, useEffect } from 'react';
import { itemsApi, dictsApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, StatusBadge } from './shared';
import { parseSpecFields } from './settings-tab';
import EditBasicFields from './item-edit/edit-basic-fields';
import EditSpecFields from './item-edit/edit-spec-fields';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import { Copy } from 'lucide-react';

// ========== Item Edit Dialog ==========
function ItemEditDialog({ itemId, open, onOpenChange, onSuccess }: { itemId: number | null; open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const [item, setItem] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({});
  const [itemMaterialId, setItemMaterialId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', sellingPrice: 0, floorPrice: 0, counter: '', certNo: '', notes: '', origin: '',
    tagIds: [] as number[],
    weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '',
  });
  // Track original values for diff indicator
  const [originalForm, setOriginalForm] = useState<typeof form | null>(null);

  useEffect(() => {
    if (open) {
      dictsApi.getTypes().then(setTypes).catch(() => {});
    }
  }, [open]);

  // Fetch tags filtered by item's material
  useEffect(() => {
    if (!open) return;
    if (itemMaterialId) {
      dictsApi.getTags(undefined, false, itemMaterialId).then(setTags).catch(() => {});
    } else {
      dictsApi.getTags().then(setTags).catch(() => {});
    }
  }, [open, itemMaterialId]);

  useEffect(() => {
    if (open && itemId) {
      setLoading(true);
      itemsApi.getItem(itemId).then((data: any) => {
        setItem(data);
        setItemMaterialId(data.materialId || null);
        const specObj: any = data.spec || {};
        setForm({
          name: data.name || '',
          sellingPrice: data.sellingPrice || 0,
          floorPrice: data.floorPrice || 0,
          counter: data.counter != null ? String(data.counter) : '',
          certNo: data.certNo || '',
          notes: data.notes || '',
          origin: data.origin || '',
          tagIds: data.tags ? data.tags.map((t: any) => t.id) : [],
          weight: specObj.weight || '',
          metalWeight: specObj.metalWeight || '',
          size: specObj.size || '',
          braceletSize: specObj.braceletSize || '',
          beadCount: specObj.beadCount || '',
          beadDiameter: specObj.beadDiameter || '',
          ringSize: specObj.ringSize || '',
        });
      }).catch(() => {
        toast.error('加载货品信息失败');
      }).finally(() => setLoading(false));
    } else {
      setItem(null);
      setOriginalForm(null);
      setItemMaterialId(null);
    }
  }, [open, itemId]);

  // Store original values when item loads
  useEffect(() => {
    if (item && !loading) {
      setOriginalForm({ ...form });
    }
  }, [item?.id]);

  const selectedType = types.find((t: any) => String(t.id) === String(item?.typeId));
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
      if (specFieldsObj[field]?.required && !(form as any)[field]) {
        const label = SPEC_FIELD_LABEL_MAP[field] || field;
        return `请输入${label}`;
      }
    }
    return null;
  }

  // Check if a field has changed from original
  function isFieldChanged(field: string) {
    if (!originalForm) return false;
    return String((form as any)[field]) !== String((originalForm as any)[field]);
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
        if (String((form as any)[key]) !== String((originalForm as any)[key])) count++;
      }
    }
    return count;
  }

  function isFormChanged() {
    return getChangedFieldsCount() > 0;
  }

  function onFieldChange(field: string, value: any) {
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
      const spec: Record<string, any> = {};
      specFieldKeys.forEach(f => { if ((form as any)[f]) spec[f] = (form as any)[f]; });
      await itemsApi.updateItem(itemId, {
        name: form.name || undefined,
        sellingPrice: form.sellingPrice,
        floorPrice: form.floorPrice || undefined,
        counter: form.counter ? Number(form.counter) : undefined,
        certNo: form.certNo || undefined,
        notes: form.notes || undefined,
        origin: form.origin || undefined,
        spec: Object.keys(spec).length > 0 ? spec : undefined,
        tagIds: form.tagIds,
      });
      toast.success('货品更新成功！');
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || '更新失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateAsNew() {
    if (!item) return;
    setSaving(true);
    try {
      const spec: Record<string, any> = {};
      specFieldKeys.forEach(f => { if ((form as any)[f]) spec[f] = (form as any)[f]; });
      await itemsApi.createItem({
        materialId: item.materialId,
        typeId: item.typeId || undefined,
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
    } catch (e: any) {
      toast.error(e.message || '复制失败');
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
      const spec: Record<string, any> = {};
      specFieldKeys.forEach(f => { if ((form as any)[f]) spec[f] = (form as any)[f]; });
      await itemsApi.updateItem(itemId, {
        name: form.name || undefined,
        sellingPrice: form.sellingPrice,
        floorPrice: form.floorPrice || undefined,
        counter: form.counter ? Number(form.counter) : undefined,
        certNo: form.certNo || undefined,
        notes: form.notes || undefined,
        origin: form.origin || undefined,
        spec: Object.keys(spec).length > 0 ? spec : undefined,
        tagIds: form.tagIds,
      });
      toast.success('货品更新成功！');
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || '更新失败');
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
              <div><span className="text-muted-foreground">材质:</span> {item.materialName || '-'}</div>
              <div><span className="text-muted-foreground">器型:</span> {item.typeName || '-'}</div>
              <div><span className="text-muted-foreground">状态:</span> <StatusBadge status={item.status} /></div>
              <div><span className="text-muted-foreground">成本价:</span> {formatPrice(item.costPrice)}</div>
              <div><span className="text-muted-foreground">分摊成本:</span> {formatPrice(item.allocatedCost)}</div>
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
