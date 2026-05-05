'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditBasicFieldsProps {
  form: {
    name: string; sellingPrice: number; floorPrice: number; counter: string; certNo: string; notes: string; origin: string;
    tagIds: number[];
    weight: string; metalWeight: string; size: string; braceletSize: string; beadCount: string; beadDiameter: string; ringSize: string;
  };
  onChange: (field: string, value: any) => void;
  isFieldChanged: (field: string) => boolean;
}

function EditBasicFields({ form, onChange, isFieldChanged }: EditBasicFieldsProps) {
  return (
    <>
      <div className={`space-y-1 rounded-md ${isFieldChanged('name') ? 'bg-amber-50 dark:bg-amber-950/20 p-1.5 -m-1.5' : ''}`}>
        <Label className="text-xs">名称{isFieldChanged('name') && <span className="text-amber-500 ml-1">●</span>}</Label>
        <Input value={form.name} onChange={e => onChange('name', e.target.value)} className="h-9" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={`space-y-1 rounded-md ${isFieldChanged('sellingPrice') ? 'bg-amber-50 dark:bg-amber-950/20 p-1.5 -m-1.5' : ''}`}>
          <Label className="text-xs">售价{isFieldChanged('sellingPrice') && <span className="text-amber-500 ml-1">●</span>}</Label>
          <Input type="number" value={form.sellingPrice || ''} onChange={e => onChange('sellingPrice', parseFloat(e.target.value) || 0)} className="h-9" />
        </div>
        <div className={`space-y-1 rounded-md ${isFieldChanged('floorPrice') ? 'bg-amber-50 dark:bg-amber-950/20 p-1.5 -m-1.5' : ''}`}>
          <Label className="text-xs">底价{isFieldChanged('floorPrice') && <span className="text-amber-500 ml-1">●</span>}</Label>
          <Input type="number" value={form.floorPrice || ''} onChange={e => onChange('floorPrice', parseFloat(e.target.value) || 0)} className="h-9" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={`space-y-1 rounded-md ${isFieldChanged('origin') ? 'bg-amber-50 dark:bg-amber-950/20 p-1.5 -m-1.5' : ''}`}>
          <Label className="text-xs">产地{isFieldChanged('origin') && <span className="text-amber-500 ml-1">●</span>}</Label>
          <Input value={form.origin} onChange={e => onChange('origin', e.target.value)} className="h-9" />
        </div>
        <div className={`space-y-1 rounded-md ${isFieldChanged('counter') ? 'bg-amber-50 dark:bg-amber-950/20 p-1.5 -m-1.5' : ''}`}>
          <Label className="text-xs">柜台号 <span className="text-red-500">*</span>{isFieldChanged('counter') && <span className="text-amber-500 ml-1">●</span>}</Label>
          <Input value={form.counter} onChange={e => onChange('counter', e.target.value)} className="h-9" />
        </div>
      </div>
      <div className={`space-y-1 rounded-md ${isFieldChanged('certNo') ? 'bg-amber-50 dark:bg-amber-950/20 p-1.5 -m-1.5' : ''}`}>
        <Label className="text-xs">证书号{isFieldChanged('certNo') && <span className="text-amber-500 ml-1">●</span>}</Label>
        <Input value={form.certNo} onChange={e => onChange('certNo', e.target.value)} className="h-9" />
      </div>
      <div className={`space-y-1 rounded-md ${isFieldChanged('notes') ? 'bg-amber-50 dark:bg-amber-950/20 p-1.5 -m-1.5' : ''}`}>
        <Label className="text-xs">备注{isFieldChanged('notes') && <span className="text-amber-500 ml-1">●</span>}</Label>
        <Textarea value={form.notes} onChange={e => onChange('notes', e.target.value)} placeholder="可选" className="h-16" />
      </div>
    </>
  );
}

export default EditBasicFields;
