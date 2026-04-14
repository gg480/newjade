'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { customersApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, EmptyState, LoadingSkeleton, ConfirmDialog } from './shared';
import Pagination from './pagination';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, Crown, Sparkles, TrendingUp, Shield, ShieldCheck,
  Phone, MessageCircle, MapPin, Calendar, ShoppingBag, BarChart3, Tag, X, Clock, FileDown, ArrowUpDown, FileText,
  DollarSign as DollarSignIcon, ShoppingCart as ShoppingCartIcon, ArrowDownAZ, Diamond, Star,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip as RTooltip, ResponsiveContainer, Tooltip } from 'recharts';

// Tag color palette
const TAG_COLORS = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-700',
  'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700',
  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-700',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// VIP level helper
function getVipLevel(totalSpending: number) {
  if (totalSpending >= 50000) return { label: '钻石会员', icon: Sparkles, color: 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-800 dark:from-violet-900 dark:to-purple-900 dark:text-violet-200 border-violet-300 dark:border-violet-700', min: 50000, max: Infinity };
  if (totalSpending >= 20000) return { label: '金卡会员', icon: Crown, color: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 dark:from-amber-900 dark:to-yellow-900 dark:text-amber-200 border-amber-300 dark:border-amber-700', min: 20000, max: 50000 };
  if (totalSpending >= 5000) return { label: '银卡会员', icon: ShieldCheck, color: 'bg-gradient-to-r from-gray-100 to-slate-200 text-gray-700 dark:from-gray-800 dark:to-slate-800 dark:text-gray-200 border-gray-300 dark:border-gray-600', min: 5000, max: 20000 };
  return { label: '普通客户', icon: Shield, color: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700', min: 0, max: 5000 };
}

// Mini bar chart for monthly spending (no recharts dependency)
function MiniSpendingChart({ data }: { data: { month: string; amount: number }[] }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  return (
    <div className="flex items-end gap-1 h-[80px]">
      {data.map((d, i) => {
        const heightPct = Math.max((d.amount / maxAmount) * 100, 5);
        const monthLabel = `${parseInt(d.month.split('-')[1])}月`;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0 group/bar" title={`${d.month}: ${formatPrice(d.amount)}`}>
            <span className="text-[9px] text-muted-foreground opacity-0 group-hover/bar:opacity-100 transition-opacity font-medium whitespace-nowrap">{formatPrice(d.amount)}</span>
            <div
              className="w-full rounded-t-sm bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-300 min-h-[4px]"
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{monthLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ========== Customer Profile Dialog ==========
function CustomerProfileDialog({ customer, open, onClose, onEdit, onTagsUpdated }: {
  customer: any;
  open: boolean;
  onClose: () => void;
  onEdit: (c: any) => void;
  onTagsUpdated: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    if (open && customer?.id) {
      setLoading(true);
      customersApi.getCustomerDetail(customer.id).then((data: any) => {
        setDetail(data);
        setNotes(data.notes || '');
      }).catch(() => {
        toast.error('加载客户详情失败');
      }).finally(() => setLoading(false));
    } else {
      setDetail(null);
    }
  }, [open, customer?.id]);

  async function handleSaveNotes() {
    if (!customer) return;
    setNotesSaving(true);
    try {
      await customersApi.updateCustomer(customer.id, { notes });
      toast.success('备注已保存');
      onTagsUpdated();
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setNotesSaving(false);
    }
  }

  async function handleAddTag() {
    if (!tagInput.trim() || !customer) return;
    const currentTags = detail?.tags || customer.tags || [];
    if (currentTags.includes(tagInput.trim())) {
      toast.warning('标签已存在');
      return;
    }
    try {
      const newTags = [...currentTags, tagInput.trim()];
      await customersApi.updateCustomer(customer.id, { tags: newTags });
      toast.success('标签已添加');
      setTagInput('');
      setShowTagInput(false);
      // Refresh detail
      const data = await customersApi.getCustomerDetail(customer.id);
      setDetail(data);
      onTagsUpdated();
    } catch (e: any) {
      toast.error(e.message || '添加标签失败');
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!customer) return;
    const currentTags = detail?.tags || customer.tags || [];
    const newTags = currentTags.filter((t: string) => t !== tag);
    try {
      await customersApi.updateCustomer(customer.id, { tags: newTags });
      toast.success('标签已移除');
      const data = await customersApi.getCustomerDetail(customer.id);
      setDetail(data);
      onTagsUpdated();
    } catch (e: any) {
      toast.error(e.message || '移除标签失败');
    }
  }

  const tags = detail?.tags || customer?.tags || [];
  const purchaseStats = detail?.purchaseStats;
  const monthlySpending = detail?.monthlySpending || [];
  const topMaterials = detail?.topMaterials || [];
  const vipProgress = detail?.vipProgress;
  const vip = getVipLevel(purchaseStats?.totalSpending || 0);
  const VipIcon = vip.icon;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>客户画像</span>
            <Badge variant="outline" className={`text-xs ${vip.color}`}>
              <VipIcon className="h-3 w-3 mr-1" />
              {vip.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>{customer?.customerCode || ''}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detail ? (
          <div className="space-y-5 py-2">
            {/* Basic Info + Contact */}
            <div className="space-y-2">
              <h3 className="font-medium text-base flex items-center gap-2">
                {customer.name}
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onEdit(customer)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </h3>
              <div className="grid grid-cols-1 gap-1.5 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /><span>{customer.phone}</span>
                  </div>
                )}
                {customer.wechat && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" /><span>{customer.wechat}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /><span>{customer.address}</span>
                  </div>
                )}
                {!customer.phone && !customer.wechat && !customer.address && (
                  <p className="text-xs text-muted-foreground italic">暂无联系方式</p>
                )}
              </div>
            </div>

            {/* VIP Progress */}
            {vipProgress && vipProgress.nextLevel && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">距离 {vipProgress.nextLevel}</span>
                  <span className="font-medium text-emerald-600">
                    还需消费 {formatPrice((vipProgress.nextMin || 0) - (purchaseStats?.totalSpending || 0))}
                  </span>
                </div>
                <Progress value={vipProgress.progressToNext} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{vipProgress.currentLevel}</span>
                  <span>{vipProgress.nextLevel}</span>
                </div>
              </div>
            )}

            <Separator />

            {/* Purchase Statistics */}
            {purchaseStats && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />消费统计
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">总消费</p>
                    <p className="text-lg font-bold text-emerald-600">{formatPrice(purchaseStats.totalSpending)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">购买次数</p>
                    <p className="text-lg font-bold">{purchaseStats.orderCount} 次</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">平均客单价</p>
                    <p className="text-lg font-bold">{formatPrice(purchaseStats.avgOrderValue)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">最近购买</p>
                    <p className="text-sm font-medium">
                      {purchaseStats.lastPurchaseDate || '无'}
                    </p>
                    {purchaseStats.daysSinceLastPurchase != null && purchaseStats.daysSinceLastPurchase >= 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />{purchaseStats.daysSinceLastPurchase}天前
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Spending Chart */}
            {monthlySpending.length > 0 && monthlySpending.some((d: any) => d.amount > 0) && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-sky-600" />近6月消费趋势
                </h4>
                <MiniSpendingChart data={monthlySpending.slice(-6)} />
              </div>
            )}

            {/* Preference Analysis */}
            {topMaterials.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-amber-600" />偏好分析
                </h4>
                <div className="space-y-1.5">
                  {topMaterials.map((m: any) => (
                    <div key={m.name} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{m.name}</Badge>
                        <span className="text-muted-foreground">{m.count}次</span>
                      </div>
                      <span className="font-medium text-emerald-600">{formatPrice(m.totalSpending)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-purple-600" />客户标签
                </h4>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowTagInput(!showTagInput)}>
                  <Plus className="h-3 w-3 mr-0.5" />添加
                </Button>
              </div>
              {showTagInput && (
                <div className="flex items-center gap-2">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    placeholder="输入标签名"
                    className="h-8 text-sm flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                  />
                  <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddTag}>添加</Button>
                </div>
              )}
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag: string) => (
                    <Badge key={tag} variant="outline" className={`text-xs pr-1 ${getTagColor(tag)}`}>
                      {tag}
                      <button
                        className="ml-1 hover:text-red-500 transition-colors"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`移除标签 ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">暂无标签</p>
              )}
            </div>

            <Separator />

            {/* Purchase Timeline */}
            {detail.saleRecords && detail.saleRecords.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-600" />购买记录
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {detail.saleRecords.map((sr: any) => (
                    <div key={sr.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">{sr.saleDate}</span>
                        <span className="font-mono shrink-0">{sr.item?.skuCode || sr.saleNo}</span>
                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">{sr.channel === 'store' ? '门店' : '微信'}</Badge>
                        {sr.item?.material?.name && (
                          <Badge variant="outline" className="text-[10px] h-4 shrink-0 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                            {sr.item.material.name}
                          </Badge>
                        )}
                      </div>
                      <span className="font-medium text-emerald-600 shrink-0">{formatPrice(sr.actualPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">备注</h4>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="添加客户备注..."
                className="min-h-[80px] text-sm"
              />
              <div className="flex justify-end">
                <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" disabled={notesSaving} onClick={handleSaveNotes}>
                  {notesSaving ? '保存中...' : '保存备注'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">无法加载客户详情</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Customers Tab ==========
function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [stats, setStats] = useState<any>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', wechat: '', address: '', notes: '', tags: '' });
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', wechat: '', address: '', notes: '', tags: '' });
  const [profileCustomer, setProfileCustomer] = useState<any>(null);
  const [deleteCustomerConfirm, setDeleteCustomerConfirm] = useState<any>(null);
  const [sortBy, setSortBy] = useState<string>('lastPurchaseDate');
  const SORT_OPTIONS = [
    { value: 'lastPurchaseDate', label: '最近购买', icon: Clock, order: 'desc' },
    { value: 'totalSpent', label: '消费总额', icon: DollarSignIcon, order: 'desc' },
    { value: 'orderCount', label: '购买次数', icon: ShoppingCartIcon, order: 'desc' },
    { value: 'name', label: '名称', icon: ArrowDownAZ, order: 'asc' },
  ];
  const currentSort = SORT_OPTIONS.find(s => s.value === sortBy) || SORT_OPTIONS[0];
  const SortIcon = currentSort.icon;

  // Debounce keyword changes
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [keyword]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customersApi.getCustomers({ page: pagination.page, size: pagination.size, keyword: debouncedKeyword, tag: tagFilter || undefined });
      setCustomers(data.items || []);
      setPagination(data.pagination || { total: 0, page: 1, size: 20, pages: 0 });
      setStats(data.stats || null);
      setAllTags(data.allTags || []);
    } catch { toast.error('加载客户失败'); } finally { setLoading(false); }
  }, [pagination.page, debouncedKeyword, tagFilter]);

  // Reset page when keyword or tag changes
  useEffect(() => { setPagination(p => ({ ...p, page: 1 })); }, [debouncedKeyword, tagFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    if (expandedCustomerId) {
      setDetailLoading(true);
      customersApi.getCustomerDetail(expandedCustomerId).then((data: any) => {
        setCustomerDetail(data);
      }).catch(() => {
        toast.error('加载客户详情失败');
      }).finally(() => setDetailLoading(false));
    } else {
      setCustomerDetail(null);
    }
  }, [expandedCustomerId]);

  async function handleCreate() {
    try {
      const tagsArr = createForm.tags ? createForm.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
      await customersApi.createCustomer({ ...createForm, tags: tagsArr });
      toast.success('客户创建成功');
      setShowCreate(false);
      setCreateForm({ name: '', phone: '', wechat: '', address: '', notes: '', tags: '' });
      fetchCustomers();
    } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleEditCustomer() {
    if (!editCustomer) return;
    try {
      const tagsArr = editForm.tags ? editForm.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
      await customersApi.updateCustomer(editCustomer.id, { name: editForm.name, phone: editForm.phone, wechat: editForm.wechat, address: editForm.address, notes: editForm.notes, tags: tagsArr });
      toast.success('客户更新成功');
      setEditCustomer(null);
      fetchCustomers();
    } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  function openEditDialog(customer: any) {
    setEditCustomer(customer);
    setEditForm({
      name: customer.name || '',
      phone: customer.phone || '',
      wechat: customer.wechat || '',
      address: customer.address || '',
      notes: customer.notes || '',
      tags: Array.isArray(customer.tags) ? customer.tags.join(', ') : '',
    });
  }

  function handleExportCSV() {
    if (customers.length === 0) {
      toast.error('没有可导出的客户数据');
      return;
    }
    const headers = ['客户编号', '姓名', '电话', '微信', '标签', '总消费', '购买次数', 'VIP等级', '最近购买', '地址', '备注'];
    const rows = customers.map((c: any) => {
      const vip = getVipLevel(c.totalSpending || 0);
      const tags = Array.isArray(c.tags) ? c.tags.join('、') : (c.tags || '');
      return [
        c.customerCode || '',
        c.name || '',
        c.phone || '',
        c.wechat || '',
        tags,
        c.totalSpending || 0,
        c.orderCount || 0,
        vip.label,
        c.lastPurchaseDate || '',
        c.address || '',
        c.notes || '',
      ];
    });
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
    link.download = `客户数据_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${customers.length} 条客户数据`);
  }

  if (loading && customers.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md hover:border-emerald-400 transition-all duration-200">
            <CardContent className="p-4">
              <div className="absolute -right-1 -bottom-1 opacity-10"><Users className="h-16 w-16 text-emerald-500" /></div>
              <p className="text-sm text-muted-foreground">客户总数</p>
              <p className="text-2xl font-bold">{stats.totalCustomers}</p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md hover:border-sky-400 transition-all duration-200">
            <CardContent className="p-4">
              <div className="absolute -right-1 -bottom-1 opacity-10"><TrendingUp className="h-16 w-16 text-sky-500" /></div>
              <p className="text-sm text-muted-foreground">总营收</p>
              <p className="text-2xl font-bold text-emerald-600">{formatPrice(stats.totalSpending)}</p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md hover:border-amber-400 transition-all duration-200">
            <CardContent className="p-4">
              <div className="absolute -right-1 -bottom-1 opacity-10"><BarChart3 className="h-16 w-16 text-amber-500" /></div>
              <p className="text-sm text-muted-foreground">平均客单价</p>
              <p className="text-2xl font-bold">{formatPrice(stats.avgOrderValue)}</p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-l-4 border-l-teal-500 hover:shadow-md hover:border-teal-400 transition-all duration-200">
            <CardContent className="p-4">
              <div className="absolute -right-1 -bottom-1 opacity-10"><Sparkles className="h-16 w-16 text-teal-500" /></div>
              <p className="text-sm text-muted-foreground">本月活跃</p>
              <p className="text-2xl font-bold text-teal-600">{stats.newThisMonth}</p>
              <p className="text-xs text-muted-foreground">近30天有消费</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input name="search" data-testid="customer-search" placeholder="搜索客户（姓名/电话/微信）" value={keyword} onChange={e => setKeyword(e.target.value)} className="w-64 h-9 pl-8" />
          </div>
          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={v => setSortBy(v)}>
            <SelectTrigger className="h-9 w-[140px]">
              <div className="flex items-center gap-1.5">
                <SortIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => {
                const OptIcon = opt.icon;
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <OptIcon className="h-3.5 w-3.5" />
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {!loading && keyword && (
            <span className="text-xs text-muted-foreground">找到 {pagination.total} 个客户</span>
          )}
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={e => { setTagFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="h-9 text-sm border rounded-md px-2 bg-background"
            >
              <option value="">全部标签</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={customers.length === 0}>
            <FileDown className="h-3 w-3 mr-1" />导出CSV
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreate(true)}>
            <Plus className="h-3 w-3 mr-1" /> 新增客户
          </Button>
        </div>
      </div>

      {customers.length === 0 ? (
        keyword ? (
          <div className="animate-in fade-in-0 duration-200">
            <EmptyState icon={Users} title="未找到匹配的客户" desc={`没有与「${keyword}」匹配的客户，请尝试其他关键词`} />
          </div>
        ) : (
          <EmptyState icon={Users} title="暂无客户" desc="还没有添加任何客户，点击「新增客户」开始" />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in-0 duration-200">
          {[...customers].sort((a, b) => {
            const sort = SORT_OPTIONS.find(s => s.value === sortBy);
            const order = sort?.order || 'desc';
            let cmp = 0;
            switch (sortBy) {
              case 'lastPurchaseDate': cmp = ((a.lastPurchaseDate || '').localeCompare(b.lastPurchaseDate || '')); break;
              case 'totalSpent': cmp = ((a.totalSpending || 0) - (b.totalSpending || 0)); break;
              case 'orderCount': cmp = ((a.orderCount || 0) - (b.orderCount || 0)); break;
              case 'name': cmp = ((a.name || '').localeCompare(b.name || '')); break;
              default: cmp = 0;
            }
            return order === 'desc' ? -cmp : cmp;
          }).map(c => {
            const vip = getVipLevel(c.totalSpending || 0);
            const VipIcon = vip.icon;
            const customerTags = Array.isArray(c.tags) ? c.tags : [];
            return (
              <Card key={c.id} className="group/card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onClick={() => setProfileCustomer(c)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{c.name}</h3>
                      <Badge variant="outline" className="text-xs">{c.customerCode}</Badge>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {/* Quick Actions: Phone call + WeChat copy */}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center justify-center h-7 w-7 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors md:opacity-0 md:group-hover/card:opacity-100" title="拨打电话">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {c.wechat && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-sky-600 md:opacity-0 md:group-hover/card:opacity-100" onClick={() => { navigator.clipboard.writeText(c.wechat).then(() => toast.success('微信号已复制到剪贴板')).catch(() => toast.error('复制失败')); }} title="复制微信号">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => openEditDialog(c)} title="编辑客户"><Pencil className="h-3.5 w-3.5" /></Button>
                      {(c.orderCount || 0) === 0 && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => setDeleteCustomerConfirm(c)} title="删除客户"><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpandedCustomerId(expandedCustomerId === c.id ? null : c.id)}>
                        {expandedCustomerId === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* VIP Badge + Total Spending */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`text-xs ${vip.color}`}>
                      <VipIcon className="h-3 w-3 mr-1" />
                      {vip.label}
                    </Badge>
                    <span className="text-sm font-medium text-emerald-600">{formatPrice(c.totalSpending || 0)}</span>
                    <span className="text-xs text-muted-foreground">({c.orderCount || 0}单)</span>
                  </div>

                  {/* Tags */}
                  {customerTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {customerTags.slice(0, 4).map((tag: string) => (
                        <Badge key={tag} variant="outline" className={`text-[10px] h-4 ${getTagColor(tag)}`}>{tag}</Badge>
                      ))}
                      {customerTags.length > 4 && (
                        <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">+{customerTags.length - 4}</Badge>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" />{c.phone}</p>}
                    {c.wechat && <p className="flex items-center gap-1.5"><MessageCircle className="h-3 w-3 shrink-0" />{c.wechat}</p>}
                    {c.notes && <p className="flex items-center gap-1.5 truncate"><FileText className="h-3 w-3 shrink-0" />{c.notes}</p>}
                  </div>

                  {/* VIP Progress Bar */}
                  {(c.totalSpending || 0) > 0 && (() => {
                    const spend = c.totalSpending || 0;
                    const currentVip = getVipLevel(spend);
                    const isMaxLevel = currentVip.max === Infinity;
                    const progress = isMaxLevel ? 100 : ((spend - currentVip.min) / (currentVip.max - currentVip.min)) * 100;
                    const barColor = spend >= 50000 ? '#8b5cf6' : spend >= 20000 ? '#f59e0b' : spend >= 5000 ? '#94a3b8' : '#9ca3af';
                    const levelColor = spend >= 50000 ? 'text-violet-500' : spend >= 20000 ? 'text-amber-500' : spend >= 5000 ? 'text-slate-400' : 'text-gray-500';
                    const nextLevelName = isMaxLevel ? '' : spend >= 20000 ? '钻石' : spend >= 5000 ? '金卡' : '银卡';
                    const nextMin = currentVip.max === Infinity ? spend : currentVip.max;

                    // Spending reward thresholds
                    const rewardTiers = [
                      { threshold: 1000, label: '银卡', icon: Shield, color: 'text-gray-500', iconBg: 'bg-gray-100 dark:bg-gray-800' },
                      { threshold: 5000, label: '金卡', icon: Crown, color: 'text-amber-500', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
                      { threshold: 20000, label: '钻石卡', icon: Diamond, color: 'text-sky-500', iconBg: 'bg-sky-100 dark:bg-sky-900/30' },
                      { threshold: 100000, label: '黑钻卡', icon: Star, color: 'text-purple-500', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
                    ];
                    const nextReward = rewardTiers.find(t => spend < t.threshold);
                    const currentRewardTier = rewardTiers.filter(t => spend >= t.threshold).pop();
                    const nextRewardMin = nextReward ? nextReward.threshold : 0;
                    const prevRewardMin = currentRewardTier ? currentRewardTier.threshold : 0;
                    const rewardProgress = nextReward ? ((spend - prevRewardMin) / (nextRewardMin - prevRewardMin)) * 100 : 100;

                    return (
                      <div className="mt-2 pt-1">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" style={{ height: '3px' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: barColor }} />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className={`text-[10px] ${levelColor} font-medium`}>{currentVip.label}</span>
                          {nextLevelName && progress < 100 && (
                            <span className="text-[10px] text-muted-foreground">距{nextLevelName} ¥{nextMin - spend}</span>
                          )}
                        </div>

                        {/* 消费奖励 Section */}
                        {spend > 0 && (() => {
                          const RewardIcon = nextReward ? nextReward.icon : (currentRewardTier ? currentRewardTier.icon : Shield);
                          const rewardColor = nextReward ? nextReward.color : (currentRewardTier ? currentRewardTier.color : 'text-gray-500');
                          const rewardBg = nextReward ? nextReward.iconBg : (currentRewardTier ? currentRewardTier.iconBg : 'bg-gray-100 dark:bg-gray-800');
                          return (
                            <div className="mt-1.5 pt-1 border-t border-dashed border-border/50">
                              {nextReward ? (
                                <>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      距离
                                      <span className={`font-medium ${rewardColor} flex items-center gap-0.5`}>
                                        <RewardIcon className="h-3 w-3" />{nextReward.label}
                                      </span>
                                    </span>
                                    <span className="text-muted-foreground">还差 <span className="font-medium text-foreground">¥{nextRewardMin - spend}</span></span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1" style={{ height: '2px' }}>
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(rewardProgress, 100)}%`, backgroundColor: rewardColor === 'text-gray-500' ? '#9ca3af' : rewardColor === 'text-amber-500' ? '#f59e0b' : rewardColor === 'text-sky-500' ? '#0ea5e9' : '#8b5cf6' }} />
                                  </div>
                                </>
                              ) : (
                                <span className="text-[10px] flex items-center gap-1 text-purple-500 font-medium">
                                  <Star className="h-3 w-3" />黑钻卡 — 最高等级
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Expanded Detail */}
                  {expandedCustomerId === c.id && (
                    <div className="mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
                      {detailLoading ? (
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /></div>
                      ) : customerDetail ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">总消费</p>
                              <p className="font-bold text-emerald-600">
                                {customerDetail.purchaseStats
                                  ? formatPrice(customerDetail.purchaseStats.totalSpending)
                                  : customerDetail.saleRecords
                                    ? formatPrice(customerDetail.saleRecords.reduce((sum: number, s: any) => sum + (s.actualPrice || 0), 0))
                                    : '¥0.00'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">购买次数</p>
                              <p className="font-bold">{customerDetail.purchaseStats?.orderCount || customerDetail.saleRecords?.length || 0} 次</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">最近购买</p>
                              <p className="font-medium">{customerDetail.purchaseStats?.lastPurchaseDate || (customerDetail.saleRecords?.length > 0
                                ? customerDetail.saleRecords.sort((a: any, b: any) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())[0]?.saleDate
                                : '无')}</p>
                            </div>
                          </div>
                          {customerDetail.saleRecords && customerDetail.saleRecords.length > 0 && (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                              <p className="text-xs font-medium text-muted-foreground">购买记录</p>
                              {customerDetail.saleRecords.slice(0, 10).map((sr: any) => (
                                <div key={sr.id} className="flex items-center justify-between text-xs p-1.5 bg-muted/50 rounded hover:bg-muted/80 transition-colors gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono shrink-0">{sr.item?.skuCode || sr.saleNo}</span>
                                    <Badge variant="outline" className="text-[10px] h-4 shrink-0">{sr.channel === 'store' ? '门店' : '微信'}</Badge>
                                    {sr.item?.batchCode && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">{sr.item.batchCode}</Badge>
                                    )}
                                  </div>
                                  <span className="font-medium text-emerald-600 shrink-0">{formatPrice(sr.actualPrice)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Purchase Summary */}
                          {customerDetail.saleRecords && customerDetail.saleRecords.length > 0 && (() => {
                            const sales = customerDetail.saleRecords;
                            const sorted = [...sales].sort((a: any, b: any) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());
                            const firstDate = sorted[0]?.saleDate || '无';
                            const lastDate = sorted[sorted.length - 1]?.saleDate || '无';
                            const totalSpending = sales.reduce((sum: number, s: any) => sum + (s.actualPrice || 0), 0);
                            const avgOrder = totalSpending / sales.length;
                            // Find most purchased item type
                            const typeCount: Record<string, { count: number; name: string }> = {};
                            sales.forEach((sr: any) => {
                              const typeName = sr.item?.material?.name || '其他';
                              if (!typeCount[typeName]) typeCount[typeName] = { count: 0, name: typeName };
                              typeCount[typeName].count++;
                            });
                            const topType = Object.values(typeCount).sort((a, b) => b.count - a.count)[0];
                            return (
                              <div className="mt-2 pt-2 border-t border-border space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">购买摘要</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex items-center gap-1.5 text-xs p-1.5 bg-muted/50 rounded">
                                    <Calendar className="h-3 w-3 text-sky-500 shrink-0" />
                                    <span className="text-muted-foreground">首次购买</span>
                                    <span className="font-medium ml-auto">{firstDate}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs p-1.5 bg-muted/50 rounded">
                                    <Calendar className="h-3 w-3 text-emerald-500 shrink-0" />
                                    <span className="text-muted-foreground">最近购买</span>
                                    <span className="font-medium ml-auto">{lastDate}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs p-1.5 bg-muted/50 rounded">
                                    <BarChart3 className="h-3 w-3 text-amber-500 shrink-0" />
                                    <span className="text-muted-foreground">平均客单价</span>
                                    <span className="font-medium text-emerald-600 ml-auto">{formatPrice(avgOrder)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs p-1.5 bg-muted/50 rounded">
                                    <ShoppingBag className="h-3 w-3 text-purple-500 shrink-0" />
                                    <span className="text-muted-foreground">偏好材质</span>
                                    <span className="font-medium ml-auto">{topType?.name || '-'} ({topType?.count || 0}次)</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">无法加载详情</p>
                      )}
                      {/* Mini Purchase History Chart */}
                      {customerDetail.monthlySpending && customerDetail.monthlySpending.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">近6月消费趋势</p>
                          <MiniSpendingChart data={(customerDetail.monthlySpending || []).slice(-6)} />
                        </div>
                      )}
                      {/* Sparkline: Recent purchase amounts */}
                      {customerDetail.saleRecords && customerDetail.saleRecords.length >= 2 && (() => {
                        const recentSales = [...customerDetail.saleRecords]
                          .sort((a: any, b: any) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
                          .slice(-6)
                          .map((sr: any) => ({ date: sr.saleDate?.slice(5) || '', amount: sr.actualPrice || 0 }));
                        return (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">近期消费金额</p>
                            <div className="h-20">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={recentSales} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
                                  <defs>
                                    <linearGradient id={`spark-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                  <Tooltip formatter={(v: number) => formatPrice(v)} />
                                  <Area type="monotone" dataKey="amount" stroke="#059669" fill={`url(#spark-${c.id})`} strokeWidth={1.5} dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <Pagination page={pagination.page} pages={pagination.pages} onPageChange={p => setPagination(prev => ({ ...prev, page: p }))} />

      {/* Create Customer Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增客户</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>姓名 *</Label><Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>电话</Label><Input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label>微信号</Label><Input value={createForm.wechat} onChange={e => setCreateForm(f => ({ ...f, wechat: e.target.value }))} /></div>
            <div className="space-y-1"><Label>地址</Label><Input value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="space-y-1"><Label>标签</Label><Input value={createForm.tags} onChange={e => setCreateForm(f => ({ ...f, tags: e.target.value }))} placeholder="多个标签用逗号分隔" /></div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700" disabled={!createForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editCustomer !== null} onOpenChange={open => { if (!open) setEditCustomer(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑客户</DialogTitle><DialogDescription>{editCustomer?.customerCode || ''}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>姓名 *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>电话</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label>微信号</Label><Input value={editForm.wechat} onChange={e => setEditForm(f => ({ ...f, wechat: e.target.value }))} /></div>
            <div className="space-y-1"><Label>地址</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="space-y-1"><Label>标签</Label><Input value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="多个标签用逗号分隔" /></div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomer(null)}>取消</Button>
            <Button onClick={handleEditCustomer} className="bg-emerald-600 hover:bg-emerald-700" disabled={!editForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Confirm */}
      <ConfirmDialog
        open={deleteCustomerConfirm !== null}
        onOpenChange={open => { if (!open) setDeleteCustomerConfirm(null); }}
        title="确认删除客户"
        description={`确定要删除客户「${deleteCustomerConfirm?.name}」吗？此操作不可恢复。`}
        confirmText="确认删除"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteCustomerConfirm) return;
          try {
            await customersApi.deleteCustomer(deleteCustomerConfirm.id);
            toast.success('客户已删除');
            setDeleteCustomerConfirm(null);
            fetchCustomers();
          } catch (e: any) { toast.error(e.message || '删除失败'); }
        }}
      />

      {/* Customer Profile Dialog */}
      <CustomerProfileDialog
        customer={profileCustomer}
        open={profileCustomer !== null}
        onClose={() => setProfileCustomer(null)}
        onEdit={c => { setProfileCustomer(null); openEditDialog(c); }}
        onTagsUpdated={fetchCustomers}
      />
    </div>
  );
}

export default CustomersTab;
