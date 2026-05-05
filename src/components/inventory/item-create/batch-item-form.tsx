'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MATERIAL_CATEGORIES } from '../settings-tab';
import SpecFieldsRenderer from './spec-fields-renderer';

interface BatchItemFormProps {
  form: {
    batchId: string; typeId: string; sellingPrice: number; name: string; counter: string; certNo: string; notes: string;
    weight: string; metalWeight: string; size: string; braceletSize: string; beadCount: string; beadDiameter: string; ringSize: string;
    tagIds: number[];
  };
  setForm: React.Dispatch<React.SetStateAction<{
    batchId: string; typeId: string; sellingPrice: number; name: string; counter: string; certNo: string; notes: string;
    weight: string; metalWeight: string; size: string; braceletSize: string; beadCount: string; beadDiameter: string; ringSize: string;
    tagIds: number[];
  }>>;
  batchMaterialCategory: string;
  setBatchMaterialCategory: (v: string) => void;
  batchMaterialSubType: string;
  setBatchMaterialSubType: (v: string) => void;
  batches: any[];
  batchSubTypes: string[];
  types: any[];
  tags: any[];
  materials: any[];
  currentMaterialId: number | null;
  specFieldsObj: Record<string, { required: boolean }>;
  specFieldKeys: string[];
  customFields: Record<string, boolean>;
  setCustomFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setTagMismatch: React.Dispatch<React.SetStateAction<{ mode: 'high_value' | 'batch'; invalidTagIds: number[]; invalidTagNames: string[] } | null>>;
  selectedBatch: any;
}

function BatchItemForm({
  form, setForm, batchMaterialCategory, setBatchMaterialCategory, batchMaterialSubType, setBatchMaterialSubType,
  batches, batchSubTypes, types, tags, materials, currentMaterialId,
  specFieldsObj, specFieldKeys, customFields, setCustomFields,
  setTagMismatch, selectedBatch,
}: BatchItemFormProps) {
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
      <div className="space-y-1"><Label className="text-xs">所属批次 <span className="text-red-500">*</span></Label>
        <Select value={form.batchId} onValueChange={v => setForm(f => ({ ...f, batchId: v }))}>
          <SelectTrigger className="h-9"><SelectValue placeholder="选择批次" /></SelectTrigger>
          <SelectContent>{batches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.batchCode} - {b.materialName}</SelectItem>)}</SelectContent>
        </Select>
        {form.batchId && (() => {
          const b = batches.find((x: any) => String(x.id) === String(form.batchId));
          if (b && b.totalCost && b.quantity) {
            const allocated = (b.totalCost / b.quantity).toFixed(2);
            return <p className="text-xs text-muted-foreground mt-1">预计分摊成本: ¥{allocated}/件 (总¥{b.totalCost} ÷ {b.quantity}件)</p>;
          }
          return null;
        })()}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">售价 <span className="text-red-500">*</span></Label><Input type="number" value={form.sellingPrice || ''} onChange={e => setForm(f => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))} className="h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">柜台号 <span className="text-red-500">*</span></Label><Input placeholder="例: A-01" value={form.counter} onChange={e => setForm(f => ({ ...f, counter: e.target.value }))} className="h-9" /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">名称</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">证书号</Label><Input value={form.certNo} onChange={e => setForm(f => ({ ...f, certNo: e.target.value }))} className="h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">器型 <span className="text-red-500">*</span></Label>
          <Select value={form.typeId} onValueChange={v => setForm(f => ({ ...f, typeId: v }))}>
            <SelectTrigger className="h-9"><SelectValue placeholder="选择器型" /></SelectTrigger>
            <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {/* 批次模式材质级联 (3级: 大类 → 子类 → 材质) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1"><Label className="text-xs">材质大类</Label>
          <Select value={batchMaterialCategory || '_all'} onValueChange={v => setBatchMaterialCategory(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="全部大类" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全部大类</SelectItem>
              {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">子类</Label>
          <Select value={batchMaterialSubType || '_all'} onValueChange={v => setBatchMaterialSubType(v === '_all' ? '' : v)} disabled={!batchMaterialCategory}>
            <SelectTrigger className="h-9"><SelectValue placeholder={batchMaterialCategory ? '全部子类' : '先选大类'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全部子类</SelectItem>
              {batchSubTypes.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">材质</Label>
          <Select value={''} disabled={true}>
            <SelectTrigger className="h-9"><SelectValue placeholder="批次关联材质" /></SelectTrigger>
            <SelectContent></SelectContent>
          </Select>
        </div>
      </div>
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
      {/* Tags - Grouped (filtered by current batch material) */}
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

export default BatchItemForm;
