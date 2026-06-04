'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogDescription, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Info, Gem } from 'lucide-react';

// ========== CSS Keyframes ==========
// 所有全局关键帧动画已迁移到 globals.css
// 保留 fadeInStyle/cardSlideUpStyle 为 no-op 以兼容 page.tsx 的 `void fadeInStyle; void cardSlideUpStyle;`
const fadeInStyle = true;
const cardSlideUpStyle = true;

// ========== Shared Components ==========
const CHART_COLORS = ['#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1', '#ec4899', '#84cc16', '#f97316'];

function formatPrice(v: number | null | undefined) {
  if (v == null) return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(0);
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(v);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    in_stock: { label: '在库', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
    sold: { label: '已售', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
    returned: { label: '已退', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    new: { label: '未开始', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    selling: { label: '销售中', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200' },
    paid_back: { label: '已回本', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
    cleared: { label: '清仓完毕', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  };
  const info = map[status] || { label: status, className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' };
  return <Badge variant="secondary" className={info.className}>{info.label}</Badge>;
}

function PaybackBar({ rate }: { rate: number }) {
  const pct = Math.min(rate * 100, 100);
  const color = rate >= 1 ? 'bg-emerald-500' : 'bg-sky-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-12 text-right">{(rate * 100).toFixed(1)}%</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 animate-bounce" style={{ animationDuration: '2s' }}>
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="mt-1 text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">{desc}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-1 animate-pulse">
      {/* Overview cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="h-3 bg-muted rounded w-16" />
            <div className="h-7 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-32" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="bg-muted/50 rounded-xl p-6 space-y-4">
        <div className="h-4 bg-muted rounded w-40" />
        <div className="h-52 bg-muted rounded-lg" />
      </div>
      {/* Second row chart skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-muted/50 rounded-xl p-6 space-y-4">
          <div className="h-4 bg-muted rounded w-36" />
          <div className="h-44 bg-muted rounded-lg" />
        </div>
        <div className="bg-muted/50 rounded-xl p-6 space-y-4">
          <div className="h-4 bg-muted rounded w-36" />
          <div className="h-44 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-48">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ========== Error Boundary ==========
interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <Gem className="h-8 w-8 text-red-500" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">页面出错了</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{error.message || '发生了未知错误，请重试'}</p>
      <button
        onClick={retry}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        重试
      </button>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorFallback error={this.state.error!} retry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

// ========== Confirm Dialog ==========
function ConfirmDialog({ open, onOpenChange, title, description, confirmText = '确认', cancelText = '取消', variant = 'default', onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
}) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            className={variant === 'destructive'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
          >
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { fadeInStyle, cardSlideUpStyle, CHART_COLORS, formatPrice, StatusBadge, PaybackBar, EmptyState, LoadingSkeleton, InfoTip, ErrorBoundary, ErrorFallback, ConfirmDialog };
