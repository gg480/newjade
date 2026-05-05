'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MATERIAL_CATEGORIES } from '../settings-tab';
import { formatPrice } from '../shared';
import { Calculator, Plus } from 'lucide-react';
import SpecFieldsRenderer from './spec-fields-renderer';

interface HighValueFormProps {
  form: {
    materialId: string; typeId: string; costPrice: number; sellingPrice: number; name: string;
    origin: string; counter: string; certNo: string; notes: string; supplierId: string; purchaseDate: string;
    weight: string; metalWeight: string; size: string; braceletSize: string; beadCount: string; beadDiameter: string; ringSize: string;
    tagIds: number[];
  };
  setForm: React.Dispatch<React.SetStateAction<{
    materialId: string; typeId: string; costPrice: number; sellingPrice: number; name: string;
    origin: string; counter: string; certNo: string; notes: string; supplierId: string; purchaseDate: string;
    weight: string; metalWeight: string; size: string; braceletSize: string; beadCount: string; beadDiameter: string; ringSize: string;
    tagIds: number[];
  }>>;
  materialCategory: string;
  setMaterialCategory: (v: string) => void;
  materialSubType: string;
  setMaterialSubType: (v: string) => void;
  materials: any[];
  filteredMaterials: any[];
  subTypes: string[];
  types: any[];
  tags: any[];
  suppliers: any[];
  currentMaterialId: number | null;
  specFieldsObj: Record<string, { required: boolean }>;
  specFieldKeys: string[];
  customFields: Record<string, boolean>;
  setCustomFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  pricingSuggestion: any;
  setPricingSuggestion: (v: any) => void;
  pricingLoading: boolean;
  setTagMismatch: React.Dispatch<React.SetStateAction<{ mode: 'high_value' | 'batch'; invalidTagIds: number[]; invalidTagNames: string[] } | null>>;
  onOpenSupplierAdd: () => void;
  onCalculatePrice: () => void;
  onApplyPrice: () => void;
}

