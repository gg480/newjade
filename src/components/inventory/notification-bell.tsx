'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '@/lib/api';
import { useAppStore, TabId } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, AlertTriangle, Package, TrendingDown, ShoppingCart,
  CheckCircle2, Eye, ChartBar, TrendingUp,
} from 'lucide-react';
import ReportDetailDialog from './report-detail-dialog';

// ============================================================
// 类型定义
// ============================================================

/** 后端返回的通知原始结构 */
interface NotificationItem {
  id: number;
  type: 'weekly_report' | 'monthly_report' | 'overdue' | 'batch_incomplete' | 'low_margin' | 'today_summary';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

/** 前端渲染用的通知对象 */
interface DisplayNotification {
  item: NotificationItem;
  typeMeta: TypeMeta;
  description: string;
}

/** 每种通知类型的图标/颜色/跳转目标 */
interface TypeMeta {
  icon: React.ReactNode;
  color: string;
  dotColor: string;
  tab: TabId | null; // null 表示报表类型，点击打开弹窗而非跳转Tab
}

// ============================================================
// 类型 → 元数据映射
// ============================================================

function getTypeMeta(type: NotificationItem['type']): TypeMeta {
  switch (type) {
    case 'weekly_report':
      return {
        icon: <ChartBar className="h-4 w-4" />,
        color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
        dotColor: 'bg-blue-500',
        tab: null,
      };
    case 'monthly_report':
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
        dotColor: 'bg-purple-500',
        tab: null,
      };
    case 'overdue':
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
        dotColor: 'bg-amber-500',
        tab: 'inventory',
      };
    case 'batch_incomplete':
      return {
        icon: <Package className="h-4 w-4" />,
        color: 'text-red-600 bg-red-50 dark:bg-red-950/30',
        dotColor: 'bg-red-500',
        tab: 'batches',
      };
    case 'low_margin':
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
        dotColor: 'bg-orange-500',
        tab: 'inventory',
      };
    case 'today_summary':
      return {
        icon: <ShoppingCart className="h-4 w-4" />,
        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
        dotColor: 'bg-emerald-500',
        tab: 'dashboard',
      };
  }
}

// ============================================================
// 工具函数
// ============================================================

/** 从通知 content JSON 中提取展示文本 */
function extractDescription(item: NotificationItem): string {
  try {
    const content = JSON.parse(item.content);
    if (content.description) return content.description;
    // 报表类型从 summary 构造描述
    if (item.type === 'weekly_report' || item.type === 'monthly_report') {
      const s = content.summary;
      if (s) {
        return `销售额 ¥${(s.revenue ?? 0).toLocaleString()}，利润 ¥${(s.profit ?? 0).toLocaleString()}，销量 ${s.soldCount ?? 0} 件`;
      }
    }
  } catch { /* content 可能不是有效 JSON */ }
  return '';
}

/** 相对时间格式化 */
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

const MAX_VISIBLE = 5;

// ============================================================
// 组件
// ============================================================

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setActiveTab } = useAppStore();

  // ========== 数据加载 ==========

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationsApi.getNotifications({ page: 1, size: 20 });
      setItems(data.items || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载通知失败';
      setError(msg);
      console.error('[NotificationBell] 加载失败:', e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 异步API获取，setState在回调中可接受
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // ========== 点击外部关闭 ==========

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

  // ========== 已读/未读 ==========

  const unreadCount = items.filter(n => !n.isRead).length;
  const allRead = unreadCount === 0;

  /** 标记全部已读 */
  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllAsRead();
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error('[NotificationBell] 全部已读失败:', e);
    }
  }

  /** 标记单条已读 */
  async function markSingleRead(id: number) {
    try {
      await notificationsApi.markAsRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error(`[NotificationBell] 标记已读失败 id=${id}:`, e);
    }
  }

  // ========== 交互处理 ==========

  function handleItemClick(item: NotificationItem) {
    const meta = getTypeMeta(item.type);

    // 标记已读
    if (!item.isRead) {
      markSingleRead(item.id);
    }

    // 周报/月报 → 打开报表弹窗
    if (item.type === 'weekly_report' || item.type === 'monthly_report') {
      setSelectedReport(item);
      setReportDialogOpen(true);
      setOpen(false);
      return;
    }

    // 其他类型 → 跳转对应 Tab
    if (meta.tab) {
      setActiveTab(meta.tab);
    }
    setOpen(false);
  }

  // ========== 构建渲染数据 ==========

  const displayItems: DisplayNotification[] = items.slice(0, MAX_VISIBLE).map(item => ({
    item,
    typeMeta: getTypeMeta(item.type),
    description: extractDescription(item),
  }));

  // ========== 渲染 ==========

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 铃铛按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0"
        onClick={() => { setOpen(!open); }}
        title={error ? `通知加载失败: ${error}` : '通知提醒'}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center animate-in zoom-in duration-200">
            {unreadCount}
          </span>
        )}
        {/* 错误指示 */}
        {error && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card" />
        )}
      </Button>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
          {/* 头部 */}
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
            {!allRead && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleMarkAllRead}
              >
                <Eye className="h-3 w-3 mr-1" />
                全部已读
              </Button>
            )}
          </div>

          {/* 通知列表 */}
          <ScrollArea className="max-h-80">
            {displayItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                <p className="text-sm font-medium">暂无新通知</p>
                <p className="text-xs mt-1">所有指标正常</p>
              </div>
            ) : (
              <div className="divide-y">
                {displayItems.map(({ item, typeMeta, description }) => (
                  <div
                    key={item.id}
                    className={`px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer ${item.isRead ? 'opacity-50' : ''}`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-start gap-3">
                      {/* 图标 + 颜色标记 */}
                      <div className="relative shrink-0">
                        <div className={`rounded-lg p-1.5 ${typeMeta.color}`}>
                          {typeMeta.icon}
                        </div>
                        {!item.isRead && (
                          <div className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${typeMeta.dotColor} ring-2 ring-card`} />
                        )}
                      </div>
                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        {description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {item.type === 'weekly_report' || item.type === 'monthly_report' ? (
                            <span className="text-[10px] text-blue-500 font-medium">查看报表</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">查看详情</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* 底部：总条数提示 */}
          {items.length > MAX_VISIBLE && (
            <div className="border-t px-4 py-2 bg-muted/30 text-center">
              <span className="text-xs text-muted-foreground">
                共 {items.length} 条通知
              </span>
            </div>
          )}
        </div>
      )}

      {/* 报表详情弹窗 */}
      <ReportDetailDialog
        open={reportDialogOpen}
        onClose={() => { setReportDialogOpen(false); setSelectedReport(null); }}
        notification={selectedReport}
      />
    </div>
  );
}
