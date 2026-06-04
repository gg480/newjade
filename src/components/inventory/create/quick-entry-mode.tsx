'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { batchesApi, dictsApi, itemsApi, suppliersApi, imagesApi, pricingApi } from '@/lib/api';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { MATERIAL_CATEGORIES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import SupplierQuickAddDialog from '@/components/inventory/supplier-quick-add-dialog';
import PhotoPhase, { PhotoDraft } from './photo-phase';
import type { DictMaterial, DictType, Supplier, Batch } from '@/lib/api.types';

// ==================== 类型定义 ====================

export interface QuickEntrySession {
  batchId: number;
  batchCode: string;
  materialName: string;
  typeName: string;
  unitCost: number;
  totalQuantity: number;
  completedCount: number;
  status: 'draft' | 'active';
  /** 本次录入的图片草稿（用于断点续录时恢复） */
  pendingPhotos?: PhotoDraft[];
  /** 当前正在编辑的售价 */
  pendingSellingPrice?: number;
  /** 当前正在编辑的重量 */
  pendingWeight?: string;
}

export interface QuickEntryModeProps {
  onComplete: () => void;
  onExit: () => void;
}

interface BatchFormData {
  materialId: string;
  typeId: string;
  quantity: number;
  totalCost: number;
  supplierId: string;
  purchaseDate: string;
  notes: string;
}

const DEFAULT_BATCH_FORM: BatchFormData = {
  materialId: '',
  typeId: '',
  quantity: 1,
  totalCost: 0,
  supplierId: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  notes: '',
};

const SESSION_KEY = 'quick_entry_session';

// ==================== 辅助函数 ====================

/** 将 Session 持久化到 localStorage */
function saveSession(session: QuickEntrySession | null) {
  if (session === null) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  try {
    const serialized = JSON.stringify(session, (_key, value) => {
      // 过滤 File 对象（照片文件不可序列化，但断点续录时无需恢复 File）
      if (value instanceof File) return undefined;
      // 过滤 blob URL
      if (typeof value === 'string' && value.startsWith('blob:')) return undefined;
      return value;
    });
    localStorage.setItem(SESSION_KEY, serialized);
  } catch {
    // localStorage 满时静默失败
    console.warn('[QuickEntry] localStorage write failed');
  }
}

