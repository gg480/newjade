'use client';

import React, { useState, useEffect, useRef } from 'react';
import { customersApi } from '@/lib/api';
import type { Customer } from '@/lib/api.types';
import { toast } from 'sonner';
import { Star, Search, Plus, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CustomerQuickAddDialog from '../customer-quick-add-dialog';

interface StepCustomerProps {
  onSelectCustomer: (customer: { id: number; name: string }) => void;
  onSkip: () => void;
}

// 最近客户展示用类型（T-2a 后端增强后返回额外字段）
interface RecentCustomer extends Customer {
  saleCount?: number;
  isVip?: boolean;
}

/**
 * 收银台 Step 1：选择客户
 * 显示最近 6 位客户的大按钮，支持搜索、跳过、快速新增
 */
export default function StepCustomer({ onSelectCustomer, onSkip }: StepCustomerProps) {
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRecentCustomers();
  }, []);

  async function loadRecentCustomers() {
    setLoading(true);
    try {
      const data = await customersApi.getCustomers({
        sort_by: 'lastPurchaseDate',
        size: 6,
        // TODO: Replace with real API — T-2a backend enhancement needed
        // Expected response fields: saleCount, isVip
      });
      setRecentCustomers((data.items || []) as RecentCustomer[]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '加载最近客户失败';
      toast.error(message);
      setRecentCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(value: string) {
    setKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await customersApi.getCustomers({ keyword: value.trim(), size: 10 });
        setSearchResults(data.items || []);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '搜索客户失败';
        toast.error(message);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleCreated(customer: { id: number; name: string }) {
    onSelectCustomer(customer);
  }

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <div className="text-center">
        <h2 className="text-lg font-semibold">选择客户</h2>
        <p className="text-sm text-muted-foreground mt-1">选择购买客户，或跳过后续补填</p>
      </div>

      {/* 最近客户 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : recentCustomers.length > 0 ? (
        <div>
          <p className="text-xs text-muted-foreground mb-2 px-1">最近客户</p>
          <div className="grid grid-cols-2 gap-3">
            {recentCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => onSelectCustomer({ id: customer.id, name: customer.name })}
                className="relative flex flex-col items-center justify-center h-20 rounded-xl
                           border border-border bg-card hover:bg-accent hover:border-emerald-400
                           transition-colors cursor-pointer text-center px-2"
              >
                {/* VIP 星标 */}
                {customer.isVip && (
                  <span className="absolute top-1 right-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  </span>
                )}
                <User className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-sm font-medium truncate w-full">{customer.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {customer.saleCount != null ? `${customer.saleCount}次` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 搜索按钮 / 搜索框 */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-xl
                     border border-dashed border-border bg-card hover:bg-accent
                     transition-colors cursor-pointer text-sm text-muted-foreground"
        >
          <Search className="h-4 w-4" />
          搜索其他
        </button>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={e => handleSearch(e.target.value)}
              className="pl-9 h-10"
              placeholder="输入手机号、微信或姓名搜索..."
              autoFocus
            />
          </div>
          {/* 搜索结果 */}
          {searching ? (
            <div className="text-center py-4 text-sm text-muted-foreground">搜索中...</div>
          ) : searchResults.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.map(c => (
                <button
                  key={c.id}
                  onClick={() => onSelectCustomer({ id: c.id, name: c.name })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                             hover:bg-accent transition-colors text-left cursor-pointer"
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.phone || c.wechat || '暂无联系方式'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : keyword.trim() && !searching ? (
            <p className="text-center py-3 text-sm text-muted-foreground">未找到匹配客户</p>
          ) : null}
        </div>
      )}

      {/* 分隔线 + 操作按钮 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">或</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickAddOpen(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          新增客户
        </Button>

        <button
          onClick={() => {
            toast.info('记录客户信息，方便后续推送新品到货和行情动态');
            onSkip();
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 cursor-pointer"
        >
          跳过，不选客户
        </button>
      </div>

      {/* 快速新增对话框 */}
      <CustomerQuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
