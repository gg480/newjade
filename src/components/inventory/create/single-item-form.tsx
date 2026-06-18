'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { itemsApi, dictsApi, suppliersApi, pricingApi } from '@/lib/api';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import SpecFieldsRenderer from '@/components/inventory/item-create/spec-fields-renderer';
import { MATERIAL_CATEGORIES } from '@/lib/constants';
import { formatPrice } from '@/components/inventory/shared';
import { parseSpecFields } from '@/components/inventory/settings-tab';
import { X, ChevronLeft, ChevronRight, Check, Camera, Tag, DollarSign, ClipboardList, FileCheck, Calculator, Plus } from 'lucide-react';
import type { DictMaterial, DictType, DictTag, Supplier, PricingResult, CreateItemBody } from '@/lib/api.types';

// ========== 类型定义 ==========

/** 草稿照片 —— 来自拍照采集阶段 */
export interface PhotoDraft {
  id: string;
  file?: File;
  url: string;        // blob URL 或已上传路径
  uploaded?: boolean;  // 是否已上传
}

export interface SingleItemFormProps {
  photos: PhotoDraft[];
  defaultMaterial?: { materialId?: number; typeId?: number };
  onSubmitted: (item: Record<string, unknown>) => void;
  onSubmitAnother: () => void;
  onCancel: () => void;
}

// ========== 步骤配置 ==========

const STEPS = [
  { key: 'photos', label: '拍照', icon: Camera },
  { key: 'category', label: '品类', icon: Tag },
  { key: 'price', label: '价格', icon: DollarSign },
  { key: 'supplement', label: '补充', icon: ClipboardList },
  { key: 'confirm', label: '确认', icon: FileCheck },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

// ========== 表单数据类型 ==========

interface FormData {
  materialId: string;
  typeId: string;
  costPrice: number;
  sellingPrice: number;
  name: string;
  origin: string;
  counter: string;
  certNo: string;
  notes: string;
  supplierId: string;
  purchaseDate: string;
  weight: string;
  metalWeight: string;
  size: string;
  braceletSize: string;
  beadCount: string;
  beadDiameter: string;
  ringSize: string;
  tagIds: number[];
}

const DEFAULT_FORM: FormData = {
  materialId: '', typeId: '', costPrice: 0, sellingPrice: 0, name: '',
  origin: '', counter: '', certNo: '', notes: '', supplierId: '', purchaseDate: new Date().toISOString().slice(0, 10),
  weight: '', metalWeight: '', size: '', braceletSize: '', beadCount: '', beadDiameter: '', ringSize: '',
  tagIds: [],
};

// ========== 大号数字键盘 ==========

function LargeNumberKeypad({
  value,
  onChange,
  label,
  prefix = '¥',
  placeholder = '0.00',
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  prefix?: string;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(value > 0 ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部 value 变化（如定价建议应用时重置显示）
  useEffect(() => {
    // 仅当 value 与当前 display 不一致时重置（说明外部修改了值）
    const currentParsed = parseFloat(display);
    if (value !== currentParsed || (value === 0 && display !== '')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value > 0 ? String(value) : '');
    }
  }, [value]);

  function handleKey(k: string) {
    if (k === 'C') {
      setDisplay('');
      onChange(0);
      return;
    }
    if (k === '⌫') {
      const next = display.slice(0, -1);
      setDisplay(next);
      onChange(next ? parseFloat(next) : 0);
      return;
    }
    // . 只允许一个
    if (k === '.' && display.includes('.')) return;
    // 限制小数位不超过2位
    if (display.includes('.') && display.split('.')[1].length >= 2) return;
    // 限制总长度
    if (display.replace('.', '').length >= 10) return;

    const next = display + k;
    setDisplay(next);
    onChange(parseFloat(next) || 0);
  }

  function handleDirectInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setDisplay(raw);
    onChange(parseFloat(raw) || 0);
  }

  const keys = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['0', '.', '⌫'],
  ];

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground z-10">
          {prefix}
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleDirectInput}
          placeholder={placeholder}
          className="w-full h-16 pl-10 pr-4 text-3xl font-bold text-right bg-muted/30 rounded-xl border border-input focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map(k => (
          <Button
            key={k}
            type="button"
            variant="outline"
            className="h-14 text-xl font-bold active:scale-95 transition-transform touch-manipulation"
            onClick={() => handleKey(k)}
          >
            {k}
          </Button>
        ))}
        <Button
          type="button"
          variant="destructive"
          className="h-14 text-base font-bold"
          onClick={() => handleKey('C')}
        >
          清空
        </Button>
      </div>
    </div>
  );
}