/** 从 localStorage 恢复 Session */
function loadSession(): QuickEntrySession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as QuickEntrySession;
    if (session.status === 'draft' || session.status === 'active') {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

/** 格式化价格展示（带¥前缀） */
function formatPrice(v: number | null | undefined): string {
  if (v == null) return '¥0.00';
  return `¥${v.toFixed(2)}`;
}

/** 进度条文本 */
function buildProgressBar(completed: number, total: number, length = 10): string {
  const filled = Math.round((completed / total) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ==================== 主组件 ====================

export default function QuickEntryMode({ onComplete, onExit }: QuickEntryModeProps) {
  const { handleError } = useErrorHandler();

  // ---------- 模式状态 ----------
  const [mode, setMode] = useState<'create_batch' | 'entering'>('create_batch');
  const [session, setSession] = useState<QuickEntrySession | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  // ---------- 批次创建表单 ----------
  const [batchForm, setBatchForm] = useState<BatchFormData>({ ...DEFAULT_BATCH_FORM });
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialCategory, setMaterialCategory] = useState('');
  const [materialSubType, setMaterialSubType] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [showSupplierAdd, setShowSupplierAdd] = useState(false);

  // ---------- 连续录入 ----------
  const [showPhotoPhase, setShowPhotoPhase] = useState(false);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [weight, setWeight] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [completedItems, setCompletedItems] = useState(0);

  // 定价建议
  const [pricingSuggestion, setPricingSuggestion] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // ---------- 加载字典 ----------
  useEffect(() => {
    dictsApi.getMaterials().then(setMaterials).catch(() => {});
    dictsApi.getTypes().then(setTypes).catch(() => {});
    suppliersApi.getSuppliers().then(s => {
      if (Array.isArray(s)) setSuppliers(s);
      else if (s && 'items' in s) setSuppliers((s as { items: Supplier[] }).items || []);
    }).catch(() => {});
  }, []);

  // 材质相关器型筛选
  const currentMaterialId = batchForm.materialId ? Number(batchForm.materialId) : null;

  // ---------- 级联筛选 ----------
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

  // 单价自动计算
  const unitCost = useMemo(() => {
    if (batchForm.quantity > 0 && batchForm.totalCost > 0) {
      return batchForm.totalCost / batchForm.quantity;
    }
    return 0;
  }, [batchForm.quantity, batchForm.totalCost]);

  const selectedMaterial = useMemo(
    () => materials.find(m => m.id === currentMaterialId),
    [materials, currentMaterialId],
  );

  const selectedType = useMemo(
    () => types.find(t => String(t.id) === batchForm.typeId),
    [types, batchForm.typeId],
  );

  // ---------- 断点续录检测 ----------
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.status === 'draft' && saved.completedCount < saved.totalQuantity) {
      setShowResumeDialog(true);
    }
  }, []);

  // ---------- 会话管理 ----------
  const currentSession: QuickEntrySession | null = session;
  const isComplete = useMemo(() => {
    if (!currentSession) return false;
    return currentSession.completedCount >= currentSession.totalQuantity;
  }, [currentSession]);

  // ---------- 创建批次 ----------
  async function handleCreateBatch() {
    // 校验
    if (!batchForm.materialId) { toast.error('请选择材质'); return; }
    if (!batchForm.typeId) { toast.error('请选择器型'); return; }
    if (batchForm.quantity < 1) { toast.error('数量至少为 1'); return; }
    if (batchForm.totalCost <= 0) { toast.error('请输入总成本'); return; }

    setCreatingBatch(true);
    try {
      const newBatch = await batchesApi.createBatch({
        materialId: Number(batchForm.materialId),
        typeId: Number(batchForm.typeId),
        quantity: batchForm.quantity,
        totalCost: batchForm.totalCost,
        costAllocMethod: 'equal',
        supplierId: batchForm.supplierId ? Number(batchForm.supplierId) : undefined,
        purchaseDate: batchForm.purchaseDate || undefined,
        notes: batchForm.notes || undefined,
      });

      const newSession: QuickEntrySession = {
        batchId: newBatch.id,
        batchCode: newBatch.batchCode,
        materialName: selectedMaterial?.name || '',
        typeName: selectedType?.name || '',
        unitCost,
        totalQuantity: batchForm.quantity,
        completedCount: 0,
        status: 'active',
      };

      setSession(newSession);
      saveSession(newSession);
      setCompletedItems(0);
      setMode('entering');
      toast.success(`批次 ${newBatch.batchCode} 创建成功，开始录入`);
    } catch (error) {
      handleError(error, { title: '创建批次失败' });
    } finally {
      setCreatingBatch(false);
    }
  }

  // ---------- 连续录入操作 ----------

  /** 重置当前录入项状态（拍照+售价+重量） */
  function resetItemForm() {
    setPhotos([]);
    setSellingPrice(0);
    setWeight('');
    setPricingSuggestion(null);
  }

  /** 打开拍照界面 */
  function openPhotoPhase() {
    setShowPhotoPhase(true);
  }

  /** 拍照完成回调 */
  function handlePhotosComplete(newPhotos: PhotoDraft[]) {
    setPhotos(newPhotos);
    setShowPhotoPhase(false);

    // 有照片后自动计算定价建议
    if (currentSession && newPhotos.length > 0) {
      const mat = materials.find(m => m.name === currentSession.materialName);
      if (mat && currentSession.unitCost > 0) {
        setPricingLoading(true);
        pricingApi.calculate({
          costPrice: currentSession.unitCost,
          materialId: mat.id,
          typeId: types.find(t => t.name === currentSession.typeName)?.id,
          weight: weight ? parseFloat(weight) : undefined,
        } as any).then(result => {
          const suggested = (result as any)?.suggestedPrice || 0;
          if (suggested > 0) {
            setPricingSuggestion(suggested);
            setSellingPrice(suggested);
          }
        }).catch(() => {
          // 定价计算失败不影响流转
        }).finally(() => {
          setPricingLoading(false);
        });
      }
    }
  }

  /** 提交当前货品 */
  async function handleSubmitItem() {
    if (!currentSession) return;
    if (photos.length === 0) { toast.error('请先拍照'); return; }
    if (sellingPrice <= 0) { toast.error('请输入售价'); return; }

    setSavingItem(true);
    try {
      // 创建货品
      const created = await itemsApi.createItem({
        materialId: materials.find(m => m.name === currentSession.materialName)?.id || 0,
        typeId: types.find(t => t.name === currentSession.typeName)?.id || undefined,
        costPrice: currentSession.unitCost,
        sellingPrice,
        batchId: currentSession.batchId,
        spec: weight ? { weight: parseFloat(weight) } : undefined,
      } as any);

      // 上传照片
      const uploadPromises = photos
        .filter(p => p.file)
        .map(async (photo) => {
          try {
            await itemsApi.uploadImage(created.id, photo.file!);
          } catch {
            console.warn('[QuickEntry] 照片上传失败:', photo.id);
          }
        });
      await Promise.all(uploadPromises);

      // 更新会话
      const newCount = currentSession.completedCount + 1;
      const updatedSession: QuickEntrySession = {
        ...currentSession,
        completedCount: newCount,
        status: newCount >= currentSession.totalQuantity ? 'active' : 'draft',
      };
      setSession(updatedSession);
      setCompletedItems(newCount);

      if (newCount >= currentSession.totalQuantity) {
        // 全部录完
        saveSession(null);
        toast.success(`全部 ${currentSession.totalQuantity} 件货品录入完成！`);
        onComplete();
      } else {
        // 还有下一件
        saveSession({ ...updatedSession, status: 'draft' });
        resetItemForm();
        toast.success(`已录入 ${newCount}/${currentSession.totalQuantity} 件`);
      }
    } catch (error) {
      handleError(error, { title: '入库失败' });
    } finally {
      setSavingItem(false);
    }
  }

  /** 暂存退出 */
  function handleSaveAndExit() {
    if (currentSession && currentSession.completedCount > 0) {
      const updatedSession: QuickEntrySession = {
        ...currentSession,
        status: 'draft',
      };
      saveSession(updatedSession);
      setSession(updatedSession);
      toast.success(`已暂存进度 ${currentSession.completedCount}/${currentSession.totalQuantity}，下次可继续`);
    }
    onExit();
  }

  /** 继续上次录入 */
  function handleResume() {
    const saved = loadSession();
    if (saved) {
      setSession({ ...saved, status: 'active' });
      setCompletedItems(saved.completedCount);
      setMode('entering');
      setShowResumeDialog(false);
    }
  }

  /** 放弃上次录入 */
  function handleDiscardResume() {
    saveSession(null);
    setShowResumeDialog(false);
  }

  // ==================== 界面渲染 ====================

  // ---------- 断点续录提示 ----------
  if (showResumeDialog) {
    const saved = loadSession();
    if (!saved) {
      setShowResumeDialog(false);
    } else {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <div className="max-w-sm w-full space-y-4 text-center">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-4 w-16 h-16 mx-auto flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-semibold">检测到未完成的录入</h3>
            <p className="text-sm text-muted-foreground">
              批次 <strong>{saved.batchCode}</strong> · {saved.materialName}{saved.typeName}
            </p>
            <p className="text-sm text-muted-foreground">
              已录入 {saved.completedCount}/{saved.totalQuantity} 件
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={handleDiscardResume}>
                重新开始
              </Button>
              <Button onClick={handleResume} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                继续录入
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  // ---------- Mode A: 创建批次 ----------
  if (mode === 'create_batch') {
    return (
      <>
        <div className="flex flex-col min-h-0 flex-1 max-w-lg mx-auto w-full">
          {/* 标题 */}
          <div className="px-1 pt-4 pb-3 flex-shrink-0">
            <h2 className="text-lg font-semibold">连续录入 · 创建批次</h2>
            <p className="text-sm text-muted-foreground mt-1">
              创建批次后，逐件录入货品信息
            </p>
          </div>

          <Separator className="flex-shrink-0" />

          <div className="flex-1 overflow-y-auto px-1 py-4 space-y-5 min-h-0">
            {/* 材质三级级联 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">材质 <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={materialCategory || '_all'}
                  onValueChange={v => {
                    setMaterialCategory(v === '_all' ? '' : v);
                    setMaterialSubType('');
                    setBatchForm(f => ({ ...f, materialId: '' }));
                  }}
                >
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

                <Select
                  value={materialSubType || '_all'}
                  onValueChange={v => {
                    setMaterialSubType(v === '_all' ? '' : v);
                    setBatchForm(f => ({ ...f, materialId: '' }));
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

                <Select
                  value={batchForm.materialId}
                  onValueChange={v => setBatchForm(f => ({ ...f, materialId: v }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMaterials.length === 0 ? (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">暂无材质</div>
                    ) : (
                      filteredMaterials.map(m => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 器型 */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">器型 <span className="text-red-500">*</span></Label>
              <Select
                value={batchForm.typeId}
                onValueChange={v => setBatchForm(f => ({ ...f, typeId: v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="选择器型" />
                </SelectTrigger>
                <SelectContent>
                  {types.length === 0 ? (
                    <div className="px-2 py-3 text-center text-xs text-muted-foreground">暂无器型</div>
                  ) : (
                    types.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 数量 */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">总数量 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                value={batchForm.quantity || ''}
                onChange={e => setBatchForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="h-10 text-lg font-bold"
                placeholder="输入货品总数量"
              />
            </div>

            {/* 总成本 + 自动计算单价 */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">总成本 (¥) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={batchForm.totalCost || ''}
                onChange={e => setBatchForm(f => ({ ...f, totalCost: parseFloat(e.target.value) || 0 }))}
                className="h-10 text-lg font-bold"
                placeholder="输入总成本"
              />
              {unitCost > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  单价成本 = {formatPrice(unitCost)}
                </p>
              )}
            </div>

            {/* 供应商 */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">供应商</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={batchForm.supplierId}
                    onValueChange={v => setBatchForm(f => ({ ...f, supplierId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="选择供应商（可选）" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-muted-foreground">暂无供应商</div>
                      ) : (
                        suppliers.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 px-3 flex-shrink-0"
                  onClick={() => setShowSupplierAdd(true)}
                  title="快速新增供应商"
                >
                  + 新增
                </Button>
              </div>
            </div>

            {/* 采购日期 */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">采购日期</Label>
              <Input
                type="date"
                value={batchForm.purchaseDate}
                onChange={e => setBatchForm(f => ({ ...f, purchaseDate: e.target.value }))}
                className="h-10"
              />
            </div>

            {/* 备注 */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">备注</Label>
              <Textarea
                value={batchForm.notes}
                onChange={e => setBatchForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="可选"
                className="h-20 text-sm"
              />
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center gap-3 px-1 pt-3 pb-4 border-t flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              className="h-10 text-sm"
              onClick={onExit}
            >
              取消
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              className="h-10 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-6"
              disabled={creatingBatch}
              onClick={handleCreateBatch}
            >
              {creatingBatch ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  创建中...
                </span>
              ) : (
                '创建批次并开始录入'
              )}
            </Button>
          </div>
        </div>

        {/* 快速新增供应商 */}
        <SupplierQuickAddDialog
          open={showSupplierAdd}
          onOpenChange={setShowSupplierAdd}
          onCreated={(newSupplier) => {
            setSuppliers(prev => [...prev, { id: newSupplier.id, name: newSupplier.name, contact: null, phone: null, notes: null, isActive: true }]);
            setBatchForm(f => ({ ...f, supplierId: String(newSupplier.id) }));
          }}
        />
      </>
    );
  }

  // ---------- Mode B: 连续录入 ----------
  if (currentSession) {
    const progressText = buildProgressBar(completedItems, currentSession.totalQuantity);
    const remaining = currentSession.totalQuantity - completedItems;

    return (
      <>
        {/* 全屏拍照界面 */}
        {showPhotoPhase && (
          <PhotoPhase
            onComplete={handlePhotosComplete}
            onCancel={() => setShowPhotoPhase(false)}
            maxPhotos={9}
          />
        )}

        <div className="flex flex-col min-h-0 flex-1 max-w-lg mx-auto w-full">
          {/* 顶部信息栏 */}
          <div className="px-1 pt-4 pb-3 space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">连续录入</h2>
              <span className="text-xs text-muted-foreground">
                批次 {currentSession.batchCode}
              </span>
            </div>

            {/* 进度条 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  进度: {progressText} {completedItems}/{currentSession.totalQuantity} 件
                </span>
                <span className="text-xs text-muted-foreground">
                  剩余 {remaining} 件
                </span>
              </div>
              {/* 可视化进度条 */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(completedItems / currentSession.totalQuantity) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {currentSession.materialName} · {currentSession.typeName}
              <span className="mx-2">|</span>
              单价成本: {formatPrice(currentSession.unitCost)}
            </p>
          </div>

          <Separator className="flex-shrink-0" />

          <div className="flex-1 overflow-y-auto px-1 py-4 space-y-5 min-h-0">
            {/* 拍照区域 */}
            {photos.length === 0 ? (
              <div
                onClick={openPhotoPhase}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all"
              >
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm font-medium">点击拍照</p>
                <p className="text-xs text-muted-foreground mt-1">拍摄货品照片，第一张自动设为封面</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">已拍 {photos.length} 张</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={openPhotoPhase}
                  >
                    {photos.length < 9 ? '重拍/追加' : '查看'}
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map(photo => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
                      <img
                        src={photo.previewUrl}
                        alt="货品照片"
                        className="w-full h-full object-cover"
                      />
                      {photo.isCover && (
                        <span className="absolute top-1 left-1 text-[10px] bg-emerald-600 text-white px-1 rounded">
                          封面
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 售价 */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">售价 (¥) <span className="text-red-500">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground z-10">
                  ¥
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={sellingPrice || ''}
                  onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="h-14 pl-8 pr-4 text-2xl font-bold text-right"
                  placeholder="输入售价"
                />
              </div>
              {/* 定价建议按钮 */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={pricingLoading}
                  onClick={async () => {
                    const mat = materials.find(m => m.name === currentSession.materialName);
                    if (!mat || currentSession.unitCost <= 0) {
                      toast.error('缺少材质或成本数据');
                      return;
                    }
                    setPricingLoading(true);
                    try {
                      const result = await pricingApi.calculate({
                        costPrice: currentSession.unitCost,
                        materialId: mat.id,
                        typeId: types.find(t => t.name === currentSession.typeName)?.id,
                        weight: weight ? parseFloat(weight) : undefined,
                      } as any);
                      const suggested = (result as any)?.suggestedPrice || 0;
                      if (suggested > 0) {
                        setPricingSuggestion(suggested);
                        setSellingPrice(suggested);
                      }
                    } catch {
                      toast.error('定价计算失败');
                    } finally {
                      setPricingLoading(false);
                    }
                  }}
                >
                  {pricingLoading ? '计算中...' : '定价建议'}
                </Button>
                {pricingSuggestion != null && pricingSuggestion > 0 && (
                  <span className="text-xs text-muted-foreground self-center">
                    建议: {formatPrice(pricingSuggestion)}
                  </span>
                )}
              </div>
            </div>

            {/* 重量（可选） */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">重量（克）</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="h-10"
                placeholder="规格有差异时填写（可选）"
              />
              <p className="text-[10px] text-muted-foreground">
                如规格与本批次其他货品不同，可填写实际重量
              </p>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="flex items-center gap-3 px-1 pt-3 pb-4 border-t flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              className="h-10 text-sm"
              onClick={handleSaveAndExit}
            >
              暂存退出
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              className="h-10 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-6"
              disabled={savingItem || photos.length === 0 || sellingPrice <= 0}
              onClick={handleSubmitItem}
            >
              {savingItem ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  保存中...
                </span>
              ) : isComplete ? (
                '全部完成'
              ) : (
                '确认并下一件'
              )}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ---------- 空状态（不应到达） ----------
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <p className="text-muted-foreground">会话数据缺失，请重新开始</p>
      <Button onClick={onExit} className="mt-4" variant="outline">
        返回
      </Button>
    </div>
  );
}
