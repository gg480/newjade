'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dictsApi, configApi, suppliersApi, metalApi, backupApi, importApi, request } from '@/lib/api';
import type { DictMaterial, DictType, DictTag, MetalPrice, SysConfig, ImportResult } from '@/lib/api.types';
import { MATERIAL_CATEGORIES } from '@/lib/constants';
import { toast } from 'sonner';
import { formatPrice, EmptyState, LoadingSkeleton } from './shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog';

import {
  Plus, Pencil, Trash2, Factory, Calculator, History, Download, Upload,
  AlertTriangle, Loader2, FileSpreadsheet, FileDown, CheckCircle, XCircle, Clock,
  Gem, Box, Tag, DollarSign, Settings, ShieldCheck, Search, X, Hash, Crown, Lock,
} from 'lucide-react';

// Panel imports
import SettingsDictsPanel from './settings/settings-dicts-panel';
import SettingsMetalPanel from './settings/settings-metal-panel';
import SettingsSuppliersPanel from './settings/settings-suppliers-panel';
import SettingsConfigPanel from './settings/settings-config-panel';
import PasswordPanel from './settings/settings-password-panel';
import SettingsBackupPanel from './settings/settings-backup-panel';
import SettingsImportPanel from './settings/settings-import-panel';
import UsersPanel from './settings/users-panel';
import RolesPanel from './settings/roles-panel';
import { SettingsProvider } from './settings/settings-context';

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

  // Supplier dialog states — moved to SettingsSuppliersPanel
  // Dict dialog states — moved to SettingsDictsPanel
  // Metal reprice states — moved to SettingsMetalPanel

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

  const [lastBackupFromStorage, setLastBackupFromStorage] = useState<string | null>(null);

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

  // 从服务器 configs 同步所有系统配置到本地状态
  // localStorage 仅作为离线回退
  useEffect(() => {
    const storeNameConfig = configs.find(c => c.key === 'store_name');
    const warningDaysConfig = configs.find(c => c.key === 'warning_days');
    const currencySymbolConfig = configs.find(c => c.key === 'currency_symbol');
    const profitWarningConfig = configs.find(c => c.key === 'profit_warning_threshold');
    const defaultProfitConfig = configs.find(c => c.key === 'default_profit_rate');

    setSystemConfig(prev => ({
      ...prev,
      storeName: storeNameConfig?.value || prev.storeName,
      lowStockDays: warningDaysConfig?.value && !isNaN(parseInt(warningDaysConfig.value))
        ? parseInt(warningDaysConfig.value) : prev.lowStockDays,
      currencySymbol: currencySymbolConfig?.value || prev.currencySymbol,
      profitWarningThreshold: profitWarningConfig?.value && !isNaN(parseInt(profitWarningConfig.value))
        ? parseInt(profitWarningConfig.value) : prev.profitWarningThreshold,
      defaultProfitRate: defaultProfitConfig?.value && !isNaN(parseInt(defaultProfitConfig.value))
        ? parseInt(defaultProfitConfig.value) : prev.defaultProfitRate,
    }));
    const editMap: Record<string, string> = {};
    configs.forEach(c => { editMap[c.key] = c.value; });
    setEditConfigs(editMap);
  }, [configs]);

  // Fetch data cleanup counts
  useEffect(() => {
    async function fetchCleanupCounts() {
      try {
        const [delRes, logRes] = await Promise.allSettled([
          request<{ count: number }>('/items/cleanup-deleted'),
          request<{ count: number }>('/logs/cleanup-old'),
        ]);
        if (delRes.status === 'fulfilled') {
          setDeletedItemsCount(delRes.value.count || 0);
        }
        if (logRes.status === 'fulfilled') {
          setOldLogsCount(logRes.value.count || 0);
        }
      } catch (e) { console.error('[SettingsTab]', e); /* silently fail */ }
    }
    fetchCleanupCounts();
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

  async function updateConfig(key: string, value: string) {
    try {
      await configApi.updateConfig(key, value);
      setConfigs(c => c.map(x => x.key === key ? { ...x, value } : x));
      setEditConfigs(prev => ({ ...prev, [key]: value }));
      toast.success('配置已更新');
      // 通知其他组件配置已变更（如定价计算、行情模块可监听此事件刷新数据）
      window.dispatchEvent(new CustomEvent('config-changed', { detail: { key, value } }));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '操作失败'); }
  }

  // Supplier handlers
  async function fetchSuppliers() {
    try { const s = await suppliersApi.getSuppliers(); setSuppliers(s?.items || []); } catch (e) { console.error('[SettingsTab]', e); toast.error('加载供应商失败'); }
  }

  // Supplier handlers — moved to SettingsSuppliersPanel

  // Data cleanup handlers
  async function handleCleanupDeleted() {
    setCleanupLoading('deleted');
    try {
      const result = await request<{ deleted: number }>('/items/cleanup-deleted', { method: 'DELETE' });
      toast.success(`已清除 ${result.deleted} 条已删除货品`);
      setDeletedItemsCount(0);
      // 数据统计已迁移到 Dashboard，此处不再更新
    } catch (e) { console.error('[SettingsTab]', e); toast.error('清除已删除货品失败'); } finally {
      setCleanupLoading(null);
      setCleanupConfirm({ type: 'deleted', open: false });
    }
  }

  async function handleCleanupOldLogs() {
    setCleanupLoading('logs');
    try {
      const result = await request<{ deleted: number }>('/logs/cleanup-old', { method: 'DELETE' });
      toast.success(`已清除 ${result.deleted} 条30天前的操作日志`);
      setOldLogsCount(0);
    } catch (e) { console.error('[SettingsTab]', e); toast.error('清除操作日志失败'); } finally {
      setCleanupLoading(null);
      setCleanupConfirm({ type: 'logs', open: false });
    }
  }

  // Dict handlers — moved to SettingsDictsPanel
  // Metal reprice handlers — moved to SettingsMetalPanel

  // Import handlers
  function handleFileSelect(file: File | null) {
    if (!file) {
      setImportFile(null);
      setPreviewData(null);
      return;
    }
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
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '导入失败'); } finally { setImporting(false); }
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
      const resultExt = result as ImportResult & { duplicated?: number };
      if (resultExt.duplicated > 0) parts.push(`重复跳过${resultExt.duplicated}件`);
      if (result.skipped > 0) parts.push(`跳过${result.skipped}行`);
      if (result.errors.length === 0) {
        toast.success(`CSV导入完成: ${parts.join('，')}`);
      } else {
        toast.warning(`CSV导入完成: ${parts.join('，')}，${result.errors.length}行错误`);
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'CSV导入失败'); } finally { setCsvImporting(false); }
  }

  // Backup download handler
  async function handleDownloadBackup() {
    try {
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(backupApi.download(), { headers });
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
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '备份下载失败'); }
  }

  // Config save handler — 将所有配置批量保存到服务器
  // localStorage 不再作为主要存储，仅作为离线回退
  async function handleSaveConfig() {
    const currentConfigs: Record<string, string> = {
      store_name: systemConfig.storeName,
      warning_days: String(systemConfig.lowStockDays),
      currency_symbol: systemConfig.currencySymbol,
      profit_warning_threshold: String(systemConfig.profitWarningThreshold),
      default_profit_rate: String(systemConfig.defaultProfitRate),
    };
    const tasks: Promise<unknown>[] = [];
    for (const [key, value] of Object.entries(currentConfigs)) {
      const existing = configs.find(c => c.key === key)?.value;
      if (value !== existing) {
        tasks.push(configApi.updateConfig(key, value));
      }
    }
    if (tasks.length === 0) {
      toast.success('设置已保存');
      return;
    }
    try {
      await Promise.all(tasks);
      // 同步本地状态
      const updatedConfigs = configs.map(c => {
        const newVal = currentConfigs[c.key];
        return newVal !== undefined ? { ...c, value: newVal } : c;
      });
      setConfigs(updatedConfigs);
      setEditConfigs(prev => ({ ...prev, ...currentConfigs }));
      toast.success('设置已保存');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存设置失败');
    }
  }

  async function handleResetConfig() {
    const defaults = { storeName: '兴盛艺珠宝', currencySymbol: '¥', lowStockDays: 90, profitWarningThreshold: 30, defaultProfitRate: 40 };
    try {
      await Promise.all([
        configApi.updateConfig('store_name', defaults.storeName),
        configApi.updateConfig('warning_days', String(defaults.lowStockDays)),
        configApi.updateConfig('currency_symbol', defaults.currencySymbol),
        configApi.updateConfig('profit_warning_threshold', String(defaults.profitWarningThreshold)),
        configApi.updateConfig('default_profit_rate', String(defaults.defaultProfitRate)),
      ]);
      setSystemConfig(defaults);
      const defaultConfigMap: Record<string, string> = {
        store_name: defaults.storeName,
        warning_days: String(defaults.lowStockDays),
        currency_symbol: defaults.currencySymbol,
        profit_warning_threshold: String(defaults.profitWarningThreshold),
        default_profit_rate: String(defaults.defaultProfitRate),
      };
      setConfigs(c => c.map(x =>
        defaultConfigMap[x.key] !== undefined ? { ...x, value: defaultConfigMap[x.key] } : x
      ));
      setEditConfigs(prev => ({ ...prev, ...defaultConfigMap }));
      toast.success('已恢复默认设置');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '恢复默认设置失败');
    }
  }

  const refreshMethods = useMemo(() => ({
    materials,
    types,
    tags,
    configs,
    suppliers,
    refreshMaterials: async () => {
      const m = await dictsApi.getMaterials(true);
      setMaterials(m || []);
    },
    refreshTypes: async () => {
      const t = await dictsApi.getTypes(true);
      setTypes(t || []);
    },
    refreshTags: async (materialId?: number) => {
      const tg = await dictsApi.getTags(undefined, true, materialId);
      setTags(tg || []);
    },
    refreshConfigs: async () => {
      const c = await configApi.getConfig();
      setConfigs(c || []);
    },
    refreshSuppliers: async () => {
      const s = await suppliersApi.getSuppliers();
      setSuppliers(s?.items || []);
    },
  }), [materials, types, tags, configs, suppliers]);

  if (loading) {
    return (
      <SettingsProvider value={refreshMethods}>
        <LoadingSkeleton />
      </SettingsProvider>
    );
  }

  return (
    <SettingsProvider value={refreshMethods}>
    <div className="space-y-4">

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid grid-cols-5 sm:grid-cols-9 w-full">
          <TabsTrigger value="dicts">字典管理</TabsTrigger>
          <TabsTrigger value="metal-precious">贵金属市价</TabsTrigger>
          <TabsTrigger value="suppliers">供应商</TabsTrigger>
          <TabsTrigger value="config">系统配置</TabsTrigger>
          <TabsTrigger value="backup">数据备份</TabsTrigger>
          <TabsTrigger value="import">数据导入</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="roles">角色管理</TabsTrigger>
        </TabsList>

        <TabsContent value="dicts" className="mt-4">
          <SettingsDictsPanel />
        </TabsContent>

        <TabsContent value="metal-precious" className="mt-4">
          <SettingsMetalPanel />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SettingsSuppliersPanel />
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
          <PasswordPanel />
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <SettingsBackupPanel
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

        <TabsContent value="import" className="mt-4">
          <SettingsImportPanel
            csvFile={csvFile}
            setCsvFile={setCsvFile}
            csvImporting={csvImporting}
            csvResult={csvResult}
            csvDragOver={csvDragOver}
            setCsvDragOver={setCsvDragOver}
            onDownloadCsvTemplate={handleDownloadCsvTemplate}
            onCsvImport={handleCsvImport}
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

        <TabsContent value="users" className="mt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesPanel />
        </TabsContent>
      </Tabs>

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
              } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '恢复失败'); } finally { setRestoring(false); }
            }} className="bg-red-600 hover:bg-red-700" disabled={restoring}>
              {restoring && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              确认恢复
            </Button>
          </DialogFooter>
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
    </SettingsProvider>
  );
}

export default SettingsTab;
export { SPEC_FIELD_LABEL_MAP, MATERIAL_CATEGORIES, parseSpecFields, formatSpecFieldsDisplay };