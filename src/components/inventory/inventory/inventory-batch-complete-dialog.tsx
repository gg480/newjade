'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { itemsApi, dictsApi, itemsApiEnhanced } from '@/lib/api';
import type { DictMaterial, DictType, DictTag, ItemSummary } from '@/lib/api.types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, AlertCircle, Gem, Tags, MapPin, DollarSign, Type, Hash, Ruler } from 'lucide-react';
import { MATERIAL_CATEGORIES } from '@/lib/constants';

// ========== 类型定义 ==========

interface ItemBrief {
  id: number;
  skuCode: string;
  name: string | null;
  materialName: string;
  typeName: string | null;
  tagNames: string[];
}

interface BatchCompleteDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
  selectedItemIds: number[];
}

// 常见产地选项
const COMMON_ORIGINS = [
  '缅甸', '新疆', '云南', '河南', '辽宁', '湖北', '四川', '广东',
  '浙江', '福建', '巴西', '哥伦比亚', '斯里兰卡', '俄罗斯',
];

export default function InventoryBatchCompleteDialog({
  open,
  onOpenChange,
  onSuccess,
  selectedItemIds,
}: BatchCompleteDialogProps) {
  const [items, setItems] = useState<ItemBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // 字典数据
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);
  const [tags, setTags] = useState<DictTag[]>([]);

  // 补全表单
  const [materialCategory, setMaterialCategory] = useState('');
  const [materialSubType, setMaterialSubType] = useState('');
  const [form, setForm] = useState({
    materialId: '',
    typeId: '',
    name: '',
    tagIds: [] as number[],
    counter: '',
    floorPrice: '',
    origin: '',
    weight: '',
  });

  // ========== 加载字典 ==========
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      dictsApi.getMaterials(),
      dictsApi.getTypes(),
      dictsApi.getTags(),
    ])
      .then(([mats, typs, tgs]) => {
        setMaterials(mats);
        setTypes(typs);
        setTags(tgs);
      })
      .catch(() => toast.error('加载字典数据失败'))
      .finally(() => setLoading(false));
  }, [open]);

  // ========== 加载选中货品 ==========
  useEffect(() => {
    if (!open || selectedItemIds.length === 0) return;
    Promise.all(selectedItemIds.map(id => itemsApi.getItem(id)))
      .then(results => {
        setItems(
          results.map(r => ({
            id: r.id,
            skuCode: r.skuCode,
            name: r.name,
            materialName: r.materialName || '',
            typeName: r.typeName || '',
            tagNames: ((r as ItemSummary).tags || []).map((t: DictTag) => t.name),
          }))
        );
      })
      .catch(() => toast.error('加载货品列表失败'));
  }, [open, selectedItemIds]);

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

  // 当前选中的材质 ID
  const currentMaterialId = form.materialId ? Number(form.materialId) : null;

  // 标签按 group 分组（无材质关联时展示全部标签）
  const tagGroups = useMemo(() => {
    const groups: Record<string, DictTag[]> = {};
    const source = currentMaterialId
      ? tags.filter(t => t.isGlobal)
      : tags;
    for (const tag of source) {
      const group = tag.groupName || '其他';
      if (!groups[group]) groups[group] = [];
      groups[group].push(tag);
    }
    return groups;
  }, [tags, currentMaterialId]);

  // ========== 统计 ==========
  const withTagsCount = items.filter(i => i.tagNames.length > 0).length;
  const withTypeCount = items.filter(i => i.typeName).length;

  // ========== 标签切换 ==========
  function toggleTag(tagId: number) {
    setForm(f => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter(id => id !== tagId)
        : [...f.tagIds, tagId],
    }));
  }

  // ========== 提交 ==========
  async function handleSave() {
    if (selectedItemIds.length === 0) return;

    const body: {
      ids: number[];
      materialId?: number;
      typeId?: number;
      name?: string;
      tagIds?: number[];
      counter?: number;
      floorPrice?: number;
      origin?: string;
      weight?: number;
    } = { ids: selectedItemIds };

    if (form.materialId) body.materialId = Number(form.materialId);
    if (form.typeId) body.typeId = Number(form.typeId);
    if (form.name.trim()) body.name = form.name.trim();
    if (form.tagIds.length > 0) body.tagIds = form.tagIds;
    if (form.counter) body.counter = Number(form.counter);
    if (form.floorPrice) body.floorPrice = Number(form.floorPrice);
    if (form.origin) body.origin = form.origin;
    if (form.weight) body.weight = Number(form.weight);

    // 检查是否有要更新的字段
    const fieldCount = Object.keys(body).length - 1; // 排除 ids
    if (fieldCount === 0) {
      toast.error('请至少设置一个补全字段');
      return;
    }

    setSaving(true);
    setProgress({ current: 0, total: 1 });
    try {
      const result = await itemsApiEnhanced.batchComplete(body);
      toast.success(
        `补全完成: 成功 ${result.success} 件${result.failed > 0 ? `，失败 ${result.failed} 件` : ''}`
      );
      handleClose();
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '批量补全失败');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  function handleClose() {
    setForm({
      materialId: '',
      typeId: '',
      name: '',
      tagIds: [],
      counter: '',
      floorPrice: '',
      origin: '',
      weight: '',
    });
    setMaterialCategory('');
    setMaterialSubType('');
    onOpenChange(false);
  }

  // ========== 渲染 ==========
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gem className="h-5 w-5 text-emerald-600" />
            批量补全货品信息
            <Badge variant="secondary" className="ml-2">
              {selectedItemIds.length} 件
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* ===== 左区：选中货品列表 ===== */}
          <div className="border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
              已选货品
              <span className="ml-2 text-emerald-600">
                (缺标签 {items.length - withTagsCount}件 / 缺器型{' '}
                {items.filter(i => !i.typeName).length}件)
              </span>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="px-3 py-2 text-xs space-y-0.5 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.skuCode}
                      </span>
                      <span className="font-medium truncate">
                        {item.name || '(无名称)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{item.materialName}</span>
                      {item.typeName && <span>| {item.typeName}</span>}
                      <span className="flex-1" />
                      {item.tagNames.length === 0 ? (
                        <span className="text-amber-500">缺标签</span>
                      ) : (
                        <span className="text-emerald-500">
                          {item.tagNames.length}标签
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* ===== 右区：补全表单 ===== */}
          <div className="space-y-4">
            {/* P0 区：材质、器型、柜台 */}
            <div className="space-y-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                优先补全
              </h4>

              {/* 材质（三级级联：大类 → 子类 → 材质） */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Gem className="h-3 w-3" />
                  材质
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Select
                    value={materialCategory}
                    onValueChange={v => {
                      setMaterialCategory(v);
                      setMaterialSubType('');
                      setForm(f => ({ ...f, materialId: '' }));
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
                      onValueChange={setMaterialSubType}
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
                    onValueChange={v =>
                      setForm(f => ({ ...f, materialId: v }))
                    }
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
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Type className="h-3 w-3" />
                  器型
                </Label>
                <Select
                  value={form.typeId}
                  onValueChange={v =>
                    setForm(f => ({ ...f, typeId: v }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="选择器型" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 柜台 */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  柜台号
                </Label>
                <Input
                  type="number"
                  placeholder="如: 1"
                  value={form.counter}
                  onChange={e =>
                    setForm(f => ({ ...f, counter: e.target.value }))
                  }
                  className="h-8 text-xs"
                  min="0"
                />
              </div>
            </div>

            {/* P1 区：名称、产地、底价、重量 */}
            <div className="space-y-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/50">
              <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" />
                扩展补全
              </h4>

              {/* 名称 */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Tags className="h-3 w-3" />
                  名称
                </Label>
                <Input
                  placeholder="货品名称（所有选中货品共用）"
                  value={form.name}
                  onChange={e =>
                    setForm(f => ({ ...f, name: e.target.value }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              {/* 产地（下拉 + 自由输入） */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  产地
                </Label>
                <div className="flex gap-1.5">
                  <Select
                    value={form.origin}
                    onValueChange={v =>
                      setForm(f => ({ ...f, origin: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="选择或输入产地" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_ORIGINS.map(o => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="自定义"
                    value={form.origin}
                    onChange={e =>
                      setForm(f => ({ ...f, origin: e.target.value }))
                    }
                    className="h-8 text-xs w-24"
                  />
                </div>
              </div>

              {/* 底价 + 重量 并排 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    底价
                  </Label>
                  <Input
                    type="number"
                    placeholder="¥"
                    value={form.floorPrice}
                    onChange={e =>
                      setForm(f => ({ ...f, floorPrice: e.target.value }))
                    }
                    className="h-8 text-xs"
                    min="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Ruler className="h-3 w-3" />
                    重量(g)
                  </Label>
                  <Input
                    type="number"
                    placeholder="克"
                    value={form.weight}
                    onChange={e =>
                      setForm(f => ({ ...f, weight: e.target.value }))
                    }
                    className="h-8 text-xs"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* 标签选择区 */}
            <div className="space-y-2 p-3 border rounded-lg">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Tags className="h-3 w-3" />
                标签（已选 {form.tagIds.length} 个）
              </Label>
              <ScrollArea className="h-[140px]">
                {Object.keys(tagGroups).length > 0 ? (
                  <div className="space-y-1.5">
                    {Object.entries(tagGroups).map(([group, groupTags]) => (
                      <div key={group}>
                        <div className="text-[10px] text-muted-foreground mb-1 font-medium">
                          {group}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {groupTags
                            .filter(t => t.isActive)
                            .map(tag => {
                              const isSelected = form.tagIds.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => toggleTag(tag.id)}
                                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                                    isSelected
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
                                      : 'bg-background text-muted-foreground border-border hover:border-emerald-200 hover:text-emerald-600'
                                  }`}
                                >
                                  {tag.name}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    请先选择材质以筛选可用标签
                  </p>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          {progress && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              处理中... {progress.current}/{progress.total}
            </span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={saving || selectedItemIds.length === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  补全中...
                </>
              ) : (
                `补全 ${selectedItemIds.length} 件`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
