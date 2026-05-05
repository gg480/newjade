'use client';

import React, { useState, useEffect, useRef } from 'react';
import { dictsApi, configApi, suppliersApi, metalApi, backupApi, importApi, itemsApi, salesApi, batchesApi, customersApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, EmptyState, LoadingSkeleton } from './shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog';

import {
  Plus, Pencil, Trash2, Factory, Calculator, History, Download, Upload, Database,
  AlertTriangle, Loader2, FileSpreadsheet, FileDown, CheckCircle, XCircle, Clock,
  Phone, Gem, Box, Tag, DollarSign, Settings, ShieldCheck, Grid, Package, ShoppingCart,
  Users, Layers, Search, X, Hash, Crown,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Panel imports
import SettingsDictsPanel from './settings/settings-dicts-panel';
import SettingsMetalPanel from './settings/settings-metal-panel';
import SettingsSuppliersPanel from './settings/settings-suppliers-panel';
import SettingsConfigPanel from './settings/settings-config-panel';
import SettingsBackupPanel from './settings/settings-backup-panel';
import SettingsImportCsvPanel from './settings/settings-import-csv-panel';
import SettingsImportDataPanel from './settings/settings-import-data-panel';

// ========== 材质大类选项 ==========
const MATERIAL_CATEGORIES = [
  { value: '玉', label: '玉' },
  { value: '贵金属', label: '贵金属' },
  { value: '水晶', label: '水晶' },
  { value: '文玩', label: '文玩' },
  { value: '其他', label: '其他' },
];

// ========== 规格字段定义 ==========
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
  } catch (e) { console.error('[SettingsTab]', e); return {}; }
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

// ========== Relative Time Helper ==========
export function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffWeeks < 4) return `${diffWeeks}周前`;
    if (diffMonths < 12) return `${diffMonths}个月前`;
    return `${Math.floor(diffMonths / 12)}年前`;
  } catch (e) { console.error('[SettingsTab]', e); return dateStr; }
}

