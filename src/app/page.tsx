'use client';

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAppStore, TabId } from '@/lib/store';
import { fadeInStyle, cardSlideUpStyle, ErrorBoundary, LoadingSkeleton } from '@/components/inventory/shared';
import SalesTab from '@/components/inventory/sales-tab';
import BatchesTab from '@/components/inventory/batches-tab';
import CustomersTab from '@/components/inventory/customers-tab';
import LogsTab from '@/components/inventory/logs-tab';

const DashboardTab = lazy(() => import('@/components/inventory/dashboard-tab'));
const InventoryTab = lazy(() => import('@/components/inventory/inventory-tab'));
const SettingsTab = lazy(() => import('@/components/inventory/settings-tab'));
import { MobileNav, DesktopNav, ShortcutsHelpDialog } from '@/components/inventory/navigation';
import { Gem, Package, ShoppingCart, Zap, Clock, ArrowUp, HelpCircle, WifiOff } from 'lucide-react';
import { Toaster } from 'sonner';
import { itemsApi, salesApi, batchesApi } from '@/lib/api';
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip';


// Ensure keyframes are injected
void fadeInStyle;
void cardSlideUpStyle;

// ========== Quick Stats Footer ==========
function QuickStatsBar() {
  const [inventoryValue, setInventoryValue] = useState<number | null>(null);
  const [todaySales, setTodaySales] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [pendingBatches, setPendingBatches] = useState(0);

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [itemsData, salesData, batchesData] = await Promise.allSettled([
        itemsApi.getItems({ page: 1, size: 1, status: 'in_stock' }),
        salesApi.getSales({ page: 1, size: 1000, start_date: today, end_date: today }),
        batchesApi.getBatches({ page: 1, size: 100 }),
      ]);
      if (itemsData.status === 'fulfilled') {
        setInventoryValue(itemsData.value.pagination?.total || 0);
      }
      if (salesData.status === 'fulfilled') {
        const sales = salesData.value.items || [];
        setTodaySales(sales.length);
        setTodayRevenue(sales.reduce((sum: number, s: any) => sum + (s.actualPrice || 0), 0));
      }
      if (batchesData.status === 'fulfilled') {
        const batches = batchesData.value.items || [];
        setPendingBatches(batches.filter((b: any) => (b.itemsCount || 0) < (b.quantity || 0)).length);
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadStats, 0);
    const interval = setInterval(loadStats, 30000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  const statItems = [
    { icon: Package, iconCls: 'text-emerald-600', label: '在库:', val: inventoryValue ?? '...', tip: '当前在库货品总数', valCls: '' },
    { icon: ShoppingCart, iconCls: 'text-sky-600', label: '今日销售:', val: `${todaySales} 件`, tip: '今日已售出货品数量', valCls: '' },
    { icon: Zap, iconCls: 'text-amber-600', label: '今日营收:', val: `¥${todayRevenue.toFixed(2)}`, tip: '今日销售总金额', valCls: 'text-emerald-600' },
    { icon: Clock, iconCls: 'text-orange-500', label: '批次待录入:', val: `${pendingBatches}`, tip: `有 ${pendingBatches} 个批次尚未录入完成`, valCls: pendingBatches > 0 ? 'text-orange-600' : '' },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 flex-wrap">
        {statItems.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className="w-px h-4 bg-border" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="card-slide-up flex items-center gap-1.5 text-sm cursor-default" style={{ animationDelay: `${i * 0.1}s` }}>
                  <s.icon className={`h-3.5 w-3.5 ${s.iconCls}`} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className={`font-semibold ${s.valCls}`}>{s.val}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{s.tip}</TooltipContent>
            </Tooltip>
          </React.Fragment>
        ))}
      </div>
    </TooltipProvider>
  );
}