// ========== 主组件 ==========

function SingleItemForm({ photos, defaultMaterial, onSubmitted, onSubmitAnother, onCancel }: SingleItemFormProps) {
  const { handleError } = useErrorHandler();
  const [step, setStep] = useState<StepKey>('photos');
  const [form, setForm] = useState<FormData>(() => ({
    ...DEFAULT_FORM,
    ...(defaultMaterial?.materialId ? { materialId: String(defaultMaterial.materialId) } : {}),
    ...(defaultMaterial?.typeId ? { typeId: String(defaultMaterial.typeId) } : {}),
  }));
  const [saving, setSaving] = useState(false);
  const [pricingSuggestion, setPricingSuggestion] = useState<{ suggestedPrice: number; floorPrice?: number; grossMargin?: number } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({});
  const [notesExpanded, setNotesExpanded] = useState(false);

  // 字典数据
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);
  const [tags, setTags] = useState<DictTag[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialCategory, setMaterialCategory] = useState('');
  const [materialSubType, setMaterialSubType] = useState('');

  // 已删除照片的 ID 列表（草稿删除）
  const [removedPhotoIds, setRemovedPhotoIds] = useState<Set<string>>(new Set());

  // 可见照片（排除已删除）
  const visiblePhotos = useMemo(
    () => photos.filter(p => !removedPhotoIds.has(p.id)),
    [photos, removedPhotoIds],
  );

  // 加载字典
  useEffect(() => {
    dictsApi.getMaterials().then(setMaterials).catch(() => {});
    dictsApi.getTypes().then(setTypes).catch(() => {});
    suppliersApi.getSuppliers().then((s) => {
      if (Array.isArray(s)) setSuppliers(s);
      else if (s && 'items' in s) setSuppliers((s as { items: Supplier[] }).items || []);
    }).catch(() => {});
  }, []);

  // 根据材质加载标签
  const currentMaterialId = form.materialId ? Number(form.materialId) : null;
  useEffect(() => {
    if (currentMaterialId) {
      dictsApi.getTags(undefined, false, currentMaterialId).then(setTags).catch(() => {});
    } else {
      dictsApi.getTags().then(setTags).catch(() => {});
    }
  }, [currentMaterialId]);

  // 级联筛选：大类 → 子类 → 材质
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

  // 规格字段解析
  const selectedType = useMemo(
    () => types.find(t => String(t.id) === form.typeId),
    [types, form.typeId],
  );
  const specFieldsObj = useMemo(
    () => parseSpecFields(selectedType?.specFields ?? null),
    [selectedType],
  );
  const specFieldKeys = useMemo(
    () => Object.keys(specFieldsObj),
    [specFieldsObj],
  );

  // 步骤索引
  const stepIndex = STEPS.findIndex(s => s.key === step);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  // ========== 步骤导航 ==========

  function goToStep(key: StepKey) {
    setStep(key);
  }

  function goNext() {
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1].key);
    }
  }

  function goPrev() {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1].key);
    }
  }

  // ========== 定价建议 ==========

  async function handleCalculatePrice() {
    if (!form.costPrice || !form.materialId) {
      toast.error('请先输入成本价并选择材质');
      return;
    }
    setPricingLoading(true);
    try {
      const result = await pricingApi.calculate({
        costPrice: form.costPrice,
        materialId: Number(form.materialId),
        typeId: form.typeId ? Number(form.typeId) : undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
      } as unknown as Parameters<typeof pricingApi.calculate>[0]);
      // 转换响应格式
      setPricingSuggestion({
        suggestedPrice: (result as unknown as { suggestedPrice?: number })?.suggestedPrice || (result as unknown as Record<string, number>).recommendedPrice || 0,
        floorPrice: (result as unknown as { floorPrice?: number })?.floorPrice,
        grossMargin: (result as unknown as { grossMargin?: number })?.grossMargin,
      });
    } catch (error) {
      handleError(error, { title: '定价计算失败' });
    } finally {
      setPricingLoading(false);
    }
  }

  function handleApplyPrice() {
    if (pricingSuggestion?.suggestedPrice) {
      setForm(f => ({ ...f, sellingPrice: pricingSuggestion.suggestedPrice }));
    }
  }

  // ========== 删除照片 ==========

  function handleRemovePhoto(photoId: string) {
    setRemovedPhotoIds(prev => {
      const next = new Set(prev);
      next.add(photoId);
      return next;
    });
  }

  // ========== 提交 ==========

  async function handleSubmit() {
    setSaving(true);
    try {
      // 校验必填
      if (!form.materialId) { toast.error('请选择材质'); setSaving(false); return; }
      if (!form.typeId) { toast.error('请选择器型'); setSaving(false); return; }
      if (!form.costPrice || form.costPrice <= 0) { toast.error('请输入成本价'); setSaving(false); return; }
      if (!form.sellingPrice || form.sellingPrice <= 0) { toast.error('请输入售价'); setSaving(false); return; }

      // 构建规格
      const spec: Record<string, string | number> = {};
      specFieldKeys.forEach(f => {
        const val = form[f as keyof FormData];
        if (val) spec[f] = String(val);
      });

      // 1. 创建货品
      const body: Record<string, unknown> = {
        materialId: Number(form.materialId),
        typeId: Number(form.typeId),
        costPrice: form.costPrice,
        sellingPrice: form.sellingPrice,
        name: form.name || undefined,
        origin: form.origin || undefined,
        counter: form.counter || undefined,
        certNo: form.certNo || undefined,
        notes: form.notes || undefined,
        supplierId: form.supplierId ? Number(form.supplierId) : undefined,
        purchaseDate: form.purchaseDate || undefined,
        tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
        spec: Object.keys(spec).length > 0 ? spec : undefined,
      };

      const createdItem = await itemsApi.createItem(body as unknown as CreateItemBody);

      // 2. 上传照片
      const uploadPromises = visiblePhotos
        .filter(p => p.file)
        .map(async (photo) => {
          try {
            await itemsApi.uploadImage(createdItem.id, photo.file!);
          } catch {
            // 单张照片上传失败不阻塞整体流程
            console.warn('[SingleItemForm] 照片上传失败:', photo.id);
          }
        });

      await Promise.all(uploadPromises);

      toast.success('入库成功！');
      onSubmitted(createdItem as unknown as Record<string, unknown>);
    } catch (error) {
      handleError(error, { title: '入库失败' });
    } finally {
      setSaving(false);
    }
  }

  // ========== 继续录下一件 ==========

  function handleSubmitAnother() {
    // 重置表单，保留材质和器型设置
    setForm(f => ({
      ...DEFAULT_FORM,
      materialId: f.materialId,
      typeId: f.typeId,
    }));
    setPricingSuggestion(null);
    setCustomFields({});
    setNotesExpanded(false);
    setRemovedPhotoIds(new Set());
    setStep('photos');
    // 通知父组件当前提交完成
    onSubmitAnother();
  }

  // ========== 标签切换 ==========

  function toggleTag(tagId: number) {
    setForm(f => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter(id => id !== tagId)
        : [...f.tagIds, tagId],
    }));
  }

  // 标签分组
  const activeTags = tags.filter(t => t.isActive);
  const tagGroups = useMemo(() => {
    return activeTags.reduce((acc: Record<string, DictTag[]>, tag: DictTag) => {
      const g = tag.groupName || '未分组';
      if (!acc[g]) acc[g] = [];
      acc[g].push(tag);
      return acc;
    }, {});
  }, [activeTags]);
  const tagGroupKeys = Object.keys(tagGroups);

  // ========== Step 渲染 ==========

  function renderStepPhotos() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          已拍摄 {visiblePhotos.length} 张照片
        </p>
        {visiblePhotos.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>暂无照片</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {visiblePhotos.map(photo => (
              <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                <img
                  src={photo.url}
                  alt="草稿照片"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(photo.id)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderStepCategory() {
    const mat = materials.find(m => m.id === currentMaterialId);
    return (
      <div className="space-y-4">
        {/* 材质三级级联 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">大类</Label>
            <Select value={materialCategory || '_all'} onValueChange={v => {
              setMaterialCategory(v === '_all' ? '' : v);
              setMaterialSubType('');
              setForm(f => ({ ...f, materialId: '' }));
            }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="大类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部</SelectItem>
                {MATERIAL_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">子类</Label>
            <Select
              value={materialSubType || '_all'}
              onValueChange={v => {
                setMaterialSubType(v === '_all' ? '' : v);
                setForm(f => ({ ...f, materialId: '' }));
              }}
              disabled={!materialCategory}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={materialCategory ? '子类' : '先选大类'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部</SelectItem>
                {subTypes.map(st => (
                  <SelectItem key={st} value={st}>{st}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">材质 <span className="text-red-500">*</span></Label>
            <Select value={form.materialId} onValueChange={v => setForm(f => ({ ...f, materialId: v }))}>
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

        {/* 器型 */}
        <div className="space-y-1">
          <Label className="text-xs">器型 <span className="text-red-500">*</span></Label>
          <Select value={form.typeId} onValueChange={v => {
            setForm(f => ({ ...f, typeId: v }));
            // 切换器型时重置规格字段
            setCustomFields({});
          }}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="选择器型" />
            </SelectTrigger>
            <SelectContent>
              {types.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 名称 */}
        <div className="space-y-1">
          <Label className="text-xs">名称</Label>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={selectedType ? `例: ${selectedType.name}` : '输入货品名称'}
            className="h-9"
          />
          <p className="text-[10px] text-muted-foreground">
            {mat?.name && selectedType?.name
              ? `建议: ${mat.name}${selectedType.name}`
              : '留空则系统自动生成'}
          </p>
        </div>
      </div>
    );
  }

  function renderStepPrice() {
    return (
      <div className="space-y-5">
        <LargeNumberKeypad
          value={form.costPrice}
          onChange={v => setForm(f => ({ ...f, costPrice: v }))}
          label="成本价"
          prefix="¥"
          placeholder="输入成本价"
        />

        <Separator />

        <LargeNumberKeypad
          value={form.sellingPrice}
          onChange={v => setForm(f => ({ ...f, sellingPrice: v }))}
          label="售价"
          prefix="¥"
          placeholder="输入售价"
        />

        {/* 定价建议 */}
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pricingLoading || !form.costPrice || !form.materialId}
            onClick={handleCalculatePrice}
          >
            <Calculator className="h-3.5 w-3.5 mr-1" />
            {pricingLoading ? '计算中...' : '定价建议'}
          </Button>
          {pricingSuggestion && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">建议售价</span>
                <span className="font-bold text-emerald-600">
                  {formatPrice(pricingSuggestion.suggestedPrice)}
                </span>
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
                  <span className={`font-medium ${pricingSuggestion.grossMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {pricingSuggestion.grossMargin >= 0 ? '+' : ''}{(pricingSuggestion.grossMargin * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full mt-1"
                onClick={handleApplyPrice}
              >
                应用建议售价
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderStepSupplement() {
    const mat = materials.find(m => m.id === currentMaterialId);
    return (
      <div className="space-y-4">
        {/* 规格字段（动态，根据器型配置） */}
        {specFieldKeys.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">规格参数</Label>
            <SpecFieldsRenderer
              form={form as unknown as Record<string, string | number | number[]>}
              onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
              specFieldsObj={specFieldsObj}
              specFieldKeys={specFieldKeys}
              customFields={customFields}
              setCustomFields={setCustomFields}
            />
          </div>
        )}

        {/* 其他字段 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">产地</Label>
            <Input
              value={form.origin}
              onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
              className="h-9"
              placeholder="可选"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">柜台号</Label>
            <Input
              value={form.counter}
              onChange={e => setForm(f => ({ ...f, counter: e.target.value }))}
              className="h-9"
              placeholder="例: A-01"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">证书号</Label>
            <Input
              value={form.certNo}
              onChange={e => setForm(f => ({ ...f, certNo: e.target.value }))}
              className="h-9"
              placeholder="可选"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">供应商</Label>
            <Select value={form.supplierId} onValueChange={v => setForm(f => ({ ...f, supplierId: v }))}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择" />
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
        </div>

        <div className="space-y-1">
          <Label className="text-xs">采购日期</Label>
          <Input
            type="date"
            value={form.purchaseDate}
            onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
            className="h-9"
          />
        </div>

        {/* 标签（Checkbox 网格） */}
        {tagGroupKeys.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              标签{mat?.name ? <span className="text-muted-foreground ml-1">— {mat.name}</span> : ''}
            </Label>
            {tagGroupKeys.map(group => (
              <div key={group}>
                {tagGroupKeys.length > 1 && (
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">{group}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {tagGroups[group].map((tag: DictTag) => (
                    <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
                      <Checkbox
                        checked={form.tagIds.includes(tag.id)}
                        onCheckedChange={() => toggleTag(tag.id)}
                      />
                      <span className="text-xs">{tag.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 备注（默认折叠） */}
        <div className="space-y-1">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setNotesExpanded(!notesExpanded)}
          >
            <ClipboardList className="h-3 w-3" />
            {notesExpanded ? '收起备注' : '添加备注'}
          </button>
          {notesExpanded && (
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="输入备注信息..."
              className="h-20 text-sm"
            />
          )}
        </div>
      </div>
    );
  }

  function renderStepConfirm() {
    const mat = materials.find(m => m.id === currentMaterialId);
    const selType = types.find(t => String(t.id) === form.typeId);
    const selSupplier = suppliers.find(s => String(s.id) === form.supplierId);

    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">请确认以下信息：</p>

        <div className="space-y-2 bg-muted/20 rounded-lg p-4">
          {/* 照片摘要 */}
          <div className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">照片:</span>
            <span>{visiblePhotos.length} 张</span>
          </div>

          <Separator />

          {/* 品类 */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">材质:</span>
              <span className="ml-1 font-medium">{mat?.name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">器型:</span>
              <span className="ml-1 font-medium">{selType?.name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">名称:</span>
              <span className="ml-1 font-medium">{form.name || '(自动生成)'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">产地:</span>
              <span className="ml-1">{form.origin || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">柜台:</span>
              <span className="ml-1">{form.counter || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">证书:</span>
              <span className="ml-1">{form.certNo || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">供应商:</span>
              <span className="ml-1">{selSupplier?.name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">采购日期:</span>
              <span className="ml-1">{form.purchaseDate || '-'}</span>
            </div>
          </div>

          <Separator />

          {/* 价格 */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">成本价:</span>
              <span className="ml-1 font-medium">{formatPrice(form.costPrice)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">售价:</span>
              <span className="ml-1 font-bold text-emerald-600">{formatPrice(form.sellingPrice)}</span>
            </div>
          </div>

          {form.costPrice > 0 && form.sellingPrice > 0 && (
            <div className="text-xs text-muted-foreground">
              毛利: {formatPrice(form.sellingPrice - form.costPrice)}
              （
              {form.costPrice > 0
                ? (((form.sellingPrice - form.costPrice) / form.costPrice) * 100).toFixed(1)
                : '0'}
              %）
            </div>
          )}

          {/* 规格 */}
          {specFieldKeys.length > 0 && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-1 text-sm">
                {specFieldKeys.map(f => {
                  const val = form[f as keyof FormData];
                  if (!val) return null;
                  const label = ({
                    weight: '克重', metalWeight: '金重', size: '尺寸',
                    braceletSize: '圈口', beadCount: '珠粒数', beadDiameter: '珠径', ringSize: '圈号',
                  } as Record<string, string>)[f] || f;
                  return (
                    <div key={f}>
                      <span className="text-muted-foreground">{label}:</span>
                      <span className="ml-1">{String(val)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 标签 */}
          {form.tagIds.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-1">
                {form.tagIds.map(tid => {
                  const tag = tags.find(t => t.id === tid);
                  return tag ? (
                    <span key={tid} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-[11px]">
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            </>
          )}

          {/* 备注 */}
          {form.notes && (
            <>
              <Separator />
              <div className="text-sm">
                <span className="text-muted-foreground">备注:</span>
                <span className="ml-1">{form.notes}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ========== 当前步骤内容 ==========

  const stepContent: Record<StepKey, React.ReactNode> = {
    photos: renderStepPhotos(),
    category: renderStepCategory(),
    price: renderStepPrice(),
    supplement: renderStepSupplement(),
    confirm: renderStepConfirm(),
  };

  // ========== 校验当前步骤是否可以继续 ==========

  function canGoNext(): boolean {
    switch (step) {
      case 'photos':
        return true; // 照片非强制
      case 'category':
        return !!form.materialId && !!form.typeId;
      case 'price':
        return form.costPrice > 0 && form.sellingPrice > 0;
      case 'supplement':
        return true;
      case 'confirm':
        return true;
      default:
        return true;
    }
  }

  function getStepError(): string | null {
    switch (step) {
      case 'category':
        if (!form.materialId) return '请选择材质';
        if (!form.typeId) return '请选择器型';
        return null;
      case 'price':
        if (!form.costPrice || form.costPrice <= 0) return '请输入成本价';
        if (!form.sellingPrice || form.sellingPrice <= 0) return '请输入售价';
        return null;
      default:
        return null;
    }
  }

  const stepError = getStepError();

  // ========== 渲染 ==========

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-between px-1 pt-4 pb-3 flex-shrink-0">
        {STEPS.map((s, i) => {
          const isActive = step === s.key;
          const isCompleted = stepIndex > i;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                // 可以回退到任意已访问的步骤
                if (i <= stepIndex) goToStep(s.key);
              }}
              disabled={i > stepIndex}
              className={`flex flex-col items-center gap-1 min-w-0 flex-1 ${
                i > stepIndex ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 ring-offset-2'
                    : isCompleted
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={`text-[10px] leading-tight text-center ${
                isActive ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <Separator className="flex-shrink-0" />

      {/* 步骤内容 */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4 min-h-0">
        {stepError && (
          <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            {stepError}
          </div>
        )}
        {stepContent[step]}
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center gap-3 px-1 pt-3 pb-4 border-t flex-shrink-0">
        {step === 'photos' ? (
          <Button
            type="button"
            variant="ghost"
            className="h-10 text-sm"
            onClick={onCancel}
          >
            取消
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 text-sm"
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一步
          </Button>
        )}

        <div className="flex-1" />

        {step === 'confirm' ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 text-sm"
              disabled={saving}
              onClick={handleSubmitAnother}
            >
              <Plus className="h-4 w-4 mr-1" />
              继续录下一件
            </Button>
            <Button
              type="button"
              className="h-10 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  处理中...
                </span>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  确认入库
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="h-10 text-sm"
            disabled={!canGoNext()}
            onClick={goNext}
          >
            {step === 'category' || step === 'price' || step === 'supplement' ? '下一步' : '下一步'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ========== 扩展导出（集成到工厂模式时使用） ==========
export { SingleItemForm };
export default SingleItemForm;
