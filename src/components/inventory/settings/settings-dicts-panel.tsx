'use client';

import React, { useState, useMemo } from 'react';
import type { DictMaterial, DictType, DictTag } from '@/lib/api.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Gem, Box, Tag, Hash, Layers, Crown, Search, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { dictsApi } from '@/lib/api';
import { useSettings } from './settings-context';
import { MATERIAL_CATEGORIES } from '@/lib/constants';

// ========== 规格字段定义（与 settings-tab 共享） ==========
const SPEC_FIELD_OPTIONS = [
  { key: 'weight', label: '克重(g)' },
  { key: 'metalWeight', label: '金重(g)' },
  { key: 'size', label: '尺寸' },
  { key: 'braceletSize', label: '圈口' },
  { key: 'beadCount', label: '颗数' },
  { key: 'beadDiameter', label: '珠径' },
  { key: 'ringSize', label: '戒圈' },
] as const;

const SPEC_FIELD_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SPEC_FIELD_OPTIONS.map(f => [f.key, f.label])
);

/** 解析 specFields（向后兼容数组格式） */
function parseSpecFields(raw: string | null | undefined): Record<string, { required: boolean }> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const obj: Record<string, { required: boolean }> = {};
      parsed.forEach((key: string) => { obj[key] = { required: false }; });
      return obj;
    }
    return parsed;
  } catch (e) { console.error('[SettingsDictsPanel]', e); return {}; }
}

/** 将 specFields 对象格式化为中文展示 */
function formatSpecFieldsDisplay(raw: string | null | undefined): string {
  const fields = parseSpecFields(raw);
  const keys = Object.keys(fields);
  if (keys.length === 0) return '-';
  return keys.map(k => {
    const label = SPEC_FIELD_LABEL_MAP[k] || k;
    const required = fields[k]?.required;
    return required ? `${label}*` : label;
  }).join('、');
}

