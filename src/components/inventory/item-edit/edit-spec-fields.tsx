'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil } from 'lucide-react';

interface EditSpecFieldsProps {
  form: {
    name: string; sellingPrice: number; floorPrice: number; counter: string; certNo: string; notes: string; origin: string;
    tagIds: number[];
    weight: string; metalWeight: string; size: string; braceletSize: string; beadCount: string; beadDiameter: string; ringSize: string;
  };
  onChange: (field: string, value: any) => void;
  tags: any[];
  item: any;
  specFieldsObj: Record<string, { required: boolean }>;
  specFieldKeys: string[];
  customFields: Record<string, boolean>;
  setCustomFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onTagToggle: (tagId: number) => void;
}

const SPEC_FIELD_LABEL_MAP: Record<string, string> = {
  weight: '克重(g)', metalWeight: '金重(g)', size: '尺寸', braceletSize: '手镯圈口',
  beadCount: '珠粒数', beadDiameter: '珠径', ringSize: '戒指圈号',
};

const BRACELET_SIZES = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72];
const RING_SIZES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

function EditSpecFields({ form, onChange, tags, item, specFieldsObj, specFieldKeys, customFields, setCustomFields, onTagToggle }: EditSpecFieldsProps) {
  function renderSizeSelect(field: string, sizes: number[]) {
    const isCustom = customFields[field] || false;
    const value = (form as any)[field] || '';
    const label = SPEC_FIELD_LABEL_MAP[field] || field;
    const isRequired = specFieldsObj[field]?.required ?? false;
    const isOther = !sizes.includes(Number(value)) && value !== '';

    if (isCustom) {
      return (
        <div key={field} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              {label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <button type="button" onClick={() => setCustomFields(p => ({ ...p, [field]: false }))} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              <Pencil className="h-2.5 w-2.5" />预设选择
            </button>
          </div>
          <Input
            type="text"
            value={value}
            onChange={e => onChange(field, e.target.value)}
            className="h-9"
            placeholder={`自定义${label}`}
          />
        </div>
      );
    }

    return (
      <div key={field} className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            {label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <button type="button" onClick={() => setCustomFields(p => ({ ...p, [field]: true }))} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
            <Pencil className="h-2.5 w-2.5" />自定义
          </button>
        </div>
        <Select value={isOther ? '__other__' : value} onValueChange={v => {
          if (v === '__other__') {
            setCustomFields(p => ({ ...p, [field]: true }));
          } else {
            onChange(field, v);
          }
        }}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={`选择${label}`} />
          </SelectTrigger>
          <SelectContent>
            {sizes.map(s => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
            <SelectItem value="__other__">其他（自定义）</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  function renderSmartSpecFields() {
    if (specFieldKeys.length === 0) return null;

    return (
      <div className="grid grid-cols-2 gap-3">
        {specFieldKeys.map((field: string) => {
          const isRequired = specFieldsObj[field]?.required ?? false;
          const label = SPEC_FIELD_LABEL_MAP[field] || field;

          if (field === 'braceletSize') {
            return renderSizeSelect(field, BRACELET_SIZES);
          }
          if (field === 'ringSize') {
            return renderSizeSelect(field, RING_SIZES);
          }
          if (field === 'weight' || field === 'metalWeight') {
            return (
              <div key={field} className="space-y-1">
                <Label className="text-xs">
                  {label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={(form as any)[field] || ''}
                    onChange={e => onChange(field, e.target.value)}
                    className="h-9 pr-8"
                    placeholder={label}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">g</span>
                </div>
              </div>
            );
          }
          if (field === 'size') {
            return (
              <div key={field} className="space-y-1">
                <Label className="text-xs">
                  {label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <Input
                  type="text"
                  value={(form as any)[field] || ''}
                  onChange={e => onChange(field, e.target.value)}
                  className="h-9"
                  placeholder="例: 35×25×8 mm"
                />
              </div>
            );
          }
          if (field === 'beadCount') {
            return (
              <div key={field} className="space-y-1">
                <Label className="text-xs">
                  {label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={(form as any)[field] || ''}
                  onChange={e => onChange(field, e.target.value)}
                  className="h-9"
                  placeholder={label}
                />
              </div>
            );
          }
          if (field === 'beadDiameter') {
            return (
              <div key={field} className="space-y-1">
                <Label className="text-xs">
                  {label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.5"
                    value={(form as any)[field] || ''}
                    onChange={e => onChange(field, e.target.value)}
                    className="h-9 pr-10"
                    placeholder={label}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">mm</span>
                </div>
              </div>
            );
          }
          // Default fallback for other spec fields
          return (
            <div key={field} className="space-y-1">
              <Label className="text-xs">
                {label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              <Input
                type="text"
                value={(form as any)[field] || ''}
                onChange={e => onChange(field, e.target.value)}
                className="h-9"
                placeholder={label}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Tags - Grouped and filtered by material
  const activeTags = tags.filter((t: any) => t.isActive);
  const groups = activeTags.reduce((acc: any, tag: any) => {
    const g = tag.groupName || '未分组';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tag);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups);
  const singleGroup = groupKeys.length === 1 && groupKeys[0] === '未分组';

  return (
    <>
      {renderSmartSpecFields()}
      <div className="space-y-2">
        <Label className="text-xs">标签{item.materialName ? <span className="text-muted-foreground ml-1">— 材质：{item.materialName}</span> : ''}</Label>
        {groupKeys.length === 0 && (
          <p className="text-xs text-muted-foreground">该材质暂无可用标签，请在系统设置中为 {item.materialName || '当前材质'} 添加标签</p>
        )}
        {groupKeys.map(group => (
          <div key={group}>
            {!singleGroup && <p className="text-xs font-medium text-muted-foreground mb-1">{group}</p>}
            <div className="flex flex-wrap gap-2">
              {groups[group].map((tag: any) => (
                <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={form.tagIds.includes(tag.id)} onCheckedChange={() => onTagToggle(tag.id)} />
                  <span className="text-xs">{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default EditSpecFields;
