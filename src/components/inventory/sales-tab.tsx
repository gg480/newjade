'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { salesApi, exportApi, dashboardApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, StatusBadge, EmptyState, LoadingSkeleton } from './shared';
import { useAppStore } from '@/lib/store';
import BundleSaleDialog from './bundle-sale-dialog';
import Pagination from './pagination';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

import { Checkbox } from '@/components/ui/checkbox';
import {
  ShoppingCart, TrendingUp, DollarSign, BarChart3, Search, Link2, FileDown, RotateCcw, Store, MessageCircle,
  CalendarDays, ArrowUp, ArrowDown, CreditCard, ChevronDown, ChevronUp, Printer, Gem, User, Phone, Tag, AlertTriangle, X, Package, XIcon, Eye,
} from 'lucide-react';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// Payment method config
const PAYMENT_METHODS = [
  { value: '现款', label: '现款', icon: '💰', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
  { value: '转账', label: '转账', icon: '🏦', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-300 dark:border-sky-700' },
  { value: '微信', label: '微信', icon: '💬', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
  { value: '支付宝', label: '支付宝', icon: '📱', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-300 dark:border-sky-700' },
  { value: '分期', label: '分期', icon: '📋', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
];

function getPaymentMethod(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/^\[支付:([^\]]+)\]\s*/);
  return match ? match[1] : null;
}

function getPaymentNote(note: string | null | undefined): string {
  if (!note) return '';
  const cleaned = note.replace(/^\[支付:[^\]]+\]\s*/, '');
  return cleaned.trim();
}

function formatPaymentBadge(note: string | null | undefined) {
  const method = getPaymentMethod(note);
  if (!method) return null;
  const config = PAYMENT_METHODS.find(m => m.value === method);
  if (!config) return null;
  return <Badge variant="outline" className={`text-xs ${config.color}`}>{config.icon} {config.label}</Badge>;
}

// ========== Sales Tab ==========
function SalesTab() {
  const [sales, setSales] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ channel: '', startDate: '', endDate: '', keyword: '' });
  const [showBundle, setShowBundle] = useState(false);
  const [datePreset, setDatePreset] = useState('all');

  // Return dialog state
  const [returnDialog, setReturnDialog] = useState<{ open: boolean; sale: any }>({ open: false, sale: null });
  const [returnForm, setReturnForm] = useState({ refundAmount: 0, returnReason: '', returnDate: new Date().toISOString().slice(0, 10) });
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const RETURN_REASONS = [
    { value: '质量问题', label: '质量问题', color: 'text-red-600' },
    { value: '尺寸不合适', label: '尺寸不合适', color: 'text-amber-600' },
    { value: '客户反悔', label: '客户反悔', color: 'text-sky-600' },
    { value: '其他', label: '其他', color: 'text-gray-600' },
  ];

  // Expanded sale row
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  // Batch selection state
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(new Set());

  // Print receipt dialog
  const [printSale, setPrintSale] = useState<any>(null);

  // Sale detail panel
  const [detailSale, setDetailSale] = useState<any>(null);

  // Today stats
  const [todayStats, setTodayStats] = useState<{ count: number; revenue: number; profit: number } | null>(null);

  // Sparkline data
  const [sparklineData, setSparklineData] = useState<any[]>([]);
  const [sparkLoading, setSparkLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, size: pagination.size };
      if (filters.channel) params.channel = filters.channel;
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;
      if (filters.keyword) params.keyword = filters.keyword;
      const data = await salesApi.getSales(params);
      setSales(data.items || []);
      setPagination(data.pagination || { total: 0, page: 1, size: 20, pages: 0 });
    } catch { toast.error('加载销售记录失败'); } finally { setLoading(false); }
  }, [pagination.page, pagination.size, filters]);

  // Fetch today's stats separately
  useEffect(() => {
    async function fetchTodayStats() {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const data = await salesApi.getSales({ start_date: todayStr, end_date: todayStr, size: 1000 });
        const todayItems = data.items || [];
        setTodayStats({
          count: todayItems.length,
          revenue: todayItems.reduce((sum: number, s: any) => sum + (s.actualPrice || 0), 0),
          profit: todayItems.reduce((sum: number, s: any) => sum + (s.grossProfit || 0), 0),
        });
      } catch { setTodayStats({ count: 0, revenue: 0, profit: 0 }); }
    }
    fetchTodayStats();
  }, []);

  const fetchSparkline = useCallback(async () => {
    setSparkLoading(true);
    try {
      const trend = await dashboardApi.getTrend({ months: 1 });
      if (trend && trend.length > 0) {
        setSparklineData(trend.map((t: any) => ({
          date: t.yearMonth || t.date || t.label,
          revenue: t.revenue || 0,
          profit: t.profit || 0,
        })));
      } else {
        setSparklineData([]);
      }
    } catch {
      setSparklineData([]);
    } finally { setSparkLoading(false); }
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => { fetchSparkline(); }, [fetchSparkline]);

  if (loading && sales.length === 0) return <LoadingSkeleton />;

  const totalRevenue = sales.reduce((s, sale) => s + (sale.actualPrice || 0), 0);
  const totalProfit = sales.reduce((s, sale) => s + (sale.grossProfit || 0), 0);
  const storeCount = sales.filter(s => s.channel === 'store').length;
  const wechatCount = sales.filter(s => s.channel === 'wechat').length;

  // Return handler
  function openReturnDialog(sale: any) {
    setReturnDialog({ open: true, sale });
    setReturnForm({ refundAmount: sale.actualPrice || 0, returnReason: '', returnDate: new Date().toISOString().slice(0, 10) });
  }

  function toggleExpand(saleId: number) {
    setExpandedSaleId(prev => prev === saleId ? null : saleId);
  }

  // Batch selection handlers
  function toggleSelectSale(id: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setSelectedSaleIds(prev => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedSaleIds.size === sales.length) {
      setSelectedSaleIds(new Set());
    } else {
      setSelectedSaleIds(new Set(sales.map(s => String(s.id))));
    }
  }

  function handleBatchExportCSV() {
    const selectedSales = sales.filter(s => selectedSaleIds.has(String(s.id)));
    if (selectedSales.length === 0) {
      toast.error('没有选中的记录');
      return;
    }
    const headers = ['销售日期', 'SKU', '货品名称', '客户', '售价', '成本', '利润', '渠道', '柜台号'];
    const channelMap: Record<string, string> = { store: '门店', wechat: '微信' };
    const rows = selectedSales.map((s: any) => [
      s.saleDate || '',
      s.itemSku || '',
      s.itemName || s.itemSku || '',
      s.customerName || '',
      s.actualPrice || 0,
      s.costPrice || 0,
      s.grossProfit || 0,
      channelMap[s.channel] || s.channel || '',
      s.counter || '',
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map((cell: any) => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `选中销售记录_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${selectedSales.length} 条选中记录`);
  }

  function handlePrintReceipt(sale: any) {
    setPrintSale(sale);
    setTimeout(() => window.print(), 300);
  }

  function handleExportCSV() {
    const dataToExport = sales.length > 0 ? sales : [];
    if (dataToExport.length === 0) {
      toast.error('没有可导出的销售数据');
      return;
    }
    const headers = ['销售日期', 'SKU', '货品名称', '客户', '售价', '成本', '利润', '渠道', '柜台号'];
    const channelMap: Record<string, string> = { store: '门店', wechat: '微信' };
    const rows = dataToExport.map((s: any) => [
      s.saleDate || '',
      s.itemSku || '',
      s.itemName || s.itemSku || '',
      s.customerName || '',
      s.actualPrice || 0,
      s.costPrice || 0,
      s.grossProfit || 0,
      channelMap[s.channel] || s.channel || '',
      s.counter || '',
    ]);
    // Add BOM for Excel UTF-8 compatibility
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map((cell: any) => {
      const str = String(cell);
      // Escape quotes and wrap if contains comma/quote/newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `销售记录_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${dataToExport.length} 条销售记录`);
  }

  async function handleReturn() {
    if (!returnDialog.sale) return;
    try {
      await salesApi.returnSale({
        saleId: returnDialog.sale.id,
        refundAmount: returnForm.refundAmount,
        returnReason: returnForm.returnReason || '客户退货',
        returnDate: returnForm.returnDate,
      });
      toast.success(`退货成功！已退款 ¥${returnForm.refundAmount.toFixed(2)}`);
      setReturnDialog({ open: false, sale: null });
      fetchSales();
    } catch (e: any) { toast.error(e.message || '退货失败'); }
  }

  function formatChannelBadge(channel: string) {
    if (!channel) return null;
    if (channel === 'store') return <Badge variant="outline" className="border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30"><Store className="h-2.5 w-2.5 mr-1" />门店</Badge>;
    if (channel === 'wechat') return <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"><MessageCircle className="h-2.5 w-2.5 mr-1" />微信</Badge>;
    return <Badge variant="outline">{channel}</Badge>;
  }

  function handleDatePreset(preset: string) {
    setDatePreset(preset);
    const today = new Date();
    let start = '';
    let end = today.toISOString().slice(0, 10);
    switch (preset) {
      case 'today': start = end; break;
      case 'week': {
        // 本周: Monday to today
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(today.getTime() - mondayOffset * 86400000).toISOString().slice(0, 10);
        break;
      }
      case 'month': start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10); break;
      case 'lastMonth': start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10); end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10); break;
      case 'quarter': start = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10); break;
      case 'year': start = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10); break;
      case 'days30': start = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10); break;
      case 'days90': start = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10); break;
      case 'thisYear': start = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10); break;
      default: start = ''; end = '';
    }
    setFilters(f => ({ ...f, startDate: start, endDate: end }));
  }

  return (
    <div className="space-y-6">
      {/* Today Stats Row */}
      {todayStats && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">今日销售数</p>
              <p className="text-xl font-bold">{todayStats.count} <span className="text-xs font-normal text-muted-foreground">件</span></p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-sky-500 hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">今日营收</p>
              <p className="text-xl font-bold text-emerald-600">{formatPrice(todayStats.revenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">今日利润</p>
              <p className={`text-xl font-bold ${todayStats.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPrice(todayStats.profit)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profit Summary Bar */}
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium">利润汇总</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg">
              <p className="text-xs text-muted-foreground">总销售额</p>
              <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatPrice(totalRevenue)}</p>
            </div>
            <div className="text-center p-3 bg-sky-50/50 dark:bg-sky-950/20 rounded-lg">
              <p className="text-xs text-muted-foreground">总成本</p>
              <p className="text-xl font-bold tabular-nums">{formatPrice(sales.reduce((s, sale) => s + (sale.costPrice || 0), 0))}</p>
            </div>
            <div className="text-center p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
              <p className="text-xs text-muted-foreground">总毛利</p>
              <p className={`text-xl font-bold tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPrice(totalProfit)}</p>
            </div>
            <div className="text-center p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg">
              <p className="text-xs text-muted-foreground">平均毛利率</p>
              <p className="text-xl font-bold tabular-nums">{totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md hover:border-emerald-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><DollarSign className="h-16 w-16 text-emerald-500" /></div>
            <p className="text-sm text-muted-foreground">销售件数</p>
            <p className="text-2xl font-bold">{pagination.total}</p>
            <p className="text-xs text-muted-foreground">门店 {storeCount} · 微信 {wechatCount}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md hover:border-sky-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><TrendingUp className="h-16 w-16 text-sky-500" /></div>
            <p className="text-sm text-muted-foreground">客单价</p>
            <p className="text-2xl font-bold text-sky-600">{pagination.total > 0 ? formatPrice(totalRevenue / pagination.total) : '-'}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md hover:border-amber-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><ShoppingCart className="h-16 w-16 text-amber-500" /></div>
            <p className="text-sm text-muted-foreground">最高利润</p>
            <p className="text-2xl font-bold text-emerald-600">{sales.length > 0 ? formatPrice(Math.max(...sales.map((s: any) => s.grossProfit || 0))) : '-'}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md hover:border-purple-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><BarChart3 className="h-16 w-16 text-purple-500" /></div>
            <p className="text-sm text-muted-foreground">利润率范围</p>
            <p className="text-2xl font-bold tabular-nums">{(() => {
              const margins = sales.filter((s: any) => s.actualPrice > 0).map((s: any) => ((s.grossProfit || 0) / s.actualPrice) * 100);
              if (margins.length === 0) return '-';
              return `${Math.min(...margins).toFixed(0)}%-${Math.max(...margins).toFixed(0)}%`;
            })()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          {/* Quick date range */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {[
              { key: 'today', label: '今天' },
              { key: 'week', label: '本周' },
              { key: 'month', label: '本月' },
              { key: 'lastMonth', label: '上月' },
              { key: 'quarter', label: '本季度' },
              { key: 'days30', label: '近30天' },
              { key: 'all', label: '全部' },
            ].map(p => (
              <Button
                key={p.key}
                size="sm"
                variant={datePreset === p.key ? 'default' : 'outline'}
                className={`h-7 text-xs ${datePreset === p.key ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                onClick={() => handleDatePreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1"><Label className="text-xs">关键词</Label><Input placeholder="SKU/单号/客户" value={filters.keyword} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">渠道</Label>
              <Select value={filters.channel || 'all'} onValueChange={v => setFilters(f => ({ ...f, channel: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="store">门店</SelectItem><SelectItem value="wechat">微信</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">开始日期</Label><Input type="date" value={filters.startDate} onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value })); setDatePreset('custom'); }} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">结束日期</Label><Input type="date" value={filters.endDate} onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value })); setDatePreset('custom'); }} className="h-9" /></div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchSales(); }} className="h-9"><Search className="h-3 w-3 mr-1" />搜索</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={() => setShowBundle(true)}><Link2 className="h-3 w-3 mr-1" />套装销售</Button>
            <Button size="sm" variant="outline" className="h-9 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={handleExportCSV} disabled={sales.length === 0}><FileDown className="h-3 w-3 mr-1" />导出CSV</Button>
            <a href={exportApi.sales()} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-9"><FileDown className="h-3 w-3 mr-1" />导出</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table - Desktop */}
      {sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.05) 0%, rgba(6,182,212,0.05) 50%, rgba(5,150,105,0.08) 100%)' }}>
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6 animate-bounce" style={{ animationDuration: '2s' }}>
            <ShoppingCart className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">暂无销售记录</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">开始第一笔销售吧！在库存中选择货品进行出库</p>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => useAppStore.getState().setActiveTab('inventory')}
          >
            <Package className="h-4 w-4 mr-2" />
            前往库存
          </Button>
        </div>
      ) : (
        <>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><Checkbox checked={sales.length > 0 && selectedSaleIds.size === sales.length} onCheckedChange={toggleSelectAll} /></TableHead>
                      <TableHead>销售单号</TableHead><TableHead>SKU</TableHead><TableHead>渠道</TableHead><TableHead>支付方式</TableHead><TableHead>货品</TableHead>
                      <TableHead className="text-right">成交价</TableHead>
                      <TableHead>日期</TableHead><TableHead>客户</TableHead><TableHead className="text-right">毛利</TableHead>
                      <TableHead className="text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map(sale => {
                      const profit = sale.grossProfit || 0;
                      const isProfit = profit > 0;
                      const isLoss = profit < 0;
                      const rowBg = isProfit ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : isLoss ? 'bg-red-50/50 dark:bg-red-950/20' : '';
                      const isExpanded = expandedSaleId === sale.id;
                      const marginPct = sale.actualPrice > 0 ? ((profit / sale.actualPrice) * 100).toFixed(1) : '0.0';
                      return (
                      <React.Fragment key={sale.id}>
                      <TableRow className={`hover:bg-muted/50 transition-all duration-150 cursor-pointer ${rowBg} ${selectedSaleIds.has(String(sale.id)) ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''}`} onClick={() => toggleExpand(sale.id)}>
                        <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedSaleIds.has(String(sale.id))} onCheckedChange={() => toggleSelectSale(sale.id)} /></TableCell>
                        <TableCell className="font-mono text-xs"><div className="flex items-center gap-1.5">{isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}{sale.saleNo}</div></TableCell>
                        <TableCell className="font-mono text-xs">{sale.itemSku}</TableCell>
                        <TableCell>{formatChannelBadge(sale.channel) || '-'}</TableCell>
                        <TableCell>{formatPaymentBadge(sale.note) || '-'}</TableCell>
                        <TableCell>{sale.itemName || sale.itemSku}</TableCell>
                        <TableCell className="text-right font-medium">{formatPrice(sale.actualPrice)}</TableCell>
                        <TableCell>{sale.saleDate}</TableCell>
                        <TableCell>{sale.customerName || '-'}</TableCell>
                        <TableCell className={`text-right font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          <span className="inline-flex items-center gap-1">
                            {isProfit ? <ArrowUp className="h-3 w-3" /> : isLoss ? <ArrowDown className="h-3 w-3" /> : null}
                            {formatPrice(profit)}
                          </span>
                          <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" style={{ height: '6px' }} title={`利润率: ${marginPct}%`}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(Math.max(parseFloat(marginPct), 0), 100)}%`,
                                backgroundColor: parseFloat(marginPct) < 20 ? '#ef4444' : parseFloat(marginPct) < 40 ? '#f59e0b' : '#059669',
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{marginPct}%</span>
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:text-emerald-700" onClick={() => setDetailSale(sale)} title="查看详情">
                              <Eye className="h-3 w-3 mr-1" />详情
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-sky-600 hover:text-sky-700" onClick={() => handlePrintReceipt(sale)} title="打印小票">
                              <Printer className="h-3 w-3 mr-1" />小票
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-orange-600 hover:text-orange-700" onClick={() => openReturnDialog(sale)} title="退货" disabled={sale.returnedAt}>
                              <RotateCcw className="h-3 w-3 mr-1" />{sale.returnedAt ? '已退' : '退货'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={11} className="p-0">
                            <div className="bg-muted/30 border-t border-b p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div><span className="text-muted-foreground">货品名称:</span> <span className="font-medium">{sale.itemName || sale.itemSku}</span></div>
                                <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{sale.itemSku}</span></div>
                                <div><span className="text-muted-foreground">材质:</span> {sale.materialName || '-'}</div>
                                <div><span className="text-muted-foreground">器型:</span> {sale.typeName || '-'}</div>
                                <div><span className="text-muted-foreground">成本价:</span> {formatPrice(sale.costPrice)}</div>
                                <div><span className="text-muted-foreground">成交价:</span> <span className="font-bold text-emerald-600">{formatPrice(sale.actualPrice)}</span></div>
                                <div><span className="text-muted-foreground">毛利:</span> <span className={`font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPrice(profit)}</span></div>
                                <div><span className="text-muted-foreground">毛利率:</span> <span className={`font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{marginPct}%</span></div>
                                <div><span className="text-muted-foreground">客户:</span> {sale.customerName || '-'}</div>
                                <div><span className="text-muted-foreground">客户电话:</span> {sale.customerPhone || '-'}</div>
                                <div><span className="text-muted-foreground">VIP等级:</span> {sale.customerVipLevel || '-'}</div>
                                <div><span className="text-muted-foreground">柜台号:</span> {sale.counter || '-'}</div>
                                <div><span className="text-muted-foreground">支付方式:</span> {formatPaymentBadge(sale.note) || <span className="text-muted-foreground">未指定</span>}</div>
                                <div><span className="text-muted-foreground">渠道:</span> {formatChannelBadge(sale.channel) || '-'}</div>
                              </div>
                              {sale.note && <p className="text-sm text-muted-foreground mt-2"><span className="font-medium">备注:</span> {getPaymentNote(sale.note)}</p>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                      );
                    })}
                    {/* Summary Row */}
                    <TableRow className="bg-emerald-50/50 dark:bg-emerald-950/20 font-semibold">
                      <TableCell colSpan={5}>合计 ({pagination.total} 条)</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatPrice(totalRevenue)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className={`text-right ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPrice(totalProfit)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {sales.map(sale => {
              const profit = sale.grossProfit || 0;
              const isExpanded = expandedSaleId === sale.id;
              const marginPct = sale.actualPrice > 0 ? ((profit / sale.actualPrice) * 100).toFixed(1) : '0.0';
              return (
              <Card key={sale.id} className={`hover:shadow-md transition-shadow cursor-pointer ${sale.grossProfit > 0 ? 'border-l-2 border-l-emerald-400' : sale.grossProfit < 0 ? 'border-l-2 border-l-red-400' : ''} ${selectedSaleIds.has(String(sale.id)) ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`} onClick={() => toggleExpand(sale.id)}>
                <CardContent className="p-4 space-y-2">
                  {/* Header: saleNo + channel + checkbox */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div onClick={e => e.stopPropagation()} className="mr-1"><Checkbox checked={selectedSaleIds.has(String(sale.id))} onCheckedChange={() => toggleSelectSale(sale.id)} className="h-4 w-4" /></div>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="font-mono text-xs text-muted-foreground">{sale.saleNo}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {formatChannelBadge(sale.channel)}
                      {formatPaymentBadge(sale.note)}
                    </div>
                  </div>
                  {/* Item info */}
                  <p className="font-medium text-sm truncate">{sale.itemName || sale.itemSku}</p>
                  <p className="text-xs text-muted-foreground font-mono">{sale.itemSku}</p>
                  {/* Price + Profit row */}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-emerald-600">{formatPrice(sale.actualPrice)}</span>
                    <span className={`text-sm font-medium inline-flex items-center gap-1 ${sale.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sale.grossProfit > 0 ? <ArrowUp className="h-3 w-3" /> : sale.grossProfit < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                      {sale.grossProfit >= 0 ? '+' : ''}{formatPrice(sale.grossProfit)}
                    </span>
                  </div>
                  {/* Meta row: date + customer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{sale.saleDate}</span>
                    {sale.customerName && <span>{sale.customerName}</span>}
                  </div>
                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="pt-2 mt-2 border-t text-xs space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-muted-foreground">材质:</span> {sale.materialName || '-'}</div>
                        <div><span className="text-muted-foreground">器型:</span> {sale.typeName || '-'}</div>
                        <div><span className="text-muted-foreground">成本:</span> {formatPrice(sale.costPrice)}</div>
                        <div><span className="text-muted-foreground">毛利率:</span> <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{marginPct}%</span></div>
                        {sale.customerName && <div><span className="text-muted-foreground">客户:</span> {sale.customerName}</div>}
                        {sale.customerPhone && <div><span className="text-muted-foreground">电话:</span> {sale.customerPhone}</div>}
                      </div>
                      {sale.note && <p className="text-muted-foreground">备注: {getPaymentNote(sale.note)}</p>}
                    </div>
                  )}
                  {/* Action buttons */}
                  <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-xs text-emerald-600" onClick={() => setDetailSale(sale)}>
                      <Eye className="h-3 w-3 mr-1" />详情
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-xs text-sky-600" onClick={() => handlePrintReceipt(sale)}>
                      <Printer className="h-3 w-3 mr-1" />小票
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-3 text-xs text-orange-600" onClick={() => openReturnDialog(sale)} disabled={sale.returnedAt}>
                      <RotateCcw className="h-3 w-3 mr-1" />{sale.returnedAt ? '已退' : '退货'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
            {/* Summary card */}
            <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 font-semibold">
              <CardContent className="p-3 flex items-center justify-between text-sm">
                <span className="font-medium">合计 ({pagination.total} 条)</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-600 font-medium">{formatPrice(totalRevenue)}</span>
                  <span className={totalProfit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{formatPrice(totalProfit)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Pagination */}
      <Pagination page={pagination.page} pages={pagination.pages} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} />

      {/* Floating Batch Action Bar */}
      {selectedSaleIds.size > 0 && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-emerald-600 dark:bg-emerald-700 text-white px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">已选择 {selectedSaleIds.size} 条记录</span>
              <button onClick={() => setSelectedSaleIds(new Set())} className="ml-2 text-emerald-200 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" onClick={handleBatchExportCSV}>
                <FileDown className="h-3 w-3 mr-1" />批量导出CSV
              </Button>
              <Button size="sm" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" onClick={() => setSelectedSaleIds(new Set())}>
                取消选择
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profit Trend Sparkline + Channel Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sparklineData.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-sky-600" />营收趋势</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={sparklineData} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
                  <RTooltip formatter={(v: number) => formatPrice(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#059669" fill="url(#revenueGrad)" strokeWidth={2} name="营收" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {/* Channel Breakdown */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-amber-600" />渠道分析</p>
            {sales.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '门店', value: storeCount, color: '#059669' },
                          { name: '微信', value: wechatCount, color: '#0284c7' },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" innerRadius={25} outerRadius={45}
                        dataKey="value" stroke="none"
                      >
                        {[
                          { name: '门店', value: storeCount, color: '#059669' },
                          { name: '微信', value: wechatCount, color: '#0284c7' },
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RTooltip formatter={(v: number) => `${v} 件`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {[
                    { label: '门店', count: storeCount, revenue: sales.filter(s => s.channel === 'store').reduce((sum, s) => sum + (s.actualPrice || 0), 0), color: 'bg-emerald-500', icon: Store },
                    { label: '微信', count: wechatCount, revenue: sales.filter(s => s.channel === 'wechat').reduce((sum, s) => sum + (s.actualPrice || 0), 0), color: 'bg-sky-500', icon: MessageCircle },
                  ].filter(ch => ch.count > 0).map(ch => {
                    const ChIcon = ch.icon;
                    const pct = sales.length > 0 ? Math.round((ch.count / sales.length) * 100) : 0;
                    return (
                      <div key={ch.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <ChIcon className="h-3.5 w-3.5" />
                            <span className="font-medium">{ch.label}</span>
                            <span className="text-muted-foreground text-xs">{ch.count}件 ({pct}%)</span>
                          </div>
                          <span className="text-emerald-600 font-medium text-xs">{formatPrice(ch.revenue)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div className={`${ch.color} rounded-full h-1.5 transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无销售数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bundle Sale Dialog */}
      <BundleSaleDialog open={showBundle} onOpenChange={setShowBundle} onSuccess={fetchSales} />

      {/* Enhanced Return Dialog */}
      <Dialog open={returnDialog.open} onOpenChange={open => setReturnDialog({ open, sale: open ? returnDialog.sale : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-orange-600" />销售退货</DialogTitle>
            <DialogDescription>
              退货单号: <span className="font-mono">{returnDialog.sale?.saleNo}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Item Card with Thumbnail */}
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl border border-border hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {returnDialog.sale?.itemImage ? (
                  <img src={returnDialog.sale.itemImage} alt={returnDialog.sale.itemName || '退货货品图片'} className="w-full h-full object-cover" />
                ) : (
                  <Gem className="h-6 w-6 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium text-sm truncate">{returnDialog.sale?.itemName || returnDialog.sale?.itemSku || '-'}</p>
                <p className="text-xs text-muted-foreground font-mono">{returnDialog.sale?.itemSku}</p>
                <div className="flex items-center gap-3 text-xs">
                  {returnDialog.sale?.materialName && <span className="text-muted-foreground">{returnDialog.sale.materialName}</span>}
                  {returnDialog.sale?.typeName && <span className="text-muted-foreground">· {returnDialog.sale.typeName}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">成交价</p>
                <p className="text-lg font-bold text-emerald-600">{formatPrice(returnDialog.sale?.actualPrice || 0)}</p>
              </div>
            </div>

            {/* Sale Meta Info */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-muted/30 rounded-lg text-center">
                <p className="text-muted-foreground">销售日期</p>
                <p className="font-medium mt-0.5">{returnDialog.sale?.saleDate || '-'}</p>
              </div>
              {returnDialog.sale?.customerName && (
                <div className="p-2 bg-muted/30 rounded-lg text-center">
                  <p className="text-muted-foreground">客户</p>
                  <p className="font-medium mt-0.5 truncate">{returnDialog.sale.customerName}</p>
                </div>
              )}
              {returnDialog.sale?.customerPhone && (
                <div className="p-2 bg-muted/30 rounded-lg text-center">
                  <p className="text-muted-foreground">电话</p>
                  <p className="font-medium mt-0.5">{returnDialog.sale.customerPhone}</p>
                </div>
              )}
            </div>

            {/* Warning Banner */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>退货后货品将恢复为退货状态，请确认信息无误</span>
            </div>

            {/* Refund Amount */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">退款金额 (¥)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
                <Input type="number" className="pl-7 h-10 text-base font-medium" value={returnForm.refundAmount} onChange={e => setReturnForm(f => ({ ...f, refundAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              {returnDialog.sale && returnForm.refundAmount > returnDialog.sale.actualPrice && (
                <p className="text-xs text-red-500">⚠️ 退款金额不能超过成交价 {formatPrice(returnDialog.sale.actualPrice)}</p>
              )}
            </div>

            {/* Return Reason Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">退货原因</Label>
              <Select value={returnForm.returnReason || '_custom'} onValueChange={v => setReturnForm(f => ({ ...f, returnReason: v === '_custom' ? '' : v }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="请选择退货原因" /></SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className={r.color}>{r.label}</span>
                    </SelectItem>
                  ))}
                  <SelectItem value="_custom">自定义原因...</SelectItem>
                </SelectContent>
              </Select>
              {!returnForm.returnReason && (
                <Input
                  className="mt-2 h-9 text-sm"
                  placeholder="输入自定义退货原因..."
                  value={returnForm.returnReason === '_custom' ? '' : ''}
                  onChange={e => setReturnForm(f => ({ ...f, returnReason: e.target.value }))}
                />
              )}
            </div>

            {/* Return Date */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">退货日期</Label>
              <Input type="date" className="h-10" value={returnForm.returnDate} onChange={e => setReturnForm(f => ({ ...f, returnDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnDialog({ open: false, sale: null })}>取消</Button>
            <Button
              onClick={async () => {
                setReturnSubmitting(true);
                try {
                  await handleReturn();
                } finally {
                  setReturnSubmitting(false);
                }
              }}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={returnForm.refundAmount <= 0 || returnSubmitting || returnDialog.sale?.returnedAt || (returnDialog.sale && returnForm.refundAmount > returnDialog.sale.actualPrice)}
            >
              {returnSubmitting ? '处理中...' : returnDialog.sale?.returnedAt ? '已退货' : '确认退货'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Receipt Dialog */}
      <Dialog open={printSale !== null} onOpenChange={open => { if (!open) setPrintSale(null); }}>
        <DialogContent className="print-receipt-dialog max-w-sm">
          <DialogHeader>
            <DialogTitle>打印小票</DialogTitle>
            <DialogDescription>预览销售小票</DialogDescription>
          </DialogHeader>
          {printSale && (
            <div id="print-receipt-content" className="print-only-content font-mono text-sm space-y-3 py-2">
              <div className="text-center border-b border-dashed pb-3">
                <p className="text-lg font-bold">翡翠珠宝</p>
                <p className="text-xs text-muted-foreground">销售凭证</p>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>单号:</span><span>{printSale.saleNo}</span></div>
                <div className="flex justify-between"><span>日期:</span><span>{printSale.saleDate}</span></div>
              </div>
              <div className="border-t border-dashed pt-2 space-y-1.5">
                <p className="font-medium">{printSale.itemName || printSale.itemSku}</p>
                <p className="text-xs text-muted-foreground">SKU: {printSale.itemSku}</p>
                {printSale.materialName && <p className="text-xs text-muted-foreground">材质: {printSale.materialName}</p>}
                {printSale.typeName && <p className="text-xs text-muted-foreground">器型: {printSale.typeName}</p>}
              </div>
              <div className="border-t border-dashed pt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span>成本价:</span><span>{formatPrice(printSale.costPrice)}</span></div>
                <div className="flex justify-between font-bold"><span>售价:</span><span>{formatPrice(printSale.actualPrice)}</span></div>
                <div className="flex justify-between"><span>毛利:</span><span className={printSale.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatPrice(printSale.grossProfit)}</span></div>
              </div>
              {printSale.customerName && (
                <div className="border-t border-dashed pt-2 text-xs">
                  <div className="flex justify-between"><span>客户:</span><span>{printSale.customerName}</span></div>
                  {printSale.customerPhone && <div className="flex justify-between"><span>电话:</span><span>{printSale.customerPhone}</span></div>}
                </div>
              )}
              <div className="border-t border-dashed pt-2 text-xs">
                <div className="flex justify-between"><span>支付:</span><span>{getPaymentMethod(printSale.note) || '未指定'}</span></div>
                <div className="flex justify-between"><span>渠道:</span><span>{printSale.channel === 'store' ? '门店' : printSale.channel === 'wechat' ? '微信' : printSale.channel || '-'}</span></div>
              </div>
              <div className="border-t border-dashed pt-2 text-center text-xs text-muted-foreground">
                <p className="font-mono tracking-widest">{printSale.itemSku}</p>
                <p className="mt-1">感谢惠顾</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintSale(null)}>关闭</Button>
            <Button onClick={() => { window.print(); }} className="bg-sky-600 hover:bg-sky-700">
              <Printer className="h-3 w-3 mr-1" />打印
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print-specific stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-receipt-content,
          #print-receipt-content * {
            visibility: visible !important;
          }
          #print-receipt-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 4mm !important;
            background: white !important;
            color: black !important;
            font-size: 12px !important;
          }
          .print-receipt-dialog [data-radix-dialog-overlay],
          .print-receipt-dialog > div > div:not(:has(#print-receipt-content)) {
            display: none !important;
          }
        }
      `}</style>

      {/* Sale Detail Slide Panel */}
      {detailSale && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 animate-in fade-in-0 duration-200"
            onClick={() => setDetailSale(null)}
          />
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full z-50 w-full md:w-[400px] bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-300 ease-out overflow-y-auto">
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                销售详情
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetailSale(null)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              {/* Item Image + Basic Info */}
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {detailSale.itemImage ? (
                    <img src={detailSale.itemImage} alt={detailSale.itemName || '销售货品图片'} className="w-full h-full object-cover" />
                  ) : (
                    <Gem className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-semibold text-base truncate">{detailSale.itemName || detailSale.itemSku || '-'}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{detailSale.itemSku}</p>
                  {detailSale.materialName && (
                    <p className="text-xs text-muted-foreground">{detailSale.materialName} {detailSale.typeName ? `· ${detailSale.typeName}` : ''}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Sale Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">销售日期</p>
                  <p className="font-medium">{detailSale.saleDate || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">销售单号</p>
                  <p className="font-medium font-mono text-xs">{detailSale.saleNo || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">客户</p>
                  <p className="font-medium">{detailSale.customerName || '散客'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">渠道</p>
                  <div className="mt-0.5">{formatChannelBadge(detailSale.channel) || '-'}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">柜台号</p>
                  <p className="font-medium">{detailSale.counter || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">支付方式</p>
                  <div className="mt-0.5">{formatPaymentBadge(detailSale.note) || <span className="text-muted-foreground">未指定</span>}</div>
                </div>
              </div>

              <Separator />

              {/* Price Breakdown */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">价格明细</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">成本价</span>
                    <span className="font-medium">{formatPrice(detailSale.costPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">成交价</span>
                    <span className="font-bold text-emerald-600 text-lg">{formatPrice(detailSale.actualPrice)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">毛利</span>
                    <span className={`font-bold ${(detailSale.grossProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {(detailSale.grossProfit || 0) >= 0 ? '+' : ''}{formatPrice(detailSale.grossProfit || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">毛利率</span>
                    <Badge
                      variant="outline"
                      className={`font-medium ${
                        (detailSale.actualPrice || 0) > 0
                          ? ((detailSale.grossProfit || 0) / detailSale.actualPrice) * 100 > 30
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300'
                            : ((detailSale.grossProfit || 0) / detailSale.actualPrice) * 100 > 10
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-300'
                      }`}
                    >
                      {detailSale.actualPrice > 0 ? `${(((detailSale.grossProfit || 0) / detailSale.actualPrice) * 100).toFixed(1)}%` : '0.0%'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              {(detailSale.customerName || detailSale.customerPhone) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5"><User className="h-4 w-4" />客户信息</h4>
                    <div className="space-y-2 text-sm">
                      {detailSale.customerName && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">姓名</span>
                          <span className="font-medium">{detailSale.customerName}</span>
                        </div>
                      )}
                      {detailSale.customerPhone && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">电话</span>
                          <a href={`tel:${detailSale.customerPhone}`} className="font-medium text-sky-600 hover:underline">{detailSale.customerPhone}</a>
                        </div>
                      )}
                      {detailSale.customerVipLevel && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">VIP等级</span>
                          <span className="font-medium">{detailSale.customerVipLevel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Note */}
              {detailSale.note && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">备注</p>
                    <p className="text-sm">{getPaymentNote(detailSale.note)}</p>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDetailSale(null); handlePrintReceipt(detailSale); }}>
                  <Printer className="h-3 w-3 mr-1" />打印小票
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-orange-600" onClick={() => { setDetailSale(null); openReturnDialog(detailSale); }} disabled={detailSale.returnedAt}>
                  <RotateCcw className="h-3 w-3 mr-1" />{detailSale.returnedAt ? '已退货' : '退货'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SalesTab;
