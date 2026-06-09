'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore, TabId } from '@/lib/store';
import { fadeInStyle, cardSlideUpStyle, ErrorBoundary, LoadingSkeleton } from '@/components/inventory/shared';
import SalesTab from '@/components/inventory/sales-tab';
import BatchesTab from '@/components/inventory/batches-tab';
import CustomersTab from '@/components/inventory/customers-tab';
import LogsTab from '@/components/inventory/logs-tab';
import LoginPage from '@/components/inventory/login-page';

const DashboardTab = dynamic(
  () => import('@/components/inventory/dashboard-tab').catch(() => {
    console.error('Dashboard tab chunk failed to load');
    return { default: () => <div className="p-8 text-center text-muted-foreground">Dashboard failed to load</div> };
  }),
  { ssr: false, loading: () => <LoadingSkeleton /> }
);
const InventoryTab = dynamic(
  () => import('@/components/inventory/inventory-tab').catch(() => {
    console.error('Inventory tab chunk failed to load');
    return { default: () => <div className="p-8 text-center text-muted-foreground">Inventory failed to load</div> };
  }),
  { ssr: false, loading: () => <LoadingSkeleton /> }
);
const SettingsTab = dynamic(
  () => import('@/components/inventory/settings-tab').catch(() => {
    console.error('Settings tab chunk failed to load');
    return { default: () => <div className="p-8 text-center text-muted-foreground">Settings failed to load</div> };
  }),
  { ssr: false, loading: () => <LoadingSkeleton /> }
);
const PromotionsTab = dynamic(
  () => import('@/components/inventory/promotions-tab').catch(() => {
    console.error('Promotions tab chunk failed to load');
    return { default: () => <div className="p-8 text-center text-muted-foreground">促销活动加载失败</div> };
  }),
  { ssr: false, loading: () => <LoadingSkeleton /> }
);
const RestockTab = dynamic(
  () => import('@/components/inventory/restock-tab').catch(() => {
    console.error('Restock tab chunk failed to load');
    return { default: () => <div className="p-8 text-center text-muted-foreground">入货建议加载失败</div> };
  }),
  { ssr: false, loading: () => <LoadingSkeleton /> }
);
const StocktakingTab = dynamic(
  () => import('@/components/inventory/stocktaking-tab').catch(() => {
    console.error('Stocktaking tab chunk failed to load');
    return { default: () => <div className="p-8 text-center text-muted-foreground">库存盘点加载失败</div> };
  }),
  { ssr: false, loading: () => <LoadingSkeleton /> }
);
import { MobileNav, DesktopNav, ShortcutsHelpDialog } from '@/components/inventory/navigation';
import { Gem, Package, ShoppingCart, Zap, Clock, ArrowUp, HelpCircle, WifiOff, ShieldAlert, Loader2 } from 'lucide-react';
import { itemsApi, salesApi, batchesApi, authApi } from '@/lib/api';
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';


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
        salesApi.getSales({ page: 1, size: 1, start_date: today, end_date: today }),
        batchesApi.getBatches({ page: 1, size: 100 }),
      ]);
      if (itemsData.status === 'fulfilled') {
        setInventoryValue(itemsData.value.pagination?.total || 0);
      }
      if (salesData.status === 'fulfilled') {
        setTodaySales(salesData.value.pagination?.total || 0);
        const sales = salesData.value.items || [];
        setTodayRevenue(sales.reduce((sum: number, s: { actualPrice?: number }) => sum + (s.actualPrice || 0), 0));
      }
      if (batchesData.status === 'fulfilled') {
        const batches = batchesData.value.items || [];
        setPendingBatches(batches.filter((b: { itemsCount?: number; quantity?: number }) => (b.itemsCount || 0) < (b.quantity || 0)).length);
      }
    } catch (e) { console.error('[Page]', e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadStats, 3000);
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
                  <span className={`font-semibold stat-value ${s.valCls}`}>{s.val}</span>
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
        salesApi.getSales({ page: 1, size: 1, start_date: today, end_date: today }),
      ]);
      if (itemsData.status === 'fulfilled') {
        setInventoryValue(itemsData.value.pagination?.total || 0);
      }
      if (salesData.status === 'fulfilled') {
        setTodaySales(salesData.value.pagination?.total || 0);
        const sales = salesData.value.items || [];
        setTodayRevenue(sales.reduce((sum: number, s: { actualPrice?: number }) => sum + (s.actualPrice || 0), 0));
      }
    } catch (e) { console.error('[Page]', e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadStats, 3000);
    const interval = setInterval(loadStats, 30000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  return (
    <div className={`md:hidden fixed bottom-14 left-0 right-0 z-40 bg-card border-t border-border py-2 px-4 ${className || ''}`}>
      <div className="flex items-center justify-around text-xs">
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3 text-emerald-600" />
          <span className="text-muted-foreground">在库</span>
          <span className="font-bold stat-value">{inventoryValue ?? '...'}</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1">
          <ShoppingCart className="h-3 w-3 text-sky-600" />
          <span className="text-muted-foreground">今日</span>
          <span className="font-bold stat-value">{todaySales}</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-600" />
          <span className="text-muted-foreground">营收</span>
          <span className="font-bold stat-value text-emerald-600">¥{todayRevenue.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

// ========== Main Page ==========
export default function JadeInventoryPage() {
  const { activeTab, setActiveTab, isAuthenticated, isAuthLoading, checkSession, setAuth, clearAuth, logout, currentUser } = useAppStore();
  const { handleError } = useErrorHandler();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof window !== 'undefined' ? navigator.onLine : true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [storeName, setStoreName] = useState(() => {
    try {
      if (typeof window === 'undefined') return '兴盛艺珠宝';
      const stored = localStorage.getItem('jade_system_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.storeName) return parsed.storeName;
      }
    } catch (e) { console.error('[Page]', e);}
    return '兴盛艺珠宝';
  });

  // ========== 强制改密弹窗状态 ==========
  const [showMustChangePwd, setShowMustChangePwd] = useState(false);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdChanging, setPwdChanging] = useState(false);

  /** 密码强度计算（与后端 DEFAULT_POLICY 的 5 条规则对齐） */
  function calcPasswordStrength(pwd: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: '弱', color: 'text-red-500' };
    if (score <= 3) return { score, label: '中', color: 'text-orange-500' };
    return { score, label: '强', color: 'text-green-500' };
  }

  // 检测 currentUser.mustChangePwd 变化，弹出强制改密弹窗
  useEffect(() => {
    if (currentUser?.mustChangePwd) {
      setShowMustChangePwd(true);
    }
  }, [currentUser]);

  /** 强制改密提交 */
  async function handleForceChangePassword() {
    if (!pwdOld) { toast.error('请输入旧密码'); return; }
    if (!pwdNew) { toast.error('请输入新密码'); return; }
    const strength = calcPasswordStrength(pwdNew);
    if (strength.score <= 2) { toast.error('密码强度太弱，请设置更强的密码'); return; }
    if (pwdNew !== pwdConfirm) { toast.error('两次输入的新密码不一致'); return; }

    setPwdChanging(true);
    try {
      await authApi.changePassword(pwdOld, pwdNew);
      toast.success('密码修改成功');
      // 刷新用户信息（mustChangePwd 应为 false）
      await checkSession();
      // 关闭弹窗 + 清空表单
      setShowMustChangePwd(false);
      setPwdOld('');
      setPwdNew('');
      setPwdConfirm('');
    } catch (error) {
      handleError(error, { title: '密码修改失败' });
    } finally {
      setPwdChanging(false);
    }
  }

  // 登录状态检查 — 使用 store 的 checkSession
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleLogin = (token: string) => {
    localStorage.setItem('auth_token', token);
    // 登录成功后再调用 /auth/me 获取用户信息
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.code === 0 && data.data) {
          setAuth(data.data);
        }
      })
      .catch(() => {
        // 如果 /auth/me 失败，先标记已认证让用户进入工作区
        localStorage.removeItem('auth_token');
      });
  };

  const handleLogout = () => {
    logout();
  };

  // MOUNT DIAGNOSTIC
  useEffect(() => {
    console.log('[PAGE] JadeInventoryPage MOUNTED, activeTab=', activeTab);
  }, []);

  // Sync store name from server config
  useEffect(() => {
    let mounted = true;
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (mounted && data.code === 0 && Array.isArray(data.data)) {
          const cfg = data.data.find((c: { key: string; value?: string }) => c.key === 'store_name');
          if (cfg?.value) setStoreName(cfg.value);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Dynamic page title based on active tab
  useEffect(() => {
    const titleMap: Record<TabId, string> = {
      dashboard: `看板 - ${storeName}进销存`,
      inventory: `库存管理 - ${storeName}进销存`,
      sales: `销售记录 - ${storeName}进销存`,
      batches: `批次管理 - ${storeName}进销存`,
      customers: `客户管理 - ${storeName}进销存`,
      logs: `操作日志 - ${storeName}进销存`,
      settings: `系统设置 - ${storeName}进销存`,
      promotions: `促销活动 - ${storeName}进销存`,
      restock: `入货建议 - ${storeName}进销存`,
      stocktaking: `库存盘点 - ${storeName}进销存`,
    };
    document.title = titleMap[activeTab] || `${storeName}进销存管理系统`;
    return () => { document.title = '兴盛艺珠宝进销存管理系统'; };
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
    setApiLoading(true);
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!apiLoading) return;
    const timer = setTimeout(() => setApiLoading(false), 450);
    return () => clearTimeout(timer);
  }, [apiLoading, activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const tabMap: Record<string, TabId> = {
      '1': 'dashboard', '2': 'inventory', '3': 'sales',
      '4': 'batches', '5': 'customers', '6': 'promotions', '7': 'settings', '8': 'logs',
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
        window.dispatchEvent(new CustomEvent('escape-press'));
        return;
      }

      // Ctrl/Cmd + N: open new item create dialog (inventory tab)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (activeTab === 'inventory') {
          setActiveTab('inventory');
          window.dispatchEvent(new CustomEvent('shortcut-new-item'));
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
      case 'promotions': return <PromotionsTab />;
      case 'restock': return <RestockTab />;
      case 'stocktaking': return <StocktakingTab />;
      default: return <DashboardTab />;
    }
  };

  // 登录状态检查中
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSkeleton />
      </div>
    );
  }

  // 未登录 — 显示登录页
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // 已登录 — 显示工作区
  return (
    <>
      <div className="min-h-screen flex flex-col bg-background" id="app-root">
      {/* Top Loading Bar: only visible during short tab switch loading */}
      {apiLoading && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none">
          <div className="loading-bar h-full w-full" />
        </div>
      )}
      <DesktopNav activeTab={activeTab} onTabChange={handleTabChange} className="no-print" loading={apiLoading} onLogout={handleLogout} />
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white text-center text-sm py-1.5 px-4 animate-in slide-in-from-top-1 duration-200" role="alert" aria-live="polite">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>网络连接已断开，部分功能可能不可用</span>
          </div>
        </div>
      )}
      <main className={`flex-1 px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6 max-w-7xl mx-auto w-full ${!isOnline ? 'pt-8' : ''}`}>
        <div className="tab-fade-in">
          <ErrorBoundary>
            {renderTab()}
          </ErrorBoundary>
        </div>
      </main>
      <MobileNav activeTab={activeTab} onTabChange={handleTabChange} className="no-print" onLogout={handleLogout} />
      <MobileQuickStats className="no-print" />
      <footer className="no-print mt-auto hidden md:block border-t border-border bg-card/80 backdrop-blur-sm py-3">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <img src="/logo-xingshengyi.png" alt="兴盛艺珠宝Logo" className="h-4 w-4 rounded-sm object-cover" />
              {storeName}管理系统
            </span>
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
            <span className="text-muted-foreground">技术支持: Lrunning</span>
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

      {/* 强制改密弹窗 — 不允许关闭/跳过 */}
      <Dialog open={showMustChangePwd} onOpenChange={(open) => {
        if (!open) return; // 不允许通过点击遮罩或按 Escape 关闭
        setShowMustChangePwd(open);
      }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
              首次登录，请修改密码
            </DialogTitle>
            <DialogDescription>
              出于安全考虑，您需要在首次登录时设置一个新密码。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 旧密码 */}
            <div className="space-y-1.5">
              <Label className="text-sm">旧密码</Label>
              <Input
                type="password"
                value={pwdOld}
                onChange={(e) => setPwdOld(e.target.value)}
                placeholder="输入当前密码"
                className="h-9"
              />
            </div>

            {/* 新密码 */}
            <div className="space-y-1.5">
              <Label className="text-sm">新密码</Label>
              <Input
                type="password"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                placeholder="至少8位，含大小写字母、数字、特殊字符"
                className="h-9"
              />
              {/* 密码强度指示条 */}
              {pwdNew && (() => {
                const strength = calcPasswordStrength(pwdNew);
                const barWidth = (strength.score / 5) * 100;
                const barColor = strength.score <= 2
                  ? 'bg-red-500'
                  : strength.score <= 3 ? 'bg-orange-500' : 'bg-green-500';
                return (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">密码强度</span>
                      <span className={`text-xs font-semibold ${strength.color}`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <ul className="mt-1.5 space-y-0.5">
                      {[
                        { met: pwdNew.length >= 8, label: '至少 8 位' },
                        { met: /[A-Z]/.test(pwdNew), label: '大写字母' },
                        { met: /[a-z]/.test(pwdNew), label: '小写字母' },
                        { met: /[0-9]/.test(pwdNew), label: '数字' },
                        { met: /[^A-Za-z0-9]/.test(pwdNew), label: '特殊字符' },
                      ].map((rule, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs">
                          <span className={`inline-block w-1 h-1 rounded-full ${rule.met ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                          <span className={rule.met ? 'text-green-600' : 'text-muted-foreground'}>
                            {rule.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>

            {/* 确认新密码 */}
            <div className="space-y-1.5">
              <Label className="text-sm">确认新密码</Label>
              <Input
                type="password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleForceChangePassword(); }}
                placeholder="再次输入新密码"
                className="h-9"
              />
              {pwdConfirm && pwdNew !== pwdConfirm && (
                <p className="text-xs text-red-500 mt-1">两次输入的密码不一致</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleForceChangePassword}
              disabled={pwdChanging || !pwdOld || !pwdNew || !pwdConfirm || (pwdNew && calcPasswordStrength(pwdNew).score <= 2)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {pwdChanging ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShieldAlert className="h-4 w-4 mr-2" />
              )}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
