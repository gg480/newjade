'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '../shared';
import { customersApi } from '@/lib/api';
import { toast } from 'sonner';

import {
  ChevronDown, ChevronUp, Crown, Sparkles, Shield, ShieldCheck, Phone, MessageCircle, FileText,
  Pencil, Trash2, Diamond, Star, Calendar, BarChart3, ShoppingBag, Clock,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ========== Tag Color Palette ==========
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

// ========== VIP level helper ==========
function getVipLevel(totalSpending: number) {
  if (totalSpending >= 50000) return { label: '钻石会员', icon: Sparkles, color: 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-800 dark:from-violet-900 dark:to-purple-900 dark:text-violet-200 border-violet-300 dark:border-violet-700', min: 50000, max: Infinity };
  if (totalSpending >= 20000) return { label: '金卡会员', icon: Crown, color: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 dark:from-amber-900 dark:to-yellow-900 dark:text-amber-200 border-amber-300 dark:border-amber-700', min: 20000, max: 50000 };
  if (totalSpending >= 5000) return { label: '银卡会员', icon: ShieldCheck, color: 'bg-gradient-to-r from-gray-100 to-slate-200 text-gray-700 dark:from-gray-800 dark:to-slate-800 dark:text-gray-200 border-gray-300 dark:border-gray-600', min: 5000, max: 20000 };
  return { label: '普通客户', icon: Shield, color: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700', min: 0, max: 5000 };
}

// ========== Mini spending chart ==========
function MiniSpendingChart({ data }: { data: { month: string; amount: number }[] }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  return (
    <div className="flex items-end gap-1 h-[80px]">
      {data.map((d, i) => {
        const heightPct = Math.max((d.amount / maxAmount) * 100, 5);
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0 group/bar" title={`${d.month}: ${formatPrice(d.amount)}`}>
            <span className="text-[9px] text-muted-foreground opacity-0 group-hover/bar:opacity-100 transition-opacity font-medium whitespace-nowrap">{formatPrice(d.amount)}</span>
            <div
              className="w-full rounded-t-sm bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-300 min-h-[4px]"
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{`${parseInt(d.month.split('-')[1])}月`}</span>
          </div>
        );
      })}
    </div>
  );
}

// ========== Customers Table Props ==========
interface CustomersTableProps {
  customers: any[];
  keyword: string;
  showIncompleteOnly: boolean;
  sortBy: string;
  expandedCustomerId: number | null;
  onToggleExpand: (id: number | null) => void;
  customerDetail: any;
  detailLoading: boolean;
  onProfileClick: (customer: any) => void;
  onEdit: (customer: any) => void;
  onDelete: (customer: any) => void;
  onRefresh: () => void;
}

export function CustomersTable({
  customers, keyword, showIncompleteOnly, sortBy,
  expandedCustomerId, onToggleExpand, customerDetail, detailLoading,
  onProfileClick, onEdit, onDelete, onRefresh,
}: CustomersTableProps) {
  const SORT_OPTIONS = [
    { value: 'lastPurchaseDate', label: '最近购买', icon: Clock, order: 'desc' },
    { value: 'totalSpent', label: '消费总额', icon: undefined, order: 'desc' },
    { value: 'orderCount', label: '购买次数', icon: undefined, order: 'desc' },
    { value: 'name', label: '名称', icon: undefined, order: 'asc' },
  ];

  const visibleCustomers = [...customers]
    .filter(c => !showIncompleteOnly || (!c.phone && !c.wechat && !c.address))
    .sort((a, b) => {
      const sort = SORT_OPTIONS.find(s => s.value === sortBy);
      const order = sort?.order || 'desc';
      let cmp = 0;
      switch (sortBy) {
        case 'lastPurchaseDate': cmp = ((a.lastPurchaseDate || '').localeCompare(b.lastPurchaseDate || '')); break;
        case 'totalSpent': cmp = ((a.totalSpending || 0) - (b.totalSpending || 0)); break;
        case 'orderCount': cmp = ((a.orderCount || 0) - (b.orderCount || 0)); break;
        case 'name': cmp = ((a.name || '').localeCompare(b.name || '')); break;
      }
      return order === 'desc' ? -cmp : cmp;
    });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in-0 duration-200">
      {visibleCustomers.map(c => {
        const vip = getVipLevel(c.totalSpending || 0);
        const VipIcon = vip.icon;
        const customerTags = Array.isArray(c.tags) ? c.tags : [];
        const isExpanded = expandedCustomerId === c.id;
        return (
          <Card key={c.id} className="group/card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onClick={() => onProfileClick(c)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{c.name}</h3>
                  <Badge variant="outline" className="text-xs">{c.customerCode}</Badge>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => onEdit(c)} title="编辑客户"><Pencil className="h-3.5 w-3.5" /></Button>
                  {(c.orderCount || 0) === 0 && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => onDelete(c)} title="删除客户"><Trash2 className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onToggleExpand(isExpanded ? null : c.id)}>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                    {spend > 0 && (() => {
                      const RewardIcon = nextReward ? nextReward.icon : (currentRewardTier ? currentRewardTier.icon : Shield);
                      const rewardColor = nextReward ? nextReward.color : (currentRewardTier ? currentRewardTier.color : 'text-gray-500');
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
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
                  {detailLoading ? (
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /></div>
                  ) : customerDetail ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
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
                      {customerDetail.saleRecords && customerDetail.saleRecords.length > 0 && (() => {
                        const sales = customerDetail.saleRecords;
                        const sorted = [...sales].sort((a: any, b: any) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());
                        const firstDate = sorted[0]?.saleDate || '无';
                        const lastDate = sorted[sorted.length - 1]?.saleDate || '无';
                        const totalSpending = sales.reduce((sum: number, s: any) => sum + (s.actualPrice || 0), 0);
                        const avgOrder = totalSpending / sales.length;
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  {customerDetail?.monthlySpending && customerDetail.monthlySpending.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">近6月消费趋势</p>
                      <MiniSpendingChart data={customerDetail.monthlySpending.slice(-6)} />
                    </div>
                  )}
                  {customerDetail?.saleRecords && customerDetail.saleRecords.length >= 2 && (() => {
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
  );
}
