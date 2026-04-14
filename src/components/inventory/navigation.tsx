'use client';

import React, { useState, useEffect } from 'react';
import { TabId } from '@/lib/store';
import ThemeToggle from './theme-toggle';
import NotificationBell from './notification-bell';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, Package, ShoppingCart, Layers, Users, Settings,
  BarChart3, Gem, ScrollText, Keyboard,
} from 'lucide-react';

// ========== Mobile Bottom Navigation ==========
function MobileNav({ activeTab, onTabChange, className }: { activeTab: TabId; onTabChange: (t: TabId) => void; className?: string }) {
  const [pendingBatches, setPendingBatches] = useState(0);
  const [hasSalesToday, setHasSalesToday] = useState(false);
  const [tapAnim, setTapAnim] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/batches?page=1&size=100');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const batches = data.items || [];
        setPendingBatches(batches.filter((b: any) => (b.itemsCount || 0) < (b.quantity || 0)).length);
      } catch { /* silently fail */ }
      // Check sales today
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const salesRes = await fetch(`/api/sales?start_date=${todayStr}&end_date=${todayStr}&size=1`);
        if (salesRes.ok && !cancelled) {
          const salesData = await salesRes.json();
          setHasSalesToday((salesData.pagination?.total || 0) > 0);
        }
      } catch { /* silently fail */ }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const tabs: { id: TabId; label: string; icon: React.ElementType; title: string }[] = [
    { id: 'dashboard', label: '看板', icon: BarChart3, title: '利润看板 - 销售统计和数据分析' },
    { id: 'inventory', label: '库存', icon: Package, title: '库存管理 - 货品入库、出库和查询' },
    { id: 'sales', label: '销售', icon: ShoppingCart, title: '销售记录 - 销售数据和分析' },
    { id: 'batches', label: '批次', icon: Layers, title: '批次管理 - 批量采购和录入' },
    { id: 'customers', label: '客户', icon: Users, title: '客户管理 - 客户信息和VIP体系' },
    { id: 'logs', label: '日志', icon: ScrollText, title: '操作日志 - 系统操作记录查询' },
    { id: 'settings', label: '设置', icon: Settings, title: '系统设置 - 配置和数据管理' },
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 md:hidden bg-background/95 backdrop-blur-sm border-t border-border shadow-lg pb-safe z-50 ${className || ''}`}>
      <div className="flex items-center h-14">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const isTapping = tapAnim === tab.id;
          return (
            <button key={tab.id} onClick={() => {
              // Haptic-like feedback: scale down then up
              setTapAnim(tab.id);
              setTimeout(() => setTapAnim(null), 100);
              onTabChange(tab.id);
            }}
              title={tab.title}
              className={`flex-1 flex flex-col items-center justify-center h-full text-[10px] font-medium gap-0.5 ${active ? 'text-emerald-600' : 'text-muted-foreground'} active:scale-95 transition-transform duration-75`}
              aria-current={active ? 'page' : undefined}
            >
              <div className={`relative transition-transform duration-150 ${active ? 'scale-110' : ''} ${isTapping ? 'scale-90' : ''}`}>
                <Icon className="h-5 w-5" />
                {/* Batches pending badge (red, with count) */}
                {tab.id === 'batches' && pendingBatches > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                    {pendingBatches > 99 ? '99+' : pendingBatches}
                  </span>
                )}
                {/* Sales today dot (just a red dot, no count) */}
                {tab.id === 'sales' && hasSalesToday && !active && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </div>
              <span>{tab.label}</span>
              {active && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== Keyboard Shortcuts Help Dialog ==========
function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const shortcuts = [
    { keys: '⌘/Ctrl + K', description: '聚焦搜索栏' },
    { keys: '⌘/Ctrl + N', description: '新增入库（库存页）' },
    { keys: '⌘/Ctrl + E', description: '导出数据（库存页）' },
    { keys: 'Enter', description: '在搜索框内触发搜索' },
    { keys: 'Esc', description: '关闭对话框/面板' },
    { keys: '?', description: '显示快捷键帮助' },
    { keys: '1-7', description: '切换标签页 (看板/库存/销售/批次/客户/设置/日志)' },
  ];

  const tabShortcuts = [
    { key: '1', tab: '看板' },
    { key: '2', tab: '库存' },
    { key: '3', tab: '销售' },
    { key: '4', tab: '批次' },
    { key: '5', tab: '客户' },
    { key: '6', tab: '设置' },
    { key: '7', tab: '日志' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" /> 快捷键
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-2">通用快捷键</p>
            <div className="space-y-2">
              {shortcuts.map(s => (
                <div key={s.keys} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.description}</span>
                  <Badge variant="outline" className="font-mono text-xs">{s.keys}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">标签页切换</p>
            <div className="grid grid-cols-2 gap-2">
              {tabShortcuts.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="font-mono text-xs w-6 justify-center">{s.key}</Badge>
                  <span className="text-muted-foreground">{s.tab}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== Desktop Top Navigation ==========
function DesktopNav({ activeTab, onTabChange, className }: { activeTab: TabId; onTabChange: (t: TabId) => void; className?: string }) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const tabs: { id: TabId; label: string; icon: React.ElementType; title: string; shortcut?: string }[] = [
    { id: 'dashboard', label: '利润看板', icon: LayoutDashboard, title: '利润看板 - 销售统计和数据分析', shortcut: 'Alt+1' },
    { id: 'inventory', label: '库存管理', icon: Package, title: '库存管理 - 货品入库、出库和查询', shortcut: 'Alt+2' },
    { id: 'sales', label: '销售记录', icon: ShoppingCart, title: '销售记录 - 销售数据和分析', shortcut: 'Alt+3' },
    { id: 'batches', label: '批次管理', icon: Layers, title: '批次管理 - 批量采购和录入', shortcut: 'Alt+4' },
    { id: 'customers', label: '客户管理', icon: Users, title: '客户管理 - 客户信息和VIP体系', shortcut: 'Alt+5' },
    { id: 'logs', label: '操作日志', icon: ScrollText, title: '操作日志 - 系统操作记录查询' },
    { id: 'settings', label: '系统设置', icon: Settings, title: '系统设置 - 配置和数据管理' },
  ];

  return (
    <>
      <nav className={`hidden md:flex bg-card border-b border-border ${className || ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center h-14">
            <div className="flex items-center mr-8">
              <Gem className="h-5 w-5 text-emerald-600 mr-2 animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="text-lg font-bold text-emerald-600">玉器进销存</span>
            </div>
            <div className="flex space-x-1 flex-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => onTabChange(tab.id)}
                    title={tab.title}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ease-out flex items-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${active ? 'nav-tab-active text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4" />{tab.label}
                    {tab.shortcut && <span className="hidden lg:inline-block text-[10px] text-muted-foreground/60 ml-1 font-mono">{tab.shortcut.replace('Alt+', '')}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setShowShortcuts(true)} title="快捷键">
                <Keyboard className="h-4 w-4" />
              </Button>

              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>
      <ShortcutsHelpDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    </>
  );
}

export { MobileNav, DesktopNav, ShortcutsHelpDialog };
