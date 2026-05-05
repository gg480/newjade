'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPrice } from '../shared';

import {
  Users, TrendingUp, BarChart3, Sparkles, Search, FileDown, Plus,
  DollarSign as DollarSignIcon, ShoppingCart as ShoppingCartIcon, ArrowDownAZ, Clock,
} from 'lucide-react';

// ========== Customers Filter Bar Props ==========
interface CustomersFilterBarProps {
  stats: any;
  keyword: string;
  onKeywordChange: (value: string) => void;
  loading: boolean;
  customers: any[];
  showIncompleteOnly: boolean;
  onToggleIncomplete: () => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  allTags: string[];
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  pagination: { total: number };
  onExportCSV: () => void;
  onNewCustomer: () => void;
}

const SORT_OPTIONS = [
  { value: 'lastPurchaseDate', label: '最近购买', icon: Clock, order: 'desc' },
  { value: 'totalSpent', label: '消费总额', icon: DollarSignIcon, order: 'desc' },
  { value: 'orderCount', label: '购买次数', icon: ShoppingCartIcon, order: 'desc' },
  { value: 'name', label: '名称', icon: ArrowDownAZ, order: 'asc' },
];

export function CustomersFilterBar({
  stats, keyword, onKeywordChange, loading, customers, showIncompleteOnly, onToggleIncomplete,
  sortBy, onSortChange, allTags, tagFilter, onTagFilterChange, pagination,
  onExportCSV, onNewCustomer,
}: CustomersFilterBarProps) {
  const currentSort = SORT_OPTIONS.find(s => s.value === sortBy) || SORT_OPTIONS[0];
  const SortIcon = currentSort.icon;

  return (
    <>
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
            <Input name="search" data-testid="customer-search" placeholder="搜索客户（姓名/电话/微信）" value={keyword} onChange={e => onKeywordChange(e.target.value)} className="w-64 h-9 pl-8" />
          </div>
          {/* 不完整客户筛选按钮 */}
          {!loading && (() => {
            const incompleteCount = customers.filter(c => !c.phone && !c.wechat && !c.address).length;
            if (incompleteCount > 0) {
              return (
                <Button
                  size="sm"
                  variant={showIncompleteOnly ? 'default' : 'outline'}
                  className={`h-9 text-xs ${showIncompleteOnly ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-400 text-amber-700 dark:border-amber-600 dark:text-amber-400'}`}
                  onClick={onToggleIncomplete}
                >
                  {showIncompleteOnly ? '显示全部' : `${incompleteCount} 位客户信息不完整`}
                </Button>
              );
            }
            return null;
          })()}
          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={onSortChange}>
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
              onChange={e => onTagFilterChange(e.target.value)}
              className="h-9 text-sm border rounded-md px-2 bg-background"
            >
              <option value="">全部标签</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onExportCSV} disabled={customers.length === 0}>
            <FileDown className="h-3 w-3 mr-1" />导出CSV
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onNewCustomer}>
            <Plus className="h-3 w-3 mr-1" /> 新增客户
          </Button>
        </div>
      </div>
    </>
  );
}
