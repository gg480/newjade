'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { logsApi } from '@/lib/api';
import { toast } from 'sonner';
import { EmptyState, LoadingSkeleton } from './shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { ScrollText, RefreshCw, Filter, Clock, User, Target, FileText, Plus, Pencil, Trash2, ShoppingCart, RotateCcw, LogIn, Copy, Check, Search, X, FileDown } from 'lucide-react';
import Pagination from './pagination';

// Action type config with labels, colors, icons and border colors
const ACTION_CONFIG: Record<string, { label: string; color: string; icon: string; border: string; iconComponent: React.ElementType }> = {
  create_item: { label: '入库', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', icon: '📦', border: 'border-l-emerald-500', iconComponent: Plus },
  edit_item: { label: '编辑', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: '✏️', border: 'border-l-amber-500', iconComponent: Pencil },
  delete_item: { label: '删除', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: '🗑️', border: 'border-l-red-500', iconComponent: Trash2 },
  sell_item: { label: '出库', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200', icon: '💰', border: 'border-l-sky-500', iconComponent: ShoppingCart },
  return_sale: { label: '退货', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: '↩️', border: 'border-l-orange-500', iconComponent: RotateCcw },
  allocate_batch: { label: '分摊', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '📊', border: 'border-l-purple-500', iconComponent: FileText },
  login: { label: '登录', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '🔐', border: 'border-l-purple-500', iconComponent: LogIn },
};

// Icon color map for action type icons
const ACTION_ICON_COLORS: Record<string, string> = {
  create_item: 'text-emerald-600',
  edit_item: 'text-amber-600',
  delete_item: 'text-red-600',
  sell_item: 'text-sky-600',
  return_sale: 'text-orange-500',
  allocate_batch: 'text-purple-600',
  login: 'text-purple-600',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  item: '货品',
  batch: '批次',
  sale: '销售',
  customer: '客户',
  supplier: '供应商',
};

const ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  ...Object.entries(ACTION_CONFIG).map(([value, { label }]) => ({ value, label })),
];

// Relative time helper
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '-';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  if (diffMonth < 12) return `${diffMonth}个月前`;
  return `${diffYear}年前`;
}

function ActionBadge({ action }: { action: string }) {
  const config = ACTION_CONFIG[action];
  if (!config) return <Badge variant="secondary">{action}</Badge>;
  const IconComp = config.iconComponent;
  const iconColor = ACTION_ICON_COLORS[action] || 'text-gray-500';
  return (
    <Badge variant="secondary" className={`${config.color} flex items-center gap-1`}>
      <IconComp className={`h-3 w-3 ${iconColor}`} />
      {config.label}
    </Badge>
  );
}

function ActionBorder({ action }: { action: string }) {
  const config = ACTION_CONFIG[action];
  const iconColor = ACTION_ICON_COLORS[action] || 'text-gray-500';
  const IconComp = config?.iconComponent || FileText;
  return (
    <div className={`flex items-center justify-center w-7 shrink-0 ${iconColor}`}>
      <IconComp className="h-3.5 w-3.5" />
    </div>
  );
}

