'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { request } from '@/lib/api';
import { TabId, NavGroup, useAppStore } from '@/lib/store';
import ThemeToggle from './theme-toggle';
import NotificationBell from './notification-bell';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Batch, SysConfig } from '@/lib/api.types';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package, ShoppingCart, Settings,
  BarChart3, Keyboard, LogOut, ChevronDown,
} from 'lucide-react';

// ========== Navigation Groups (二级菜单架构) ==========
const NAV_GROUPS: NavGroup[] = [
  { id: 'dashboard', label: '看板', icon: BarChart3, children: [] },
  { id: 'inventory', label: '库存', icon: Package, children: [
    { id: 'inventory' as TabId, label: '货品管理' },
    { id: 'batches' as TabId, label: '批次管理' },
    { id: 'stocktaking' as TabId, label: '库存盘点' },
    { id: 'restock' as TabId, label: '入货建议' },
  ]},
  { id: 'sales', label: '销售', icon: ShoppingCart, children: [
    { id: 'sales' as TabId, label: '销售记录' },
    { id: 'customers' as TabId, label: '客户管理' },
    { id: 'promotions' as TabId, label: '促销活动' },
  ]},
  { id: 'settings', label: '系统设置', icon: Settings, children: [
    { id: 'settings' as TabId, label: '系统设置' },
    { id: 'logs' as TabId, label: '操作日志' },
  ]},
];

function filterNavGroups(groups: NavGroup[], permissions: string[]): NavGroup[] {
  return groups
    .map(group => {
      if (group.id === 'dashboard') {
        return permissions.includes('tab:dashboard') ? group : null;
      }
      // 过滤子菜单项
      const filteredChildren = group.children.filter(child =>
        permissions.includes(`tab:${child.id}`)
      );
      // 如果顶级菜单本身没有子菜单权限检查，但至少保留一个子菜单
      if (filteredChildren.length === 0) return null;
      return { ...group, children: filteredChildren };
    })
    .filter(Boolean) as NavGroup[];
}

function useFilteredNavGroups(): NavGroup[] {
  const permissions = useAppStore(s => s.currentUser?.permissions || []);
  return filterNavGroups(NAV_GROUPS, permissions);
}

function getGroupId(tabId: TabId): string {
  if (tabId === 'dashboard') return 'dashboard';
  if (['inventory', 'batches', 'stocktaking', 'restock'].includes(tabId)) return 'inventory';
  if (['sales', 'customers', 'promotions'].includes(tabId)) return 'sales';
  return 'settings';
}