function HighValueForm({
  form, setForm, materialCategory, setMaterialCategory, materialSubType, setMaterialSubType,
  materials, filteredMaterials, subTypes, types, tags, suppliers,
  currentMaterialId, specFieldsObj, specFieldKeys, customFields, setCustomFields,
  pricingSuggestion, setPricingSuggestion, pricingLoading,
  setTagMismatch, onOpenSupplierAdd, onCalculatePrice, onApplyPrice,
}: HighValueFormProps) {
  function toggleTag(tagId: number) {
    const ids = form.tagIds.includes(tagId)
      ? form.tagIds.filter(id => id !== tagId)
      : [...form.tagIds, tagId];
    setTagMismatch(null);
    setForm(f => ({ ...f, tagIds: ids }));
  }

  const activeTags = tags.filter((t: any) => t.isActive && t.groupName !== '器型风格');
  const visibleTagIdSet = new Set(activeTags.map((t: any) => t.id));
  const invalidSelected = form.tagIds.filter((id: number) => !visibleTagIdSet.has(id));

  // Tags - Grouped
  const groups = activeTags.reduce((acc: any, tag: any) => {
    const g = tag.groupName || '未分组';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tag);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups);
  const singleGroup = groupKeys.length === 1 && groupKeys[0] === '未分组';
  const mat = materials.find((m: any) => m.id === currentMaterialId);

  return (
    <>
      {/* 材质级联选择 (3级: 大类 → 子类 → 材质) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1"><Label className="text-xs">材质大类</Label>
          <Select value={materialCategory || '_all'} onValueChange={v => {
            setMaterialCategory(v === '_all' ? '' : v);
            setMaterialSubType('');
            setForm(f => ({ ...f, materialId: '' }));
          }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="全部大类" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全部大类</SelectItem>
              {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">子类</Label>
          <Select value={materialSubType || '_all'} onValueChange={v => {
            setMaterialSubType(v === '_all' ? '' : v);
            setForm(f => ({ ...f, materialId: '' }));
          }} disabled={!materialCategory}>
            <SelectTrigger className="h-9"><SelectValue placeholder={materialCategory ? '全部子类' : '先选大类'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全部子类</SelectItem>
              {subTypes.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">材质 <span className="text-red-500">*</span></Label>
          <Select value={form.materialId} onValueChange={v => setForm(f => ({ ...f, materialId: v }))}>
            <SelectTrigger className="h-9"><SelectValue placeholder="选择材质" /></SelectTrigger>
            <SelectContent>{filteredMaterials.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1"><Label className="text-xs">器型 <span className="text-red-500">*</span></Label>
        <Select value={form.typeId} onValueChange={v => setForm(f => ({ ...f, typeId: v }))}>
          <SelectTrigger className="h-9"><SelectValue placeholder="选择器型" /></SelectTrigger>
          <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">成本价 <span className="text-red-500">*</span></Label><Input type="number" value={form.costPrice || ''} onChange={e => setForm(f => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))} className="h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">售价 <span className="text-red-500">*</span></Label><Input type="number" value={form.sellingPrice || ''} onChange={e => setForm(f => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))} className="h-9" /></div>
      </div>
      {/* Pricing Calculator */}
      {form.costPrice > 0 && form.materialId && (
        <div className="space-y-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pricingLoading} onClick={onCalculatePrice}>
            <Calculator className="h-3 w-3 mr-1" />{pricingLoading ? '计算中...' : '定价建议'}
          </Button>
          {pricingSuggestion && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">建议售价</span>
                <span className="font-bold text-emerald-600">{formatPrice(pricingSuggestion.suggestedPrice)}</span>
              </div>
              {pricingSuggestion.floorPrice != null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">底价</span>
                  <span className="font-medium">{formatPrice(pricingSuggestion.floorPrice)}</span>
                </div>
              )}
              {pricingSuggestion.grossMargin != null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">毛利率</span>
                  <span className={`font-medium ${pricingSuggestion.grossMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(pricingSuggestion.grossMargin * 100).toFixed(1)}%</span>
                </div>
              )}
              <Button size="sm" variant="outline" className="h-6 text-xs w-full mt-1" onClick={onApplyPrice}>应用建议售价</Button>
            </div>
          )}
        </div>
      )}
      <div className="space-y-1"><Label className="text-xs">名称</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">产地</Label><Input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} className="h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">柜台号 <span className="text-red-500">*</span></Label><Input placeholder="例: A-01" value={form.counter} onChange={e => setForm(f => ({ ...f, counter: e.target.value }))} className="h-9" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">证书号</Label><Input value={form.certNo} onChange={e => setForm(f => ({ ...f, certNo: e.target.value }))} className="h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">供应商</Label>
          <div className="flex gap-1">
            <Select value={form.supplierId} onValueChange={v => setForm(f => ({ ...f, supplierId: v }))}>
              <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="选择供应商" /></SelectTrigger>
              <SelectContent>
                {suppliers.length === 0 ? (
                  <div className="px-2 py-3 text-center">
                    <p className="text-xs text-muted-foreground mb-2">暂无供应商，请先新增</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenSupplierAdd(); }}>
                      <Plus className="h-3 w-3 mr-1" />新增供应商
                    </Button>
                  </div>
                ) : (
                  suppliers.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-9 w-9 p-0 flex-shrink-0" onClick={onOpenSupplierAdd} title="快速新增供应商">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-1"><Label className="text-xs">采购日期</Label><Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} className="h-9" /></div>
      <SpecFieldsRenderer
        form={form}
        onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
        specFieldsObj={specFieldsObj}
        specFieldKeys={specFieldKeys}
        customFields={customFields}
        setCustomFields={setCustomFields}
      />
      <div className="space-y-1"><Label className="text-xs">备注</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="可选" className="h-16" /></div>
      {invalidSelected.length > 0 && (
        <div className="text-xs px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-700 flex items-center justify-between">
          <span>{invalidSelected.length}个标签与当前材质不符</span>
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => {
            setForm(f => ({ ...f, tagIds: f.tagIds.filter((id: number) => visibleTagIdSet.has(id)) }));
            setTagMismatch(null);
          }}>一键清理</Button>
        </div>
      )}
      {/* Tags - Grouped (filtered by current material) */}
      <div className="space-y-2">
        <Label className="text-xs">标签{mat?.name ? <span className="text-muted-foreground ml-1">— 材质：{mat.name}</span> : ''}</Label>
        {groupKeys.length === 0 && currentMaterialId && (
          <p className="text-xs text-muted-foreground">该材质暂无专用标签，可在系统设置中为其添加标签</p>
        )}
        {groupKeys.map(group => (
          <div key={group}>
            {!singleGroup && <p className="text-xs font-medium text-muted-foreground mb-1">{group}</p>}
            <div className="flex flex-wrap gap-2">
              {groups[group].map((tag: any) => (
                <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={form.tagIds.includes(tag.id)} onCheckedChange={() => toggleTag(tag.id)} />
                  <span className="text-xs">{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">标签需在设置-字典管理中维护。</p>
    </>
  );
}

export default HighValueForm;
