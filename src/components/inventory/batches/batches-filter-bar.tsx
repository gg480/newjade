'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatPrice } from '../shared';

import {
  Layers, CheckCircle, TrendingUp, DollarSign, Plus, FileDown, Package,
  Search, X, Trophy, Ban, PlayCircle, ClipboardList, TrendingDown,
  ArrowUpRight, ArrowDownRight, 
} from 'lucide-react';

// ========== Batches Filter Bar Props ==========
interface BatchesFilterBarProps {
  pagination: { total: number };
  totalCost: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  roiLeaderboard: any[];
  searchText: string;
  onSearchChange: (text: string) => void;
  debouncedSearch: string;
  filteredBatches: any[];
  onNewBatch: () => void;
  onQuickAddItem: () => void;
  onExportCSV: () => void;
}

export function BatchesFilterBar({
  pagination, totalCost, completedCount, inProgressCount, notStartedCount,
  roiLeaderboard, searchText, onSearchChange, debouncedSearch, filteredBatches,
  onNewBatch, onQuickAddItem, onExportCSV,
}: BatchesFilterBarProps) {
  return (
    <>
      {/* Batch Statistics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总批次</p>
                <p className="text-lg font-bold tabular-nums">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">已完成(100%)</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <PlayCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">进行中</p>
                <p className="text-lg font-bold text-amber-600 tabular-nums">{inProgressCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-gray-400 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Ban className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">未开始</p>
                <p className="text-lg font-bold text-gray-500 tabular-nums">{notStartedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总成本</p>
                <p className="text-lg font-bold text-purple-600 tabular-nums">{formatPrice(totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 回本排行榜 */}
      {roiLeaderboard.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium flex items-center gap-1.5 mb-3">
              <Trophy className="h-4 w-4 text-amber-500" />回本排行榜
              <Badge variant="secondary" className="text-[10px] ml-1">TOP {roiLeaderboard.length}</Badge>
            </p>
            <div className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1">
              {roiLeaderboard.map((b: any, idx: number) => {
                const barColor = b.margin >= 100 ? 'bg-emerald-500' : b.margin >= 50 ? 'bg-sky-500' : 'bg-amber-500';
                const textColor = b.margin >= 100 ? 'text-emerald-600 dark:text-emerald-400' : b.margin >= 50 ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400';
                return (
                  <div key={b.id} className="snap-start shrink-0 w-48 h-28 rounded-lg border border-border bg-card hover:shadow-md transition-shadow cursor-pointer p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium truncate max-w-[100px]">{b.batchCode}</span>
                      <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
                    </div>
                    <div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" style={{ height: '4px' }}>
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(Math.max(b.margin, 0), 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{b.margin.toFixed(1)}%</span>
                      <span className={`text-[10px] font-medium tabular-nums ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {b.profit >= 0 ? '+' : ''}{formatPrice(b.profit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={onNewBatch}><Plus className="h-3 w-3 mr-1" />新建批次</Button>
        <Button size="sm" variant="outline" className="h-9 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300" onClick={onQuickAddItem}>
          <Package className="h-3 w-3 mr-1" />快速添加货品
        </Button>
        <Button size="sm" variant="outline" className="h-9" onClick={onExportCSV} disabled={filteredBatches.length === 0}><FileDown className="h-3 w-3 mr-1" />导出CSV</Button>
        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索批次编号..."
            value={searchText}
            onChange={e => onSearchChange(e.target.value)}
            className="h-9 w-48 md:w-56 pl-8 pr-8"
          />
          {searchText && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Search result count */}
      {debouncedSearch.trim() && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <Search className="h-3.5 w-3.5" />
          <span>找到 <span className="font-medium text-foreground">{filteredBatches.length}</span> 个批次</span>
        </div>
      )}
    </>
  );
}