// ========== Mobile Quick Stats (fixed bottom bar) ==========
function MobileQuickStats({ className }: { className?: string }) {
  const [inventoryValue, setInventoryValue] = useState<number | null>(null);
  const [todaySales, setTodaySales] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [itemsData, salesData] = await Promise.allSettled([
        itemsApi.getItems({ page: 1, size: 1, status: 'in_stock' }),
        salesApi.getSales({ page: 1, size: 1000, start_date: today, end_date: today }),
      ]);
      if (itemsData.status === 'fulfilled') {
        setInventoryValue(itemsData.value.pagination?.total || 0);
      }
      if (salesData.status === 'fulfilled') {
        const sales = salesData.value.items || [];
        setTodaySales(sales.length);
        setTodayRevenue(sales.reduce((sum: number, s: any) => sum + (s.actualPrice || 0), 0));
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadStats, 0);
    const interval = setInterval(loadStats, 30000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  return (
    <div className={`md:hidden fixed bottom-14 left-0 right-0 z-40 bg-card border-t border-border py-2 px-4 ${className || ''}`}>
      <div className="flex items-center justify-around text-xs">
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3 text-emerald-600" />
          <span className="text-muted-foreground">在库</span>
          <span className="font-bold">{inventoryValue ?? '...'}</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1">
          <ShoppingCart className="h-3 w-3 text-sky-600" />
          <span className="text-muted-foreground">今日</span>
          <span className="font-bold">{todaySales}</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-600" />
          <span className="text-muted-foreground">营收</span>
          <span className="font-bold text-emerald-600">¥{todayRevenue.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

// ========== Main Page ==========
export default function JadeInventoryPage() {
  const { activeTab, setActiveTab } = useAppStore();
  const [animKey, setAnimKey] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof window !== 'undefined' ? navigator.onLine : true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [apiLoading, setApiLoading] = useState(false);

  // Dynamic page title based on active tab
  useEffect(() => {
    const titleMap: Record<TabId, string> = {
      dashboard: '看板 - 翡翠珠宝进销存',
      inventory: '库存管理 - 翡翠珠宝进销存',
      sales: '销售记录 - 翡翠珠宝进销存',
      batches: '批次管理 - 翡翠珠宝进销存',
      customers: '客户管理 - 翡翠珠宝进销存',
      logs: '操作日志 - 翡翠珠宝进销存',
      settings: '系统设置 - 翡翠珠宝进销存',
    };
    document.title = titleMap[activeTab] || '翡翠珠宝进销存管理系统';
    return () => { document.title = '翡翠珠宝进销存管理系统'; };
  }, [activeTab]);

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update footer time every 30 seconds
  useEffect(() => {
    function updateTime() {
      setLastUpdateTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    }
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setAnimKey(k => k + 1);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const tabMap: Record<string, TabId> = {
      '1': 'dashboard', '2': 'inventory', '3': 'sales',
      '4': 'batches', '5': 'customers', '6': 'settings', '7': 'logs',
    };

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;

      // Enter to trigger search when in search input
      if (e.key === 'Enter' && target.tagName === 'INPUT' && !e.metaKey && !e.ctrlKey) {
        const placeholder = (target as HTMLInputElement).placeholder || '';
        if (placeholder.includes('SKU') || placeholder.includes('搜索') || placeholder.includes('客户')) {
          target.closest('form')?.requestSubmit?.();
          e.preventDefault();
          return;
        }
      }

      // Escape: close any open dialog/panel
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // Dispatch custom event for child components to listen to
        window.dispatchEvent(new CustomEvent('escape-press'));
        return;
      }

      // Ctrl/Cmd + N: open new item create dialog (inventory tab)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (activeTab === 'inventory') {
          setActiveTab('inventory');
          // Dispatch event for inventory tab to listen
          window.dispatchEvent(new CustomEvent('shortcut-new-item'));
          setAnimKey(k => k + 1);
        }
        return;
      }

      // Ctrl/Cmd + E: open export dialog (inventory tab)
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('shortcut-export'));
        return;
      }

      // Ignore if user is typing in an input/textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }

      // Tab switching with number keys
      if (tabMap[e.key]) {
        e.preventDefault();
        handleTabChange(tabMap[e.key]);
        return;
      }

      // Ctrl/Cmd + K: focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab('inventory');
        setAnimKey(k => k + 1);
        // Focus search input after a brief delay for tab to render
        const focusSearch = () => {
          const selectors = [
            'input[placeholder*="SKU"]',
            'input[name="search"]',
            '[data-testid="inventory-search"]',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel) as HTMLInputElement;
            if (el) { el.focus(); return true; }
          }
          return false;
        };
        if (!focusSearch()) {
          setTimeout(focusSearch, 200);
          setTimeout(focusSearch, 500);
        }
        return;
      }

      // Alt+1~5: switch to first 5 tabs
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const altTabMap: Record<string, TabId> = {
          '1': 'dashboard', '2': 'inventory', '3': 'sales',
          '4': 'batches', '5': 'customers',
        };
        if (altTabMap[e.key]) {
          e.preventDefault();
          handleTabChange(altTabMap[e.key]);
          return;
        }
      }

      // ? key: show shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, setActiveTab]);

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'inventory': return <InventoryTab />;
      case 'sales': return <SalesTab />;
      case 'batches': return <BatchesTab />;
      case 'customers': return <CustomersTab />;
      case 'logs': return <LogsTab />;
      case 'settings': return <SettingsTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="min-h-screen flex flex-col bg-background" id="app-root">
      {/* Top Loading Bar */}
      <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none">
        <div className="loading-bar h-full w-full" />
      </div>
      <DesktopNav activeTab={activeTab} onTabChange={handleTabChange} className="no-print" />
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white text-center text-sm py-1.5 px-4 animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-3.5 w-3.5" />
            <span>网络连接已断开，部分功能可能不可用</span>
          </div>
        </div>
      )}
      <main className={`flex-1 px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6 max-w-7xl mx-auto w-full ${!isOnline ? 'pt-8' : ''}`}>
        <div key={animKey} className="tab-fade-in">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              {renderTab()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <MobileNav activeTab={activeTab} onTabChange={handleTabChange} className="no-print" />
      <MobileQuickStats className="no-print" />
      <footer className="no-print mt-auto hidden md:block border-t border-border bg-card py-3">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><Gem className="h-4 w-4 text-emerald-600" />玉器进销存管理系统</span>
            <div className="w-px h-4 bg-border" />
            <QuickStatsBar />
          </div>
          <div className="flex items-center gap-3">
            {/* Data loading indicator */}
            {apiLoading && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="loading-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>加载中</span>
              </span>
            )}
            <span className="text-muted-foreground text-xs">按 ? 查看快捷键</span>
            <span className="text-muted-foreground text-xs">最后更新: {lastUpdateTime}</span>
            <span className="text-muted-foreground">技术支持: Z.ai</span>
          </div>
        </div>
      </footer>
      <ShortcutsHelpDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
      {/* Floating Keyboard Shortcuts Help Button (desktop only) */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="no-print hidden md:flex fixed bottom-6 left-6 z-20 h-8 w-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground shadow-sm hover:shadow-md items-center justify-center transition-all"
        title="快捷键帮助 (? )"
        aria-label="快捷键帮助"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {/* Scroll-to-Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`no-print fixed bottom-20 md:bottom-6 right-4 z-20 h-9 w-9 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 flex items-center justify-center transition-opacity duration-200 ${showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="回到顶部"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      </div>
    </>
  );
}