// ========== Mobile Bottom Navigation ==========
function MobileNav({ activeTab, onTabChange, className, onLogout }: { activeTab: TabId; onTabChange: (t: TabId) => void; className?: string; onLogout?: () => void }) {
  const [pendingBatches, setPendingBatches] = useState(0);
  const [hasSalesToday, setHasSalesToday] = useState(false);
  const [tapAnim, setTapAnim] = useState<string | null>(null);
  const navGroups = useFilteredNavGroups();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await request<any>('/batches?page=1&size=100');
        if (cancelled) return;
        const batches = data.items || [];
        setPendingBatches(batches.filter((b: Batch) => (b.itemsCount || 0) < (b.quantity || 0)).length);
      } catch (e) { console.error('[Nav]', e); /* silently fail */ }
      // Check sales today
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const salesData = await request<any>(`/sales?start_date=${todayStr}&end_date=${todayStr}&size=1`);
        if (!cancelled) {
          setHasSalesToday((salesData.pagination?.total || 0) > 0);
        }
      } catch (e) { console.error('[Nav]', e); /* silently fail */ }
    };
    // Delay initial load to avoid competing with dashboard requests
    const timer = setTimeout(load, 3000);
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(interval); };
  }, []);

  const activeGroupId = getGroupId(activeTab);

  return (
    <div className={`fixed bottom-0 left-0 right-0 md:hidden bg-background/95 backdrop-blur-sm border-t border-border shadow-lg pb-safe z-50 ${className || ''}`}>
      <div className="flex items-center h-14">
        {navGroups.map(group => {
          const Icon = group.icon;
          const isActiveGroup = activeGroupId === group.id;
          const isTapping = tapAnim === group.id;

          // Dashboard: direct button
          if (group.id === 'dashboard') {
            return (
              <button key={group.id} onClick={() => {
                setTapAnim(group.id);
                setTimeout(() => setTapAnim(null), 100);
                onTabChange('dashboard');
              }}
                className={`flex-1 flex flex-col items-center justify-center h-full text-[10px] font-medium gap-0.5 ${isActiveGroup ? 'text-jade-600' : 'text-muted-foreground'} active:scale-95 transition-transform duration-75`}
                aria-current={isActiveGroup ? 'page' : undefined}
              >
                <div className={`relative transition-transform duration-150 ${isActiveGroup ? 'scale-110' : ''} ${isTapping ? 'scale-90' : ''}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span>{group.label}</span>
                {isActiveGroup && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-jade-500 rounded-full shadow-[0_0_6px_rgba(26,122,90,0.4)]" />
                )}
              </button>
            );
          }

          // Other groups: DropdownMenu (mobile: side="top")
          return (
            <DropdownMenu key={group.id}>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex-1 flex flex-col items-center justify-center h-full text-[10px] font-medium gap-0.5 ${isActiveGroup ? 'text-jade-600' : 'text-muted-foreground'} active:scale-95 transition-transform duration-75`}
                  aria-current={isActiveGroup ? 'page' : undefined}
                >
                  <div className={`relative transition-transform duration-150 ${isActiveGroup ? 'scale-110' : ''}`}>
                    <Icon className="h-5 w-5" />
                    {/* Batches pending badge */}
                    {group.id === 'inventory' && pendingBatches > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                        {pendingBatches > 99 ? '99+' : pendingBatches}
                      </span>
                    )}
                    {/* Sales today dot */}
                    {group.id === 'sales' && hasSalesToday && !isActiveGroup && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </div>
                  <span>{group.label}</span>
                  {isActiveGroup && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-jade-500 rounded-full shadow-[0_0_6px_rgba(26,122,90,0.4)]" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center" className="max-h-64 overflow-y-auto">
                {group.children.map(child => (
                  <DropdownMenuItem key={child.id} onClick={() => {
                    setTapAnim(group.id);
                    setTimeout(() => setTapAnim(null), 100);
                    onTabChange(child.id);
                  }}
                    className={`cursor-pointer ${activeTab === child.id ? 'text-jade-600 font-medium' : ''}`}
                  >
                    {child.label}
                    {activeTab === child.id && (
                      <span className="ml-2 h-1.5 w-1.5 rounded-full bg-jade-500" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
        {/* 移动端登出按钮 */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center justify-center h-10 w-10 ml-1 text-muted-foreground hover:text-red-500 active:scale-90 transition-all rounded-lg"
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
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
    { keys: '1-8', description: '切换标签页 (看板/货品/销售/批次/客户/促销/设置/日志)' },
  ];

  const tabShortcuts = [
    { key: '1', tab: '看板' },
    { key: '2', tab: '货品管理' },
    { key: '3', tab: '销售记录' },
    { key: '4', tab: '批次管理' },
    { key: '5', tab: '客户管理' },
    { key: '6', tab: '促销活动' },
    { key: '7', tab: '系统设置' },
    { key: '8', tab: '操作日志' },
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
function DesktopNav({ activeTab, onTabChange, className, loading = false, onLogout }: { activeTab: TabId; onTabChange: (t: TabId) => void; className?: string; loading?: boolean; onLogout?: () => void }) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [storeName, setStoreName] = useState(() => {
    try {
      if (typeof window === 'undefined') return '兴盛艺珠宝';
      const stored = localStorage.getItem('jade_system_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.storeName) return parsed.storeName;
      }
    } catch (e) { console.error('[Nav]', e);}
    return '兴盛艺珠宝';
  });
  const navGroups = useFilteredNavGroups();

  useEffect(() => {
    // Sync store name from server config
    let mounted = true;
    request<SysConfig[]>('/config')
      .then(data => {
        if (mounted && Array.isArray(data)) {
          const cfg = data.find((c: SysConfig) => c.key === 'store_name');
          if (cfg?.value) setStoreName(cfg.value);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const activeGroupId = getGroupId(activeTab);

  return (
    <>
      <nav className={`hidden md:flex bg-card border-b border-border shadow-sm ${className || ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center h-14">
            <div className="flex items-center mr-8 gap-2">
              <div className="relative">
                <img
                  src="/logo-xingshengyi.png"
                  alt="兴盛艺珠宝"
                  className={`h-7 w-7 rounded-md object-cover ring-1 ring-jade-200 dark:ring-jade-800 ${loading ? 'animate-pulse' : ''}`}
                  style={loading ? { animationDuration: '1.2s' } : undefined}
                />
                {/* 翡翠绿色角标装饰 */}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-jade-500 rounded-full ring-1 ring-background" />
              </div>
              <span className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-noto-serif), var(--font-geist-sans), serif' }}>{storeName}</span>
            </div>
            <div className="flex space-x-1 flex-1">
              {navGroups.map(group => {
                const Icon = group.icon;
                const isActiveGroup = activeGroupId === group.id;

                // Dashboard: direct button
                if (group.id === 'dashboard') {
                  return (
                    <button key={group.id} onClick={() => onTabChange('dashboard')}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ease-out flex items-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-jade-500 focus-visible:ring-offset-2 ${isActiveGroup ? 'nav-tab-active text-jade-700 dark:text-jade-300' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      aria-current={isActiveGroup ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" />{group.label}
                    </button>
                  );
                }

                // Other groups: DropdownMenu
                return (
                  <DropdownMenu key={group.id}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ease-out flex items-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-jade-500 focus-visible:ring-offset-2 ${isActiveGroup ? 'nav-tab-active text-jade-700 dark:text-jade-300' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        aria-current={isActiveGroup ? 'page' : undefined}
                      >
                        <Icon className="h-4 w-4" />{group.label}
                        <ChevronDown className={`h-3.5 w-3.5 ml-0.5 transition-transform duration-200 ${isActiveGroup ? 'rotate-180' : ''} text-muted-foreground/60`} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[150px] p-1.5">
                      {group.children.map(child => (
                        <DropdownMenuItem key={child.id} onClick={() => onTabChange(child.id)}
                          className={`cursor-pointer rounded-md transition-colors ${activeTab === child.id ? 'bg-jade-50 dark:bg-jade-950/40 text-jade-600 font-medium' : ''}`}
                        >
                          {child.label}
                          {activeTab === child.id && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-jade-500 shadow-[0_0_4px_rgba(26,122,90,0.35)]" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setShowShortcuts(true)} title="快捷键" aria-label="快捷键">
                <Keyboard className="h-4 w-4" aria-hidden="true" />
              </Button>
              {onLogout && (
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-red-500" onClick={onLogout} title="退出登录" aria-label="退出登录">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
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