// ========== Settings Tab ==========
function SettingsTab() {
  const [subTab, setSubTab] = useState('dicts');
  const [materials, setMaterials] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSupplierSearch(supplierSearch), 300);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  // Supplier dialog states
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<any>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', notes: '' });

  // Dict dialog states
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [editMaterial, setEditMaterial] = useState<any>(null);
  const [materialForm, setMaterialForm] = useState({ name: '', category: '', subType: '', origin: '', costPerGram: '' });
  const [showCreateType, setShowCreateType] = useState(false);
  const [editType, setEditType] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<any>(null);
  const [typeForm, setTypeForm] = useState<{ name: string; specFields: Record<string, { required: boolean }> }>({ name: '', specFields: {} });
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [tagForm, setTagForm] = useState({ name: '', groupName: '' });
  const [tagGroupFilter, setTagGroupFilter] = useState('');
  const [tagMaterialFilter, setTagMaterialFilter] = useState('');
  const [editTag, setEditTag] = useState<any>(null);

  // Metal reprice states
  const [repricePreview, setRepricePreview] = useState<any>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [priceHistoryMaterial, setPriceHistoryMaterial] = useState<string>('');

  // Backup/restore states
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // Import states
  const [importType, setImportType] = useState<'items' | 'sales'>('items');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // CSV quick import states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; skipped: number; duplicated: number; errors: string[]; autoCreated?: { materials: string[]; types: string[] }; inferred?: { row: number; field: string; value: string }[] } | null>(null);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [autoCreate, setAutoCreate] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null);

  // Data statistics states
  const [dataStats, setDataStats] = useState({
    itemsCount: null as number | null,
    salesCount: null as number | null,
    customersCount: null as number | null,
    batchesCount: null as number | null,
  });
  const [lastBackupFromStorage, setLastBackupFromStorage] = useState<string | null>(null);
  const [dbSize, setDbSize] = useState<string | null>(null);
  const [dbSizeLoading, setDbSizeLoading] = useState(false);

  // Data cleanup states
  const [deletedItemsCount, setDeletedItemsCount] = useState<number>(0);
  const [oldLogsCount, setOldLogsCount] = useState<number>(0);
  const [cleanupLoading, setCleanupLoading] = useState<string | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState<{ type: 'deleted' | 'logs'; open: boolean }>({ type: 'deleted', open: false });

  // System config
  const STORAGE_KEY = 'jade_system_config';
  const defaultSettings = { storeName: '兴盛艺珠宝', currencySymbol: '¥', lowStockDays: 90, profitWarningThreshold: 30, defaultProfitRate: 40 };
  const [systemConfig, setSystemConfig] = useState(defaultSettings);
  const [editConfigs, setEditConfigs] = useState<Record<string, string>>({});

  // Load settings & data stats from localStorage on mount
  useEffect(() => {
    try {
      let stored: string | null = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { console.error('[SettingsTab]', e);}
      if (!stored) {
        try { stored = localStorage.getItem('app_settings'); } catch (e) { console.error('[SettingsTab]', e);}
      }
      if (stored) {
        const parsed = JSON.parse(stored);
        setSystemConfig({
          ...defaultSettings,
          currencySymbol: parsed?.currencySymbol ?? defaultSettings.currencySymbol,
          profitWarningThreshold: parsed?.profitWarningThreshold ?? defaultSettings.profitWarningThreshold,
          defaultProfitRate: parsed?.defaultProfitRate ?? defaultSettings.defaultProfitRate,
        });
      }
    } catch (e) { console.error('[SettingsTab]', e); /* use defaults */ }
    try {
      const backupTime = localStorage.getItem('last_backup_time');
      if (backupTime) setLastBackupFromStorage(backupTime);
    } catch (e) { console.error('[SettingsTab]', e); /* ignore */ }
  }, []);

  // Sync key settings from server config to local state
  useEffect(() => {
    const storeNameConfig = configs.find(c => c.key === 'store_name');
    if (storeNameConfig?.value) {
      setSystemConfig(prev => ({ ...prev, storeName: storeNameConfig.value }));
    }
    const warningDaysConfig = configs.find(c => c.key === 'warning_days');
    if (warningDaysConfig?.value && !isNaN(parseInt(warningDaysConfig.value))) {
      setSystemConfig(prev => ({ ...prev, lowStockDays: parseInt(warningDaysConfig.value) || prev.lowStockDays }));
    }
    const editMap: Record<string, string> = {};
    configs.forEach(c => { editMap[c.key] = c.value; });
    setEditConfigs(editMap);
  }, [configs]);

  // Fetch data statistics
  useEffect(() => {
    async function fetchStats() {
      setDbSizeLoading(true);
      try {
        const [itemsRes, salesRes, customersRes, batchesRes] = await Promise.allSettled([
          itemsApi.getItems({ page: 1, size: 1 }),
          salesApi.getSales({ page: 1, size: 1 }),
          customersApi.getCustomers({ page: 1, size: 1 }),
          batchesApi.getBatches({ page: 1, size: 1 }),
        ]);
        setDataStats({
          itemsCount: itemsRes.status === 'fulfilled' ? (itemsRes.value.pagination?.total ?? null) : null,
          salesCount: salesRes.status === 'fulfilled' ? (salesRes.value.pagination?.total ?? null) : null,
          customersCount: customersRes.status === 'fulfilled' ? (customersRes.value.pagination?.total ?? null) : null,
          batchesCount: batchesRes.status === 'fulfilled' ? (batchesRes.value.pagination?.total ?? null) : null,
        });
        try {
          const sizeRes = await fetch('/api/config');
          const sizeJson = await sizeRes.json();
          if (sizeJson.code === 0) {
            const sizeStr = sizeJson.data?.find?.((c: any) => c.key === 'db_size')?.value;
            if (sizeStr) setDbSize(sizeStr);
          }
        } catch (e) { console.error('[SettingsTab]', e); /* ignore */ }
        try {
          const [delRes, logRes] = await Promise.allSettled([
            fetch('/api/items/cleanup-deleted'),
            fetch('/api/logs/cleanup-old'),
          ]);
          if (delRes.status === 'fulfilled') {
            const delJson = await delRes.value.json();
            setDeletedItemsCount(delJson.data?.count || 0);
          }
          if (logRes.status === 'fulfilled') {
            const logJson = await logRes.value.json();
            setOldLogsCount(logJson.data?.count || 0);
          }
        } catch (e) { console.error('[SettingsTab]', e); /* ignore */ }
      } catch (e) { console.error('[SettingsTab]', e); /* silently fail */ } finally { setDbSizeLoading(false); }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [m, t, tg, c, s] = await Promise.all([
          dictsApi.getMaterials(true), dictsApi.getTypes(true), dictsApi.getTags(undefined, true),
          configApi.getConfig(), suppliersApi.getSuppliers(),
        ]);
        setMaterials(m || []);
        setTypes(t || []);
        setTags(tg || []);
        setConfigs(c || []);
        setSuppliers(s?.items || []);
      } catch (e) { console.error('[SettingsTab]', e); toast.error('加载设置数据失败'); } finally { setLoading(false); }
    }
    fetchAll();
  }, []);

  // Re-fetch tags when material filter changes
  useEffect(() => {
    if (!materials.length) return;
    const mid = tagMaterialFilter ? parseInt(tagMaterialFilter, 10) : undefined;
    dictsApi.getTags(undefined, true, mid).then((tg: any[]) => setTags(tg || [])).catch(() => {});
  }, [tagMaterialFilter, materials.length]);

  async function toggleMaterialActive(id: number, isActive: boolean) {
    try { await dictsApi.updateMaterial(id, { isActive: !isActive }); setMaterials(m => m.map(x => x.id === id ? { ...x, isActive: !isActive } : x)); toast.success(isActive ? '已停用' : '已启用'); } catch (e: any) { toast.error(e.message); }
  }

  function persistLocalSystemConfig(nextConfig: typeof defaultSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      currencySymbol: nextConfig.currencySymbol,
      profitWarningThreshold: nextConfig.profitWarningThreshold,
      defaultProfitRate: nextConfig.defaultProfitRate,
    }));
  }

  async function updateConfig(key: string, value: string) {
    try { await configApi.updateConfig(key, value); setConfigs(c => c.map(x => x.key === key ? { ...x, value } : x)); setEditConfigs(prev => ({ ...prev, [key]: value })); toast.success('配置已更新'); } catch (e: any) { toast.error(e.message); }
  }

  // Supplier handlers
  async function fetchSuppliers() {
    try { const s = await suppliersApi.getSuppliers(); setSuppliers(s?.items || []); } catch (e) { console.error('[SettingsTab]', e); toast.error('加载供应商失败'); }
  }

  async function handleCreateSupplier() {
    try { await suppliersApi.createSupplier(supplierForm); toast.success('供应商创建成功'); setShowCreateSupplier(false); setSupplierForm({ name: '', contact: '', phone: '', notes: '' }); fetchSuppliers(); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateSupplier() {
    if (!editSupplier) return;
    try { await suppliersApi.updateSupplier(editSupplier.id, supplierForm); toast.success('供应商更新成功'); setEditSupplier(null); setSupplierForm({ name: '', contact: '', phone: '', notes: '' }); fetchSuppliers(); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDeleteSupplier() {
    if (!deleteSupplier) return;
    try { await suppliersApi.deleteSupplier(deleteSupplier.id); toast.success('供应商已删除'); setDeleteSupplier(null); fetchSuppliers(); } catch (e: any) { toast.error(e.message || '删除失败'); }
  }

  // Data cleanup handlers
  async function handleCleanupDeleted() {
    setCleanupLoading('deleted');
    try {
      const res = await fetch('/api/items/cleanup-deleted', { method: 'DELETE' });
      const json = await res.json();
      if (json.code === 0) {
        toast.success(`已清除 ${json.data.deleted} 条已删除货品`);
        setDeletedItemsCount(0);
        const itemsRes = await itemsApi.getItems({ page: 1, size: 1 });
        setDataStats(prev => ({ ...prev, itemsCount: itemsRes.pagination?.total ?? prev.itemsCount }));
      } else { toast.error(json.message || '清除失败'); }
    } catch (e) { console.error('[SettingsTab]', e); toast.error('清除已删除货品失败'); } finally {
      setCleanupLoading(null);
      setCleanupConfirm({ type: 'deleted', open: false });
    }
  }

  async function handleCleanupOldLogs() {
    setCleanupLoading('logs');
    try {
      const res = await fetch('/api/logs/cleanup-old', { method: 'DELETE' });
      const json = await res.json();
      if (json.code === 0) {
        toast.success(`已清除 ${json.data.deleted} 条30天前的操作日志`);
        setOldLogsCount(0);
      } else { toast.error(json.message || '清除失败'); }
    } catch (e) { console.error('[SettingsTab]', e); toast.error('清除操作日志失败'); } finally {
      setCleanupLoading(null);
      setCleanupConfirm({ type: 'logs', open: false });
    }
  }

  function openEditSupplierDialog(s: any) {
    setEditSupplier(s);
    setSupplierForm({ name: s.name || '', contact: s.contact || '', phone: s.phone || '', notes: s.notes || '' });
  }

  // Dict handlers
  async function handleCreateMaterial() {
    try { await dictsApi.createMaterial({ ...materialForm, costPerGram: materialForm.costPerGram ? parseFloat(materialForm.costPerGram) : undefined }); toast.success('材质创建成功'); setShowCreateMaterial(false); setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' }); const m = await dictsApi.getMaterials(true); setMaterials(m || []); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateMaterial() {
    if (!editMaterial) return;
    try { await dictsApi.updateMaterial(editMaterial.id, { ...materialForm, costPerGram: materialForm.costPerGram ? parseFloat(materialForm.costPerGram) : undefined }); toast.success('材质更新成功'); setEditMaterial(null); setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' }); const m = await dictsApi.getMaterials(true); setMaterials(m || []); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  function openEditMaterialDialog(m: any) {
    setEditMaterial(m);
    setMaterialForm({ name: m.name || '', category: m.category || '', subType: m.subType || '', origin: m.origin || '', costPerGram: m.costPerGram ? String(m.costPerGram) : '' });
  }

  async function handleCreateType() {
    try {
      await dictsApi.createType({ name: typeForm.name, specFields: JSON.stringify(typeForm.specFields) });
      toast.success('器型创建成功');
      setShowCreateType(false); setTypeForm({ name: '', specFields: {} });
      const t = await dictsApi.getTypes(true); setTypes(t || []);
    } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateType() {
    if (!editType) return;
    try {
      await dictsApi.updateType(editType.id, { name: typeForm.name, specFields: JSON.stringify(typeForm.specFields) });
      toast.success('器型更新成功');
      setEditType(null); setTypeForm({ name: '', specFields: {} });
      const t = await dictsApi.getTypes(true); setTypes(t || []);
    } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDeleteType() {
    if (!deleteType) return;
    try {
      await dictsApi.deleteType(deleteType.id);
      toast.success('器型已删除/停用');
      setDeleteType(null);
      const t = await dictsApi.getTypes(true); setTypes(t || []);
    } catch (e: any) { toast.error(e.message || '删除失败'); }
  }

  function openEditTypeDialog(t: any) {
    setEditType(t);
    setTypeForm({ name: t.name || '', specFields: parseSpecFields(t.specFields) });
  }

  async function handleCreateTag() {
    const mid = tagMaterialFilter ? parseInt(tagMaterialFilter, 10) : undefined;
    try { await dictsApi.createTag(tagForm); toast.success('标签创建成功'); setShowCreateTag(false); setTagForm({ name: '', groupName: '' }); const tg = await dictsApi.getTags(undefined, true, mid); setTags(tg || []); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateTag() {
    if (!editTag) return;
    const mid = tagMaterialFilter ? parseInt(tagMaterialFilter, 10) : undefined;
    try { await dictsApi.updateTag(editTag.id, { name: tagForm.name, groupName: tagForm.groupName || null }); toast.success('标签更新成功'); setEditTag(null); setTagForm({ name: '', groupName: '' }); const tg = await dictsApi.getTags(undefined, true, mid); setTags(tg || []); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function toggleTagActive(id: number, isActive: boolean) {
    try { await dictsApi.updateTag(id, { isActive: !isActive }); setTags(tg => tg.map(x => x.id === id ? { ...x, isActive: !isActive } : x)); toast.success(isActive ? '已停用' : '已启用'); } catch (e: any) { toast.error(e.message); }
  }

  function openEditTagDialog(tag: any) {
    setEditTag(tag);
    setTagForm({ name: tag.name || '', groupName: tag.groupName || '' });
  }

  // Metal reprice handlers
  async function handlePreviewReprice(materialId: number, newPrice: number) {
    try { const result = await metalApi.previewReprice({ materialId, newPricePerGram: newPrice }); setRepricePreview({ ...result, materialId, newPrice }); } catch (e: any) { toast.error(e.message || '预览失败'); }
  }

  async function handleConfirmReprice() {
    if (!repricePreview) return;
    try { await metalApi.confirmReprice({ materialId: repricePreview.materialId, newPricePerGram: repricePreview.newPrice }); toast.success('调价已确认，相关货品已更新'); setRepricePreview(null); const m = await dictsApi.getMaterials(true); setMaterials(m || []); } catch (e: any) { toast.error(e.message || '确认调价失败'); }
  }

  async function handlePriceHistory(materialId: number, materialName: string) {
    try { const h = await metalApi.getPriceHistory({ material_id: materialId }); setPriceHistory(h || []); setPriceHistoryMaterial(materialName); setShowPriceHistory(true); } catch (e: any) { toast.error(e.message || '加载历史失败'); }
  }

  // Import handlers
  function handleFileSelect(file: File) {
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return;
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1, 6).map(line => {
          return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        });
        setPreviewData({ headers, rows });
      } catch (e) { console.error('[SettingsTab]', e); toast.error('文件预览失败'); }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    try {
      const options = { autoCreate, skipExisting };
      const result = importType === 'items'
        ? await importApi.importItems(importFile, options)
        : await importApi.importSales(importFile, { autoCreate });
      setImportResult(result);
      toast.success(`导入完成: 成功${result.successCount}条, 失败${result.failCount}条`);
    } catch (e: any) { toast.error(e.message || '导入失败'); } finally { setImporting(false); }
  }

  // CSV quick import handler
  function handleDownloadCsvTemplate() {
    const header = '名称,数量,材质,器型,成本价,零售价,柜台,采购日期,产地,证书号,匹配码,备注';
    const example1 = '翡翠手镯,1,翡翠,手镯,5000,8000,1,2024-01-15,缅甸,,A001,好货';
    const example2 = '和田玉吊坠,1,和田玉,吊坠,3000,5500,2,2024-02-20,新疆,CERT001,A002,';
    const example3 = '南红手串,3,南红,手链,800,2500,1,2024-03-10,云南,,A003,热门款';
    const csv = '\uFEFF' + header + '\n' + example1 + '\n' + example2 + '\n' + example3 + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = '货品导入模板.csv'; link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvImport() {
    if (!csvFile) return;
    setCsvImporting(true); setCsvResult(null);
    try {
      const result = await importApi.importCsvItems(csvFile);
      setCsvResult(result);
      const parts = [`成功${result.success}件`];
      if ((result as any).duplicated > 0) parts.push(`重复跳过${(result as any).duplicated}件`);
      if (result.skipped > 0) parts.push(`跳过${result.skipped}行`);
      if (result.errors.length === 0) {
        toast.success(`CSV导入完成: ${parts.join('，')}`);
      } else {
        toast.warning(`CSV导入完成: ${parts.join('，')}，${result.errors.length}行错误`);
      }
    } catch (e: any) { toast.error(e.message || 'CSV导入失败'); } finally { setCsvImporting(false); }
  }

  // Backup download handler
  async function handleDownloadBackup() {
    try {
      const res = await fetch(backupApi.download());
      if (!res.ok) {
        let errMsg = `下载失败（HTTP ${res.status}）`;
        try { const errJson = await res.json(); if (errJson?.message) errMsg = errJson.message; } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `jade-backup-${new Date().toISOString().slice(0, 10)}.db`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const nowDisplay = new Date().toLocaleString('zh-CN');
      setLastBackupTime(nowDisplay);
      setLastBackupFromStorage(nowDisplay);
      localStorage.setItem('last_backup_time', new Date().toISOString());
      toast.success('备份下载完成');
    } catch (e: any) { toast.error(e.message || '备份下载失败'); }
  }

  // Config save handler
  async function handleSaveConfig() {
    persistLocalSystemConfig(systemConfig);
    const storeNameVal = configs.find(c => c.key === 'store_name')?.value;
    const warningDaysVal = configs.find(c => c.key === 'warning_days')?.value;
    const tasks: Promise<void>[] = [];
    if (systemConfig.storeName !== storeNameVal) {
      tasks.push(updateConfig('store_name', systemConfig.storeName));
    }
    if (String(systemConfig.lowStockDays) !== String(warningDaysVal || '')) {
      tasks.push(updateConfig('warning_days', String(systemConfig.lowStockDays)));
    }
    await Promise.all(tasks);
    toast.success('设置已保存');
  }

  function handleResetConfig() {
    const defaults = { storeName: '兴盛艺珠宝', currencySymbol: '¥', lowStockDays: 90, profitWarningThreshold: 30, defaultProfitRate: 40 };
    setSystemConfig(defaults);
    persistLocalSystemConfig(defaults);
    void updateConfig('store_name', defaults.storeName);
    void updateConfig('warning_days', String(defaults.lowStockDays));
    toast.success('已恢复默认设置');
  }

  // Type toggle handler (for panel callback)
  async function handleToggleType(id: number) {
    try { await dictsApi.deleteType(id); toast.success('器型已删除/停用'); const tp = await dictsApi.getTypes(true); setTypes(tp || []); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <LoadingSkeleton />;

  const tagGroups = tags.reduce((acc: any, tag: any) => {
    const g = tag.groupName || '未分组';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tag);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* ===== Data Overview Section ===== */}
      <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Grid className="h-4 w-4 text-emerald-500" />数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-emerald-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><Package className="h-3.5 w-3.5 text-emerald-600" /></div>
                <span className="text-xs text-muted-foreground">货品总数</span>
              </div>
              {dbSizeLoading || dataStats.itemsCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{dataStats.itemsCount ?? 0}</p>
              )}
            </div>
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-sky-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center"><ShoppingCart className="h-3.5 w-3.5 text-sky-600" /></div>
                <span className="text-xs text-muted-foreground">销售总数</span>
              </div>
              {dbSizeLoading || dataStats.salesCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-sky-700 dark:text-sky-400">{dataStats.salesCount ?? 0}</p>
              )}
            </div>
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-amber-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><Users className="h-3.5 w-3.5 text-amber-600" /></div>
                <span className="text-xs text-muted-foreground">客户总数</span>
              </div>
              {dbSizeLoading || dataStats.customersCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{dataStats.customersCount ?? 0}</p>
              )}
            </div>
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-teal-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center"><Layers className="h-3.5 w-3.5 text-teal-600" /></div>
                <span className="text-xs text-muted-foreground">批次总数</span>
              </div>
              {dbSizeLoading || dataStats.batchesCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{dataStats.batchesCount ?? 0}</p>
              )}
            </div>
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-violet-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center"><Database className="h-3.5 w-3.5 text-violet-600" /></div>
                <span className="text-xs text-muted-foreground">数据库信息</span>
              </div>
              {dbSizeLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p className="text-xl font-bold text-violet-700 dark:text-violet-400">{dbSize || '计算中...'}</p>
              )}
              {lastBackupFromStorage && (
                <p className="text-[10px] text-muted-foreground mt-0.5">备份于 {lastBackupFromStorage}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
          <TabsTrigger value="dicts">字典管理</TabsTrigger>
          <TabsTrigger value="metal">贵金属市价</TabsTrigger>
          <TabsTrigger value="suppliers">供应商</TabsTrigger>
          <TabsTrigger value="config">系统配置</TabsTrigger>
          <TabsTrigger value="backup">数据备份</TabsTrigger>
          <TabsTrigger value="import">数据导入</TabsTrigger>
        </TabsList>

        <TabsContent value="dicts" className="mt-4">
          <SettingsDictsPanel
            materials={materials}
            types={types}
            tags={tags}
            tagGroups={tagGroups}
            tagGroupFilter={tagGroupFilter}
            setTagGroupFilter={setTagGroupFilter}
            tagMaterialFilter={tagMaterialFilter}
            setTagMaterialFilter={setTagMaterialFilter}
            onShowCreateMaterial={() => { setShowCreateMaterial(true); setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' }); }}
            onOpenEditMaterial={openEditMaterialDialog}
            onToggleMaterialActive={toggleMaterialActive}
            onShowCreateType={() => { setShowCreateType(true); setTypeForm({ name: '', specFields: {} }); }}
            onOpenEditType={openEditTypeDialog}
            onToggleType={handleToggleType}
            onShowCreateTag={() => { setShowCreateTag(true); setTagForm({ name: '', groupName: '' }); }}
            onOpenEditTag={openEditTagDialog}
            onToggleTagActive={toggleTagActive}
          />
        </TabsContent>

        <TabsContent value="metal" className="mt-4">
          <SettingsMetalPanel
            materials={materials}
            onMaterialsChange={setMaterials}
            onPreviewReprice={handlePreviewReprice}
            onPriceHistory={handlePriceHistory}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SettingsSuppliersPanel
            suppliers={suppliers}
            supplierSearch={supplierSearch}
            setSupplierSearch={setSupplierSearch}
            debouncedSupplierSearch={debouncedSupplierSearch}
            onShowCreateSupplier={() => { setShowCreateSupplier(true); setSupplierForm({ name: '', contact: '', phone: '', notes: '' }); }}
            onEditSupplier={openEditSupplierDialog}
            onDeleteSupplier={setDeleteSupplier}
          />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <SettingsConfigPanel
            configs={configs}
            editConfigs={editConfigs}
            setEditConfigs={setEditConfigs}
            systemConfig={systemConfig}
            setSystemConfig={setSystemConfig}
            onUpdateConfig={updateConfig}
            onSaveConfig={handleSaveConfig}
            onResetConfig={handleResetConfig}
          />
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <SettingsBackupPanel
            dataStats={dataStats}
            dbSizeLoading={dbSizeLoading}
            lastBackupFromStorage={lastBackupFromStorage}
            restoreFileInputRef={restoreFileInputRef}
            restoring={restoring}
            deletedItemsCount={deletedItemsCount}
            oldLogsCount={oldLogsCount}
            cleanupLoading={cleanupLoading}
            onDownloadBackup={handleDownloadBackup}
            onRestoreFileSelect={(f) => { setRestoreFile(f); setShowRestoreConfirm(true); }}
            onCleanupDeleted={() => setCleanupConfirm({ type: 'deleted', open: true })}
            onCleanupOldLogs={() => setCleanupConfirm({ type: 'logs', open: true })}
          />
        </TabsContent>

        <TabsContent value="import" className="mt-4 space-y-4">
          <SettingsImportCsvPanel
            csvFile={csvFile}
            setCsvFile={setCsvFile}
            csvImporting={csvImporting}
            csvResult={csvResult}
            csvDragOver={csvDragOver}
            setCsvDragOver={setCsvDragOver}
            onDownloadCsvTemplate={handleDownloadCsvTemplate}
            onCsvImport={handleCsvImport}
          />
          <SettingsImportDataPanel
            importType={importType}
            setImportType={setImportType}
            importFile={importFile}
            importing={importing}
            importResult={importResult}
            autoCreate={autoCreate}
            setAutoCreate={setAutoCreate}
            skipExisting={skipExisting}
            setSkipExisting={setSkipExisting}
            previewData={previewData}
            onFileSelect={handleFileSelect}
            onImport={handleImport}
            downloadTemplateUrl={importApi.downloadTemplate(importType)}
          />
        </TabsContent>
      </Tabs>

      {/* Create Supplier Dialog */}
      <Dialog open={showCreateSupplier} onOpenChange={setShowCreateSupplier}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增供应商</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="供应商名称" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>联系人</Label><Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} placeholder="联系人姓名" /></div>
              <div className="space-y-1"><Label><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />电话</span></Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="手机号码" /></div>
            </div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} placeholder="可选" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSupplier(false)}>取消</Button>
            <Button onClick={handleCreateSupplier} className="bg-emerald-600 hover:bg-emerald-700" disabled={!supplierForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={editSupplier !== null} onOpenChange={open => { if (!open) setEditSupplier(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑供应商</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>联系人</Label><Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} /></div>
              <div className="space-y-1"><Label><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />电话</span></Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplier(null)}>取消</Button>
            <Button onClick={handleUpdateSupplier} className="bg-emerald-600 hover:bg-emerald-700" disabled={!supplierForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Supplier Confirm Dialog */}
      <Dialog open={deleteSupplier !== null} onOpenChange={open => { if (!open) setDeleteSupplier(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除供应商「{deleteSupplier?.name}」吗？此操作不可恢复。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSupplier(null)}>取消</Button>
            <Button onClick={handleDeleteSupplier} className="bg-red-600 hover:bg-red-700">确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Material Dialog */}
      <Dialog open={showCreateMaterial} onOpenChange={setShowCreateMaterial}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增材质</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={materialForm.name} onChange={e => setMaterialForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 和田玉" /></div>
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
            <div className="space-y-1"><Label>克重单价</Label><Input type="number" value={materialForm.costPerGram} onChange={e => setMaterialForm(f => ({ ...f, costPerGram: e.target.value }))} placeholder="如: 500" /></div>
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
            <Button onClick={handleCreateMaterial} className="bg-emerald-600 hover:bg-emerald-700" disabled={!materialForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Material Dialog */}
      <Dialog open={editMaterial !== null} onOpenChange={open => { if (!open) setEditMaterial(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑材质</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={materialForm.name} onChange={e => setMaterialForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>大类</Label>
              <Select value={materialForm.category} onValueChange={v => setMaterialForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择大类" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>子类</Label><Input value={materialForm.subType} onChange={e => setMaterialForm(f => ({ ...f, subType: e.target.value }))} list="subTypeOptionsEdit" /></div>
            <div className="space-y-1"><Label>产地</Label><Input value={materialForm.origin} onChange={e => setMaterialForm(f => ({ ...f, origin: e.target.value }))} list="originOptionsEdit" /></div>
            <div className="space-y-1"><Label>克重单价</Label><Input type="number" value={materialForm.costPerGram} onChange={e => setMaterialForm(f => ({ ...f, costPerGram: e.target.value }))} /></div>
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
            <Button onClick={handleUpdateMaterial} className="bg-emerald-600 hover:bg-emerald-700" disabled={!materialForm.name}>保存修改</Button>
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
                try { await dictsApi.deleteType(editType.id); toast.success(editType.isActive ? '已停用' : '已启用'); const tp = await dictsApi.getTypes(true); setTypes(tp || []); setEditType(null); } catch (e: any) { toast.error(e.message); }
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

      {/* Reprice Preview Dialog */}
      <Dialog open={repricePreview !== null} onOpenChange={open => { if (!open) setRepricePreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>调价预览</DialogTitle><DialogDescription>以下货品将受影响</DialogDescription></DialogHeader>
          {repricePreview && (
            <div className="space-y-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-sm">
                <p>新单价: <span className="font-bold text-emerald-600">¥{repricePreview.newPrice}/克</span></p>
                <p>影响货品: <span className="font-bold">{repricePreview.affectedItems?.length || 0} 件</span></p>
              </div>
              {repricePreview.affectedItems && repricePreview.affectedItems.length > 0 ? (
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>名称</TableHead><TableHead className="text-right">原价</TableHead><TableHead className="text-right">新价</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {repricePreview.affectedItems.map((item: any) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="font-mono text-xs">{item.skuCode}</TableCell>
                          <TableCell className="text-sm">{item.name || '-'}</TableCell>
                          <TableCell className="text-right text-sm">{formatPrice(item.oldPrice)}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-emerald-600">{formatPrice(item.newPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">没有受影响的在库货品</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepricePreview(null)}>取消</Button>
            <Button onClick={handleConfirmReprice} className="bg-emerald-600 hover:bg-emerald-700" disabled={!repricePreview?.affectedItems?.length}>确认调价</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirm Dialog */}
      <Dialog open={showRestoreConfirm} onOpenChange={open => { if (!open) { setShowRestoreConfirm(false); setRestoreFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认恢复数据库</DialogTitle><DialogDescription>即将用文件「{restoreFile?.name}」覆盖当前数据库。恢复前会自动保存当前数据库为安全副本。</DialogDescription></DialogHeader>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">⚠️ 此操作将覆盖当前所有数据！恢复后需要刷新页面。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRestoreConfirm(false); setRestoreFile(null); }}>取消</Button>
            <Button onClick={async () => {
              if (!restoreFile) return;
              setRestoring(true);
              try {
                const result = await backupApi.restore(restoreFile);
                const preName = result?.preRestoreBackupFilename;
                toast.success(preName ? `数据库恢复成功（已先备份: ${preName}），页面将在3秒后刷新` : '数据库恢复成功，页面将在3秒后刷新');
                setShowRestoreConfirm(false);
                setRestoreFile(null);
                setTimeout(() => window.location.reload(), 3000);
              } catch (e: any) { toast.error(e.message || '恢复失败'); } finally { setRestoring(false); }
            }} className="bg-red-600 hover:bg-red-700" disabled={restoring}>
              {restoring && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={showPriceHistory} onOpenChange={setShowPriceHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>价格历史 - {priceHistoryMaterial}</DialogTitle></DialogHeader>
          {priceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无历史记录</p>
          ) : (
            <div className="max-h-72 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader><TableRow><TableHead>日期</TableHead><TableHead className="text-right">单价(元/克)</TableHead><TableHead>操作人</TableHead></TableRow></TableHeader>
                <TableBody>
                  {priceHistory.map((h: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{h.effectiveDate || h.createdAt?.slice(0, 10) || '-'}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">¥{h.pricePerGram}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{h.updatedBy || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowPriceHistory(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cleanup Confirm Dialog */}
      <AlertDialog open={cleanupConfirm.open} onOpenChange={open => setCleanupConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认数据清理</AlertDialogTitle>
            <AlertDialogDescription>
              {cleanupConfirm.type === 'deleted'
                ? `确定要彻底删除 ${deletedItemsCount} 条已标记删除的货品记录吗？此操作不可撤销。`
                : `确定要清除 ${oldLogsCount} 条超过30天的操作日志吗？此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCleanupConfirm(prev => ({ ...prev, open: false }))}>取消</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => cleanupConfirm.type === 'deleted' ? handleCleanupDeleted() : handleCleanupOldLogs()}
              disabled={cleanupLoading !== null}
            >
              {cleanupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              确认清理
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SettingsTab;
export { SPEC_FIELD_LABEL_MAP, MATERIAL_CATEGORIES, parseSpecFields, formatSpecFieldsDisplay };