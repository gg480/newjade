'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { itemsApi, batchesApi, dashboardApi } from '@/lib/api';
import { useAppStore, TabId } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, AlertTriangle, Package, TrendingDown, Clock, ShoppingCart,
  CheckCircle2, ExternalLink, Eye,
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'overdue' | 'batch_incomplete' | 'low_margin' | 'today_summary';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  dotColor: string;
  tab: TabId;
  timestamp: string;
}

// Relative time helper
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return `${Math.floor(diffDay / 30)}个月前`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setActiveTab } = useAppStore();

  const loadNotifications = useCallback(async () => {
    const notifs: Notification[] = [];

    try {
      // 1. Overdue inventory
      const summary = await dashboardApi.getSummary();
      const agingData = await dashboardApi.getStockAging();

      if (agingData?.overdue && agingData.overdue > 0) {
        notifs.push({
          id: 'overdue',
          type: 'overdue',
          title: '压货预警',
          description: `${agingData.overdue} 件货品库存超过90天，建议尽快处理`,
          icon: <AlertTriangle className="h-4 w-4" />,
          color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
          dotColor: 'bg-amber-500',
          tab: 'inventory',
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Batch incomplete
      const batchesData = await batchesApi.getBatches({ page: 1, size: 1000 });
      const incompleteBatches = (batchesData.items || []).filter((b: any) => (b.itemsCount || 0) < (b.quantity || 0));
      if (incompleteBatches.length > 0) {
        notifs.push({
          id: 'batch_incomplete',
          type: 'batch_incomplete',
          title: '批次待录入',
          description: `${incompleteBatches.length} 个批次尚未录满，共 ${incompleteBatches.reduce((s: number, b: any) => s + ((b.quantity || 0) - (b.itemsCount || 0)), 0)} 件待录入`,
          icon: <Package className="h-4 w-4" />,
          color: 'text-red-600 bg-red-50 dark:bg-red-950/30',
          dotColor: 'bg-red-500',
          tab: 'batches',
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Low margin items
      const allItems = await itemsApi.getItems({ page: 1, size: 200, status: 'in_stock' });
      const lowMarginItems = (allItems.items || []).filter((i: any) => {
        const cost = i.allocatedCost || i.estimatedCost || i.costPrice || 0;
        const price = i.sellingPrice || 0;
        return cost > 0 && price > 0 && (price - cost) / price < 0.3;
      });
      if (lowMarginItems.length > 0) {
        notifs.push({
          id: 'low_margin',
          type: 'low_margin',
          title: '低毛利预警',
          description: `${lowMarginItems.length} 件在库货品毛利率低于30%，建议调整定价`,
          icon: <TrendingDown className="h-4 w-4" />,
          color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
          dotColor: 'bg-orange-500',
          tab: 'inventory',
          timestamp: new Date().toISOString(),
        });
      }

      // 4. Today's summary
      const today = new Date().toISOString().slice(0, 10);
      const todaySales = await dashboardApi.getSummary({ start_date: today, end_date: today });
      if (todaySales && (todaySales.totalSales > 0 || todaySales.totalRevenue > 0)) {
        notifs.push({
          id: 'today_summary',
          type: 'today_summary',
          title: '今日销售',
          description: `已售 ${todaySales.totalSales || 0} 件，营收 ¥${((todaySales.totalRevenue || 0)).toFixed(0)}`,
          icon: <ShoppingCart className="h-4 w-4" />,
          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
          dotColor: 'bg-emerald-500',
          tab: 'dashboard',
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Silently fail - notifications are non-critical
    }

    setNotifications(notifs);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async API fetch, setState in callback is acceptable
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const unreadCount = notifications.filter(n => !dismissed.has(n.id)).length;
  const MAX_VISIBLE = 5;

  function dismissAll() {
    setDismissed(new Set(notifications.map(n => n.id)));
  }

  function handleViewDetail(notif: Notification) {
    setActiveTab(notif.tab);
    setOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0"
        onClick={() => { setOpen(!open); }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center animate-in zoom-in duration-200">
            {unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              通知提醒
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </h4>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={dismissAll}
              >
                <Eye className="h-3 w-3 mr-1" />
                全部已读
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <ScrollArea className="max-h-80">
            {unreadCount === 0 && notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                <p className="text-sm font-medium">暂无新通知</p>
                <p className="text-xs mt-1">所有指标正常</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.slice(0, MAX_VISIBLE).map(notif => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 transition-colors hover:bg-muted/50 ${dismissed.has(notif.id) ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon with color dot */}
                      <div className="relative shrink-0">
                        <div className={`rounded-lg p-1.5 ${notif.color}`}>
                          {notif.icon}
                        </div>
                        {!dismissed.has(notif.id) && (
                          <div className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${notif.dotColor} ring-2 ring-card`} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{notif.title}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatRelativeTime(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notif.description}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-foreground px-0 mt-1"
                          onClick={() => handleViewDetail(notif)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          查看详情
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer with "查看全部" */}
          {notifications.length > MAX_VISIBLE && (
            <div className="border-t px-4 py-2 bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setActiveTab('dashboard');
                  setOpen(false);
                }}
              >
                <Eye className="h-3 w-3 mr-1" />
                查看全部 {notifications.length} 条通知
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
