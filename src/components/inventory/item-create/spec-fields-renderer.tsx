'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil } from 'lucide-react';

export const SPEC_FIELD_LABEL_MAP: Record<string, string> = {
  weight: '克重(g)', metalWeight: '金重(g)', size: '尺寸', braceletSize: '手镯圈口',
  beadCount: '珠粒数', beadDiameter: '珠径', ringSize: '戒指圈号',
};

interface SpecFieldsRendererProps {
  form: Record<string, any>;
  onChange: (field: string, value: any) => void;
  specFieldsObj: Record<string, { required: boolean }>;
  specFieldKeys: string[];
  customFields: Record<string, boolean>;
  setCustomFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const BRACELET_SIZES = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72];
const RING_SIZES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

function SpecFieldsRenderer({ form, onChange, specFieldsObj, specFieldKeys, customFields, setCustomFields }: SpecFieldsRendererProps) {
  if (specFieldKeys.length === 0) return null;

  function renderSizeSelect(field: string, sizes: number[]) {
    const isCustom = customFields[field] || false;
    const value = form[field] || '';
    const label = SPEC_FIELD_LABEL_MAP[field] || field;
    const isRequired = specFieldsObj[field]?.required ?? false;

    if (isCustom) {
      return (
        <div key={field} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}</Label>
            <button type="button" onClick={() => setCustomFields(p => ({ ...p, [field]: false }))} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              <Pencil className="h-2.5 w-2.5" />预设选择
            </button>
          </div>
          <Input type="text" value={value} onChange={e => onChange(field, e.target.value)} className="h-9" placeholder={`自定义${label}`} />
        </div>
      );
    }

    return (
      <div key={field} className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}</Label>
          <button type="button" onClick={() => setCustomFields(p => ({ ...p, [field]: true }))} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
            <Pencil className="h-2.5 w-2.5" />自定义
          </button>
        </div>
        <Select value={!sizes.includes(Number(value)) && value !== '' ? '__other__' : value} onValueChange={v => {
          if (v === '__other__') setCustomFields(p => ({ ...p, [field]: true }));
          else onChange(field, v);
        }}>
          <SelectTrigger className="h-9"><SelectValue placeholder={`选择${label}`} /></SelectTrigger>
          <SelectContent>
            {sizes.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
            <SelectItem value="__other__">其他（自定义）</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {specFieldKeys.map(field => {
        const isRequired = specFieldsObj[field]?.required ?? false;
        const label = SPEC_FIELD_LABEL_MAP[field] || field;

        if (field === 'braceletSize') return renderSizeSelect(field, BRACELET_SIZES);
        if (field === 'ringSize') return renderSizeSelect(field, RING_SIZES);
        if (field === 'weight' || field === 'metalWeight') {
          return (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={form[field] || ''} onChange={e => onChange(field, e.target.value)} className="h-9 pr-8" placeholder={label} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">g</span>
              </div>
            </div>
          );
        }
        if (field === 'size') {
          return (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}</Label>
              <Input type="text" value={form[field] || ''} onChange={e => onChange(field, e.target.value)} className="h-9" placeholder="例: 35×25×8 mm" />
            </div>
          );
        }
        if (field === 'beadCount') {
          return (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}</Label>
              <Input type="number" min="1" value={form[field] || ''} onChange={e => onChange(field, e.target.value)} className="h-9" placeholder={label} />
            </div>
          );
        }
        if (field === 'beadDiameter') {
          return (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}</Label>
              <div className="relative">
                <Input type="number" step="0.5" value={form[field] || ''} onChange={e => onChange(field, e.target.value)} className="h-9 pr-10" placeholder={label} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">mm</span>
              </div>
            </div>
          );
        }
        return (
          <div key={field} className="space-y-1">
            <Label className="text-xs">{label}{isRequired && <span className="text-red-500 ml-0.5">*</span>}</Label>
            <Input type="text" value={form[field] || ''} onChange={e => onChange(field, e.target.value)} className="h-9" placeholder={label} />
          </div>
        );
      })}
    </div>
  );
}

export default SpecFieldsRenderer;
