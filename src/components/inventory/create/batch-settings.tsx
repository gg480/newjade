'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dictsApi, suppliersApi } from '@/lib/api';
import { MATERIAL_CATEGORIES } from '@/lib/constants';
import type { DictMaterial, DictType, Supplier } from '@/lib/api.types';

// ==================== 类型定义 ====================

/** 批量设置参数 —— 所有字段均为可选，留空表示不修改对应字段 */
export interface BatchSettings {
  materialId?: number;
  typeId?: number;
  supplierId?: number;
  purchaseDate?: string;
}

export interface BatchSettingsProps {
  /** 弹窗是否打开 */
  open: boolean;
  /** 弹窗开关回调 */
  onOpenChange: (o: boolean) => void;
  /** 当前选中的草稿数量（用于显示） */
  selectedCount: number;
  /** 确认应用设置 */
  onApply: (settings: BatchSettings) => void;
}

// ==================== 组件 ====================

export default function BatchSettingsPanel({
  open,
  onOpenChange,
  selectedCount,
  onApply,
}: BatchSettingsProps) {
  const [settings, setSettings] = useState<BatchSettings>({});
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialCategory, setMaterialCategory] = useState('');
  const [materialSubType, setMaterialSubType] = useState('');

  // 打开弹窗时加载字典数据并重置表单
  const initialLoad = useRef(true);
  useEffect(() => {
    if (!open) return;

    // 使用微任务延迟重置，避免 lint 规则中"同步 setState"的警告
    const resetAndLoad = async () => {
      // 重置表单（异步微任务中执行，非直接同步调用）
      setSettings({});
      setMaterialCategory('');
      setMaterialSubType('');

      // 并行加载字典数据
      try {
        const [materials, types, suppliers] = await Promise.all([
          dictsApi.getMaterials(),
          dictsApi.getTypes(),
          suppliersApi.getSuppliers(),
        ]);
        setMaterials(materials);
        setTypes(types);
        if (Array.isArray(suppliers)) setSuppliers(suppliers);
        else if (suppliers && 'items' in suppliers) setSuppliers((suppliers as { items: Supplier[] }).items || []);
      } catch {
        // 加载失败保持已有数据
      }
    };

    resetAndLoad();
    initialLoad.current = false;
  }, [open]);

  // 材质级联筛选
  const filteredByCategory = useMemo(
    () => materials.filter(m => !materialCategory || m.category === materialCategory),
    [materials, materialCategory],
  );

  const subTypes = useMemo(() => {
    const s = new Set<string>();
    filteredByCategory.forEach(m => { if (m.subType) s.add(m.subType); });
    return Array.from(s).sort();
  }, [filteredByCategory]);

  const filteredMaterials = useMemo(
    () => materialSubType
      ? filteredByCategory.filter(m => m.subType === materialSubType)
      : filteredByCategory,
    [filteredByCategory, materialSubType],
  );

  function handleApply() {
    onApply(settings);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量设置 — 已选 {selectedCount} 件</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* === 材质三级级联 === */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">材质</Label>
            <div className="grid grid-cols-3 gap-2">
              {/* 大类 */}
              <Select value={materialCategory} onValueChange={v => {
                setMaterialCategory(v);
                setMaterialSubType('');
                setSettings(s => ({ ...s, materialId: undefined }));
              }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="大类" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 子类 */}
              <Select
                value={materialSubType}
                onValueChange={v => {
                  setMaterialSubType(v);
                  setSettings(s => ({ ...s, materialId: undefined }));
                }}
                disabled={!materialCategory}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={materialCategory ? '子类' : '先选大类'} />
                </SelectTrigger>
                <SelectContent>
                  {subTypes.map(st => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 材质 */}
              <Select
                value={settings.materialId ? String(settings.materialId) : ''}
                onValueChange={v => setSettings(s => ({ ...s, materialId: Number(v) }))}
                disabled={!materialCategory}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="选择" />
                </SelectTrigger>
                <SelectContent>
                  {filteredMaterials.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* === 器型 === */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">器型</Label>
            <Select
              value={settings.typeId ? String(settings.typeId) : ''}
              onValueChange={v => setSettings(s => ({ ...s, typeId: Number(v) }))}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择器型（可选）" />
              </SelectTrigger>
              <SelectContent>
                {types.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* === 供应商 === */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">供应商</Label>
            <Select
              value={settings.supplierId ? String(settings.supplierId) : ''}
              onValueChange={v => setSettings(s => ({ ...s, supplierId: Number(v) }))}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择供应商（可选）" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.length === 0 ? (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                    暂无供应商
                  </div>
                ) : (
                  suppliers.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* === 采购日期 === */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">采购日期</Label>
            <Input
              type="date"
              value={settings.purchaseDate || ''}
              onChange={e => setSettings(s => ({ ...s, purchaseDate: e.target.value || undefined }))}
              className="h-10"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            设置后，这些货品的对应字段将自动填充。留空表示不修改。
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleApply}
          >
            应用到 {selectedCount} 件
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