// ========== Logs Tab ==========
function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchLogs = useCallback(async (page = pagination.page) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: 20 };
      if (actionFilter) params.action = actionFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (searchText.trim()) params.search = searchText.trim();
      const data = await logsApi.getLogs(params);
      setLogs(data?.items || []);
      setPagination(data?.pagination || { total: 0, page: 1, size: 20, pages: 0 });
    } catch {
      toast.error('加载操作日志失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, actionFilter, startDate, endDate, searchText]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => fetchLogs(pagination.page), 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchLogs, pagination.page]);

  // Count active filters
  const activeFilterCount = [
    actionFilter,
    startDate,
    endDate,
    searchText.trim(),
  ].filter(Boolean).length;

  function handleFilter() {
    setPagination(p => ({ ...p, page: 1 }));
    fetchLogs(1);
  }

  function handleReset() {
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setSearchText('');
    setPagination(p => ({ ...p, page: 1 }));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleFilter();
    }
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function handleCopyDetail(text: string, id: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {
      toast.error('复制失败');
    });
  }

  // ========== CSV Export ==========
  function handleExportCSV() {
    if (logs.length === 0) {
      toast.error('没有可导出的日志');
      return;
    }
    const actionLabels: Record<string, string> = {
      create_item: '入库', edit_item: '编辑', delete_item: '删除',
      sell_item: '出库', return_sale: '退货', allocate_batch: '分摊', login: '登录',
    };
    const escape = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    const targetLabels: Record<string, string> = { item: '货品', batch: '批次', sale: '销售', customer: '客户', supplier: '供应商' };
    const header = '时间,操作,类型,详情';
    const rows = logs.map((log: any) => {
      const time = log.createdAt || '';
      const action = actionLabels[log.action] || log.action || '';
      const type = targetLabels[log.targetType] || log.targetType || '';
      const detail = log.detail || '';
      return [escape(time), escape(action), escape(type), escape(detail)].join(',');
    });
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `操作日志_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${logs.length} 条操作日志`);
  }

  if (loading && logs.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Filter Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            筛选条件
            {activeFilterCount > 0 && (
              <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 h-5 px-1.5 text-[10px] font-bold">
                筛选中 {activeFilterCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">操作类型</span>
              <Select value={actionFilter || '_all'} onValueChange={v => setActionFilter(v === '_all' ? '' : v)}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value || '_all'} value={opt.value || '_all'}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">开始日期</span>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">结束日期</span>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">搜索</span>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="搜索详情内容..."
                  className="w-40 h-9 pl-7 pr-7"
                />
                {searchText && (
                  <button
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => { setSearchText(''); }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700" onClick={handleFilter}>
              <Search className="h-3 w-3 mr-1" />搜索
            </Button>
            {activeFilterCount > 0 && (
              <Button size="sm" variant="outline" className="h-9 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700" onClick={handleReset}>
                <X className="h-3 w-3 mr-1" />清除筛选
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-9" onClick={handleReset}>重置</Button>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant={autoRefresh ? 'default' : 'outline'}
                className={`h-9 text-xs ${autoRefresh ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <Clock className="h-3 w-3 mr-1" />
                {autoRefresh ? '自动刷新中' : '自动刷新'}
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => fetchLogs(pagination.page)}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <ScrollText className="h-4 w-4" />
        <span>共 {pagination.total} 条操作日志</span>
        {autoRefresh && <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">每10秒刷新</Badge>}
        <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={handleExportCSV} disabled={logs.length === 0}>
          <FileDown className="h-3 w-3 mr-1" />导出CSV
        </Button>
      </div>

      {/* Logs - Desktop Table */}
      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="暂无操作日志" desc="系统操作将自动记录到此处" />
      ) : (
        <>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">时间</TableHead>
                      <TableHead className="w-24">操作类型</TableHead>
                      <TableHead className="w-24">对象类型</TableHead>
                      <TableHead className="w-20">对象ID</TableHead>
                      <TableHead>详情</TableHead>
                      <TableHead className="w-24">操作人</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any) => {
                      const actionBorder = ACTION_CONFIG[log.action]?.border || 'border-l-gray-400';
                      return (
                      <TableRow key={log.id} className={`hover:bg-muted/50 transition-colors border-l-2 ${actionBorder}`}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span title={formatTime(log.createdAt)}>{formatRelativeTime(log.createdAt)}</span>
                        </TableCell>
                        <TableCell><ActionBadge action={log.action} /></TableCell>
                        <TableCell className="text-sm">{TARGET_TYPE_LABELS[log.targetType] || log.targetType || '-'}</TableCell>
                        <TableCell className="text-sm font-mono">{log.targetId || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={log.detail || ''}>
                          <div className="flex items-center gap-1">
                            <span className="truncate flex-1">{log.detail || '-'}</span>
                            {log.detail && (
                              <button
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => { e.stopPropagation(); handleCopyDetail(log.detail, log.id); }}
                                title="复制详情"
                              >
                                {copiedId === log.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{log.operator || '系统'}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {logs.map((log: any) => {
              const actionBorder = ACTION_CONFIG[log.action]?.border || 'border-l-gray-400';
              return (
              <Card key={log.id} className={`hover:shadow-sm transition-shadow border-l-2 ${actionBorder}`}>
                <CardContent className="p-3 space-y-2">
                  {/* Top: action badge + time */}
                  <div className="flex items-center justify-between">
                    <ActionBadge action={log.action} />
                    <span className="text-xs text-muted-foreground" title={formatDate(log.createdAt)}>{formatRelativeTime(log.createdAt)}</span>
                  </div>
                  {/* Target info */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Target className="h-3 w-3" />{TARGET_TYPE_LABELS[log.targetType] || log.targetType || '-'}</span>
                    <span className="font-mono">#{log.targetId || '-'}</span>
                    {log.operator && <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.operator}</span>}
                  </div>
                  {/* Detail */}
                  {log.detail && (
                    <div className="flex items-start gap-1">
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2 line-clamp-2 flex items-start gap-1 flex-1">
                        <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="truncate">{log.detail}</span>
                      </p>
                      <button
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-1"
                        onClick={() => handleCopyDetail(log.detail, log.id)}
                        title="复制详情"
                      >
                        {copiedId === log.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      <Pagination page={pagination.page} pages={pagination.pages} onPageChange={p => { setPagination(prev => ({ ...prev, page: p })); fetchLogs(p); }} />
    </div>
  );
}

export default LogsTab;