export default function SettingsDictsPanel() {
  const { materials, types, tags, refreshMaterials, refreshTypes, refreshTags } = useSettings();

  // ─── 筛选状态 ───
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState('');
  const [typeSearchFilter, setTypeSearchFilter] = useState('');
  const [tagGroupFilter, setTagGroupFilter] = useState('');
  const [tagMaterialFilter, setTagMaterialFilter] = useState('');
  const [tagSearchFilter, setTagSearchFilter] = useState('');

  // ─── Material Dialog 状态 ───
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [editMaterial, setEditMaterial] = useState<any>(null);
  const [materialForm, setMaterialForm] = useState({ name: '', category: '', subType: '', origin: '', costPerGram: '' });

  // ─── Type Dialog 状态 ───
  const [showCreateType, setShowCreateType] = useState(false);
  const [editType, setEditType] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<any>(null);
  const [typeForm, setTypeForm] = useState<{ name: string; specFields: Record<string, { required: boolean }> }>({ name: '', specFields: {} });

  // ─── Tag Dialog 状态 ───
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [editTag, setEditTag] = useState<any>(null);
  const [tagForm, setTagForm] = useState({ name: '', groupName: '' });

  // 材质名称+子类冲突检测
  const materialNameConflict = useMemo(() => {
    const name = materialForm.name.trim();
    if (!name) return false;
    const subType = (materialForm.subType || '').trim();
    if (editMaterial) {
      return materials.some(m =>
        (m.id ?? m.name) !== editMaterial.id &&
        (m.name || '').trim() === name &&
        (m.subType || '').trim() === subType
      );
    }
    return materials.some(m =>
      (m.name || '').trim() === name &&
      (m.subType || '').trim() === subType
    );
  }, [materialForm.name, materialForm.subType, materials, editMaterial]);

  // tagGroups 计算
  const tagGroups = useMemo(() => {
    return tags.reduce((acc: Record<string, DictTag[]>, tag: DictTag) => {
      const g = tag.groupName || '未分组';
      if (!acc[g]) acc[g] = [];
      acc[g].push(tag);
      return acc;
    }, {});
  }, [tags]);

  // 材质大类筛选
  const filteredMaterials = useMemo(() => {
    if (!materialCategoryFilter) return materials;
    return materials.filter((m: DictMaterial) => m.category === materialCategoryFilter);
  }, [materials, materialCategoryFilter]);

  // 器型搜索筛选
  const filteredTypes = useMemo(() => {
    if (!typeSearchFilter.trim()) return types;
    const keyword = typeSearchFilter.trim().toLowerCase();
    return types.filter((t: DictType) =>
      t.name.toLowerCase().includes(keyword)
    );
  }, [types, typeSearchFilter]);

  // 标签搜索 + 分组 + 材质联动筛选
  const filteredTagGroups = useMemo(() => {
    let filtered = tags;
    if (tagSearchFilter.trim()) {
      const keyword = tagSearchFilter.trim().toLowerCase();
      filtered = filtered.filter((t: DictTag) =>
        t.name.toLowerCase().includes(keyword)
      );
    }
    const groups: Record<string, DictTag[]> = {};
    for (const tag of filtered) {
      const group = tag.groupName || '未分组';
      if (tagGroupFilter && group !== tagGroupFilter) continue;
      if (!groups[group]) groups[group] = [];
      groups[group].push(tag);
    }
    return groups;
  }, [tags, tagSearchFilter, tagGroupFilter]);

  // ─── Material Handlers ───
  async function handleCreateMaterial() {
    try {
      await dictsApi.createMaterial({
        ...materialForm,
        costPerGram: materialForm.costPerGram ? parseFloat(materialForm.costPerGram) : undefined,
      });
      toast.success('材质创建成功');
      setShowCreateMaterial(false);
      setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' });
      await refreshMaterials();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '创建失败');
    }
  }

  async function handleUpdateMaterial() {
    if (!editMaterial) return;
    try {
      await dictsApi.updateMaterial(editMaterial.id, {
        ...materialForm,
        costPerGram: materialForm.costPerGram ? parseFloat(materialForm.costPerGram) : undefined,
      });
      toast.success('材质更新成功');
      setEditMaterial(null);
      setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' });
      await refreshMaterials();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '更新失败');
    }
  }

  function openEditMaterialDialog(m: DictMaterial) {
    setEditMaterial(m);
    setMaterialForm({
      name: m.name || '',
      category: m.category || '',
      subType: m.subType || '',
      origin: m.origin || '',
      costPerGram: m.costPerGram ? String(m.costPerGram) : '',
    });
  }

  async function toggleMaterialActive(id: number, isActive: boolean) {
    try {
      await dictsApi.updateMaterial(id, { isActive: !isActive });
      await refreshMaterials();
      toast.success(isActive ? '已停用' : '已启用');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    }
  }

  // ─── Type Handlers ───
  async function handleCreateType() {
    try {
      await dictsApi.createType({ name: typeForm.name, specFields: JSON.stringify(typeForm.specFields) });
      toast.success('器型创建成功');
      setShowCreateType(false);
      setTypeForm({ name: '', specFields: {} });
      await refreshTypes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '创建失败');
    }
  }

  async function handleUpdateType() {
    if (!editType) return;
    try {
      await dictsApi.updateType(editType.id, { name: typeForm.name, specFields: JSON.stringify(typeForm.specFields) });
      toast.success('器型更新成功');
      setEditType(null);
      setTypeForm({ name: '', specFields: {} });
      await refreshTypes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '更新失败');
    }
  }

  async function handleDeleteType() {
    if (!deleteType) return;
    try {
      await dictsApi.deleteType(deleteType.id);
      toast.success('器型已删除/停用');
      setDeleteType(null);
      await refreshTypes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  }

  function openEditTypeDialog(t: DictType) {
    setEditType(t);
    setTypeForm({ name: t.name || '', specFields: parseSpecFields(t.specFields) });
  }

  async function handleToggleType(id: number) {
    try {
      await dictsApi.deleteType(id);
      toast.success('器型已删除/停用');
      await refreshTypes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    }
  }

  // ─── Tag Handlers ───
  async function handleCreateTag() {
    const mid = tagMaterialFilter ? parseInt(tagMaterialFilter, 10) : undefined;
    try {
      await dictsApi.createTag(tagForm);
      toast.success('标签创建成功');
      setShowCreateTag(false);
      setTagForm({ name: '', groupName: '' });
      await refreshTags(mid);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '创建失败');
    }
  }

  async function handleUpdateTag() {
    if (!editTag) return;
    const mid = tagMaterialFilter ? parseInt(tagMaterialFilter, 10) : undefined;
    try {
      await dictsApi.updateTag(editTag.id, { name: tagForm.name, groupName: tagForm.groupName || null });
      toast.success('标签更新成功');
      setEditTag(null);
      setTagForm({ name: '', groupName: '' });
      await refreshTags(mid);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '更新失败');
    }
  }

  async function toggleTagActive(id: number, isActive: boolean) {
    try {
      await dictsApi.updateTag(id, { isActive: !isActive });
      await refreshTags(tagMaterialFilter ? parseInt(tagMaterialFilter, 10) : undefined);
      toast.success(isActive ? '已停用' : '已启用');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    }
  }

  function openEditTagDialog(tag: DictTag) {
    setEditTag(tag);
    setTagForm({ name: tag.name || '', groupName: tag.groupName || '' });
  }

  return (
    <div className="space-y-4">
      {/* Materials */}
      <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Gem className="h-4 w-4 text-emerald-500" />
              材质 ({filteredMaterials.length})
            </CardTitle>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
              onClick={() => { setShowCreateMaterial(true); setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' }); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              新增材质
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Select
              value={materialCategoryFilter || '_all'}
              onValueChange={(v) => setMaterialCategoryFilter(v === '_all' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部分类</SelectItem>
                <SelectItem value="玉">玉</SelectItem>
                <SelectItem value="贵金属">贵金属</SelectItem>
                <SelectItem value="水晶">水晶</SelectItem>
                <SelectItem value="文玩">文玩</SelectItem>
                <SelectItem value="其他">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(() => {
            const activeMaterials = filteredMaterials.filter((m: DictMaterial) => m.isActive);
            const materialsWithSubType = activeMaterials.filter((m: DictMaterial) => m.subType).length;
            const categoryCount = new Set(activeMaterials.map((m: DictMaterial) => m.category).filter(Boolean)).size;
            return (
              <div className="mb-3 p-3 bg-muted/30 rounded-lg flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-muted-foreground">材质总数</span>
                  <span className="font-bold">{activeMaterials.length}种</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-sky-600" />
                  <span className="text-muted-foreground">有子类</span>
                  <span className="font-bold">{materialsWithSubType}种</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-muted-foreground">大类</span>
                  <span className="font-bold">{categoryCount}个</span>
                </div>
              </div>
            );
          })()}
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>大类</TableHead>
                  <TableHead>子类</TableHead>
                  <TableHead>产地</TableHead>
                  <TableHead className="text-right">克重单价</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((m: DictMaterial) => (
                  <TableRow key={m.id} className={!m.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {m.name}
                        {m.category === '贵金属' && (
                          <Lock className="h-3 w-3 text-amber-500 inline-block" title="贵金属为系统标准分类，不可修改" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{m.category || '-'}</TableCell>
                    <TableCell>{m.subType || '-'}</TableCell>
                    <TableCell>{m.origin || '-'}</TableCell>
                    <TableCell className="text-right">{m.costPerGram ? `¥${m.costPerGram}` : '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={m.isActive ? 'default' : 'secondary'}
                        className={m.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}
                      >
                        {m.isActive ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600"
                          onClick={() => openEditMaterialDialog(m)}
                          title={m.category === '贵金属' ? '贵金属为系统标准分类，不可修改' : '编辑'}
                          disabled={m.category === '贵金属'}
                        >
                          {m.category === '贵金属' ? <Lock className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleMaterialActive(m.id, m.isActive)}>
                          {m.isActive ? '停用' : '启用'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Types */}
      <Card className="border-l-4 border-l-blue-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Box className="h-4 w-4 text-blue-500" />
              器型 ({filteredTypes.length})
            </CardTitle>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => { setShowCreateType(true); setTypeForm({ name: '', specFields: {} }); }}>
              <Plus className="h-3 w-3 mr-1" />
              新增器型
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索器型名称..."
                value={typeSearchFilter}
                onChange={(e) => setTypeSearchFilter(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>规格字段</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.map((t: DictType) => (
                  <TableRow key={t.id} className={!t.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatSpecFieldsDisplay(t.specFields)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={t.isActive ? 'default' : 'secondary'}
                        className={t.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}
                      >
                        {t.isActive ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => openEditTypeDialog(t)} title="编辑">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleToggleType(t.id)}>
                          {t.isActive ? '停用' : '启用'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card className="border-l-4 border-l-purple-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-500" />
              标签 ({tags.length})
            </CardTitle>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => { setShowCreateTag(true); setTagForm({ name: '', groupName: '' }); }}>
              <Plus className="h-3 w-3 mr-1" />
              新增标签
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2 flex-wrap">
            <Select value={tagMaterialFilter} onValueChange={(v) => setTagMaterialFilter(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="全部材质" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部材质</SelectItem>
                {materials.filter((m: DictMaterial) => m.isActive).map((m: DictMaterial) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {Object.keys(tagGroups).length > 1 && (
              <Select value={tagGroupFilter} onValueChange={(v) => setTagGroupFilter(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="全部分组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">全部分组</SelectItem>
                  {Object.keys(tagGroups).map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索标签..."
                value={tagSearchFilter}
                onChange={(e) => setTagSearchFilter(e.target.value)}
                className="h-8 pl-8 text-xs w-36"
              />
            </div>
          </div>
          <div className="space-y-3">
            {Object.entries(filteredTagGroups).map(([group, groupTags]: [string, DictTag[]]) => (
              <div key={group}>
                <p className="text-sm font-medium text-muted-foreground mb-1">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {groupTags.map((tag: DictTag) => (
                    <div key={tag.id} className="group relative">
                      <Badge
                        variant={tag.isActive ? 'default' : 'secondary'}
                        className={`${tag.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'opacity-50'} cursor-pointer pr-6`}
                        onClick={() => openEditTagDialog(tag)}
                        title="点击编辑"
                      >
                        {tag.name}
                      </Badge>
                      <Button
                        size="sm" variant="ghost"
                        className="absolute -top-1 -right-1 h-4 w-4 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); toggleTagActive(tag.id, tag.isActive); }}
                        title={tag.isActive ? '停用' : '启用'}
                      >
                        {tag.isActive ? <span className="text-[10px]">✕</span> : <span className="text-[10px]">✓</span>}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════ */}
      {/* Create Material Dialog */}
      {/* ════════════════════════════════════════════ */}
      <Dialog open={showCreateMaterial} onOpenChange={setShowCreateMaterial}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增材质</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={materialForm.name} onChange={e => setMaterialForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 和田玉" /></div>
            {materialNameConflict && <p className="text-red-500 text-sm mt-1">该材质名称+子类已存在</p>}
            <div className="space-y-1"><Label>大类</Label>
              <Select value={materialForm.category} onValueChange={v => setMaterialForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择大类" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>子类</Label><Input value={materialForm.subType} onChange={e => setMaterialForm(f => ({ ...f, subType: e.target.value }))} placeholder="如: 籽料、山料" list="subTypeOptions" /></div>
            <div className="space-y-1"><Label>产地</Label><Input value={materialForm.origin} onChange={e => setMaterialForm(f => ({ ...f, origin: e.target.value }))} placeholder="如: 新疆" list="originOptions" /></div>
            {materialForm.category === '贵金属' ? (
              <div className="space-y-1 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  贵金属材质的克重成本由行情价自动管理，不可手动编辑
                </p>
              </div>
            ) : (
              <div className="space-y-1"><Label>克重成本（元/克）</Label><Input type="number" value={materialForm.costPerGram} onChange={e => setMaterialForm(f => ({ ...f, costPerGram: e.target.value }))} placeholder="如: 500" /></div>
            )}
          </div>
          <datalist id="subTypeOptions">
            <option value="籽料" /><option value="山料" /><option value="山流水" /><option value="戈壁料" />
            <option value="k999" /><option value="k990" /><option value="k916" /><option value="k750" /><option value="pt950" /><option value="pt900" />
            <option value="天然" /><option value="养殖" />
          </datalist>
          <datalist id="originOptions">
            <option value="缅甸" /><option value="新疆和田" /><option value="青海" /><option value="俄罗斯" /><option value="国内" />
            <option value="巴西" /><option value="斯里兰卡" /><option value="印度" /><option value="哥伦比亚" />
          </datalist>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateMaterial(false)}>取消</Button>
            <Button onClick={handleCreateMaterial} className="bg-emerald-600 hover:bg-emerald-700" disabled={!materialForm.name || materialNameConflict}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Material Dialog */}
      <Dialog open={editMaterial !== null} onOpenChange={open => { if (!open) setEditMaterial(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              编辑材质
              {editMaterial?.category === '贵金属' && (
                <span className="text-xs text-amber-600 font-normal flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  贵金属为系统标准分类，不可修改
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>名称 *</Label>
              <Input value={materialForm.name} onChange={e => setMaterialForm(f => ({ ...f, name: e.target.value }))}
                disabled={editMaterial?.category === '贵金属'}
                className={editMaterial?.category === '贵金属' ? 'opacity-60' : ''}
              />
            </div>
            {materialNameConflict && <p className="text-red-500 text-sm mt-1">该材质名称+子类已存在</p>}
            <div className="space-y-1"><Label>大类</Label>
              <Select value={materialForm.category} onValueChange={v => setMaterialForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择大类" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>子类</Label>
              <Input value={materialForm.subType} onChange={e => setMaterialForm(f => ({ ...f, subType: e.target.value }))}
                list="subTypeOptionsEdit"
                disabled={editMaterial?.category === '贵金属'}
                className={editMaterial?.category === '贵金属' ? 'opacity-60' : ''}
              />
            </div>
            <div className="space-y-1"><Label>产地</Label><Input value={materialForm.origin} onChange={e => setMaterialForm(f => ({ ...f, origin: e.target.value }))} list="originOptionsEdit" /></div>
            {editMaterial?.category === '贵金属' ? (
              <div className="space-y-1 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  贵金属材质的克重成本由行情价自动管理，不可手动编辑
                </p>
              </div>
            ) : (
              <div className="space-y-1"><Label>克重成本（元/克）</Label><Input type="number" value={materialForm.costPerGram} onChange={e => setMaterialForm(f => ({ ...f, costPerGram: e.target.value }))} /></div>
            )}
          </div>
          <datalist id="subTypeOptionsEdit">
            <option value="籽料" /><option value="山料" /><option value="山流水" /><option value="戈壁料" />
            <option value="k999" /><option value="k990" /><option value="k916" /><option value="k750" /><option value="pt950" /><option value="pt900" />
            <option value="天然" /><option value="养殖" />
          </datalist>
          <datalist id="originOptionsEdit">
            <option value="缅甸" /><option value="新疆和田" /><option value="青海" /><option value="俄罗斯" /><option value="国内" />
            <option value="巴西" /><option value="斯里兰卡" /><option value="印度" /><option value="哥伦比亚" />
          </datalist>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMaterial(null)}>取消</Button>
            <Button onClick={handleUpdateMaterial} className="bg-emerald-600 hover:bg-emerald-700" disabled={!materialForm.name || materialNameConflict}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Type Dialog */}
      <Dialog open={showCreateType} onOpenChange={setShowCreateType}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增器型</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 手镯" /></div>
            <div className="space-y-2">
              <Label>规格字段</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {SPEC_FIELD_OPTIONS.map(field => {
                  const isChecked = field.key in typeForm.specFields;
                  const isRequired = typeForm.specFields[field.key]?.required ?? false;
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <Checkbox id={`spec-${field.key}`} checked={isChecked}
                        onCheckedChange={(checked) => {
                          setTypeForm(f => {
                            const newFields = { ...f.specFields };
                            if (checked) newFields[field.key] = { required: false };
                            else delete newFields[field.key];
                            return { ...f, specFields: newFields };
                          });
                        }}
                      />
                      <Label htmlFor={`spec-${field.key}`} className="text-sm flex-1 cursor-pointer">{field.label}</Label>
                      {isChecked && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox checked={isRequired}
                            onCheckedChange={(checked) => {
                              setTypeForm(f => ({ ...f, specFields: { ...f.specFields, [field.key]: { required: !!checked } } }));
                            }}
                          />
                          必填
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">勾选需要的规格字段，并标记是否必填</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateType(false)}>取消</Button>
            <Button onClick={handleCreateType} className="bg-emerald-600 hover:bg-emerald-700" disabled={!typeForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Type Dialog */}
      <Dialog open={editType !== null} onOpenChange={open => { if (!open) setEditType(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑器型</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 手镯" /></div>
            <div className="space-y-2">
              <Label>规格字段</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {SPEC_FIELD_OPTIONS.map(field => {
                  const isChecked = field.key in typeForm.specFields;
                  const isRequired = typeForm.specFields[field.key]?.required ?? false;
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <Checkbox id={`edit-spec-${field.key}`} checked={isChecked}
                        onCheckedChange={(checked) => {
                          setTypeForm(f => {
                            const newFields = { ...f.specFields };
                            if (checked) newFields[field.key] = { required: false };
                            else delete newFields[field.key];
                            return { ...f, specFields: newFields };
                          });
                        }}
                      />
                      <Label htmlFor={`edit-spec-${field.key}`} className="text-sm flex-1 cursor-pointer">{field.label}</Label>
                      {isChecked && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox checked={isRequired}
                            onCheckedChange={(checked) => {
                              setTypeForm(f => ({ ...f, specFields: { ...f.specFields, [field.key]: { required: !!checked } } }));
                            }}
                          />
                          必填
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">勾选需要的规格字段，并标记是否必填</p>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-sm">状态</span>
              <Button size="sm" variant={editType?.isActive ? 'outline' : 'default'} className={editType?.isActive ? 'text-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'} onClick={async () => {
                if (!editType) return;
                try { await dictsApi.deleteType(editType.id); toast.success(editType.isActive ? '已停用' : '已启用'); await refreshTypes(); setEditType(null); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '操作失败'); }
              }}>{editType?.isActive ? '停用' : '启用'}</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditType(null)}>取消</Button>
            <Button onClick={handleUpdateType} className="bg-emerald-600 hover:bg-emerald-700" disabled={!typeForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Type Confirm Dialog */}
      <Dialog open={deleteType !== null} onOpenChange={open => { if (!open) setDeleteType(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除器型「{deleteType?.name}」吗？此操作不可恢复。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteType(null)}>取消</Button>
            <Button onClick={handleDeleteType} className="bg-red-600 hover:bg-red-700">确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={showCreateTag} onOpenChange={setShowCreateTag}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增标签</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={tagForm.name} onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 限定款" /></div>
            <div className="space-y-1"><Label>分组</Label>
              {Object.keys(tagGroups).filter(g => g !== '未分组').length > 0 ? (
                <div className="flex gap-2">
                  <Select value={tagForm.groupName} onValueChange={v => setTagForm(f => ({ ...f, groupName: v === '_custom' ? '' : v }))}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="选择分组" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_custom">自定义...</SelectItem>
                      {Object.keys(tagGroups).filter(g => g !== '未分组').map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(!tagForm.groupName || !Object.keys(tagGroups).includes(tagForm.groupName)) && (
                    <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} placeholder="如: 风格" className="flex-1" />
                  )}
                </div>
              ) : (
                <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} placeholder="如: 风格" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTag(false)}>取消</Button>
            <Button onClick={handleCreateTag} className="bg-emerald-600 hover:bg-emerald-700" disabled={!tagForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={editTag !== null} onOpenChange={open => { if (!open) setEditTag(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑标签</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={tagForm.name} onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>分组</Label>
              {Object.keys(tagGroups).filter(g => g !== '未分组').length > 0 ? (
                <div className="flex gap-2">
                  <Select value={tagForm.groupName} onValueChange={v => setTagForm(f => ({ ...f, groupName: v === '_custom' ? '' : v }))}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="选择分组" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_custom">自定义...</SelectItem>
                      {Object.keys(tagGroups).filter(g => g !== '未分组').map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(!tagForm.groupName || !Object.keys(tagGroups).includes(tagForm.groupName)) && (
                    <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} placeholder="如: 风格" className="flex-1" />
                  )}
                </div>
              ) : (
                <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} />
              )}
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-sm">状态</span>
              <Button size="sm" variant={editTag?.isActive ? 'outline' : 'default'} className={editTag?.isActive ? 'text-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'} onClick={() => { if (editTag) toggleTagActive(editTag.id, editTag.isActive); }}>{editTag?.isActive ? '停用' : '启用'}</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTag(null)}>取消</Button>
            <Button onClick={handleUpdateTag} className="bg-emerald-600 hover:bg-emerald-700" disabled={!tagForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
