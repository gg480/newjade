'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { salesApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Banknote,
  Building2,
  MessageCircle,
  Smartphone,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Percent,
  Scissors,
  Tag,
  User,
  CheckCircle2,
  Loader2,
  Pencil,
  FileText,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { printReceipt } from './print-receipt';
import { useAppStore } from '@/lib/store';

// ==================== 类型定义 ====================

/** 收银台货品条目 */
interface CheckoutItem {
  id: number;
  skuCode: string;
  name: string;
  sellingPrice: number; // 标价
  actualPrice: number; // 成交价（可变）
  materialName: string;
  typeName: string;
  image?: string;
}

interface StepPaymentProps {
  /** 已选客户信息，null 表示散客 */
  customer: { id: number; name: string; phone?: string } | null;
  /** 待结算货品列表 */
  items: CheckoutItem[];
  /** 修改货品价格回调 */
  onItemsChange: (items: CheckoutItem[]) => void;
  /** 返回上一步 */
  onPrev: () => void;
  /** 销售完成回调 */
  onComplete: () => void;
  /** 继续销售（保留客户） */
  onContinue: () => void;
}

// ==================== 支付方式配置 ====================

interface PaymentMethod {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { key: 'cash', label: '现款', icon: <Banknote className="h-6 w-6" /> },
  { key: 'transfer', label: '转账', icon: <Building2 className="h-6 w-6" /> },
  { key: 'wechat', label: '微信', icon: <MessageCircle className="h-6 w-6" /> },
  { key: 'alipay', label: '支付宝', icon: <Smartphone className="h-6 w-6" /> },
  { key: 'installment', label: '分期', icon: <ClipboardList className="h-6 w-6" /> },
];

// ==================== 子组件：完成页 ====================

/** 销售成功完成页，支持打印小票 */
function PaymentCompletionPage({
  totalAmount,
  itemCount,
  paymentMethod,
  customerName,
  items,
  saleOrderNo,
  onContinue,
  onReset,
}: {
  totalAmount: number;
  itemCount: number;
  paymentMethod: string;
  customerName: string;
  items: CheckoutItem[];
  saleOrderNo?: string;
  onContinue: () => void;
  onReset: () => void;
}) {
  const [autoTimer, setAutoTimer] = useState(true);

  useEffect(() => {
    if (!autoTimer) return;
    const timer = setTimeout(onReset, 3000);
    return () => clearTimeout(timer);
  }, [onReset, autoTimer]);

  function handlePrint() {
    setAutoTimer(false);
    printReceipt({
      items,
      totalAmount,
      paymentMethod,
      customerName: customerName || undefined,
      saleOrderNo,
    });
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* 成功图标 */}
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
        <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
      </div>

      <h2 className="mb-1 text-2xl font-bold text-gray-800 dark:text-gray-200">
        销售成功！
      </h2>
      <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
        共售出 {itemCount} 件货品
      </p>
      <p className="mb-6 text-xl font-bold text-emerald-600 dark:text-emerald-400">
        ¥{totalAmount.toFixed(2)}
      </p>

      {/* 客户信息提示（散客时温馨提醒） */}
      {!customerName && (
        <div className="mb-6 w-full max-w-sm rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/30">
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-sky-800 dark:text-sky-300">
                本次销售未关联客户。完善客户信息后可查询消费记录，也方便为您推送新品到货信息。
              </p>
              <button
                onClick={() => {
                  useAppStore.getState().setActiveTab('customers');
                  onReset();
                }}
                className="mt-2 cursor-pointer text-sm font-medium text-sky-600 underline underline-offset-2 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
              >
                完善客户信息 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]"
          onClick={onContinue}
        >
          继续销售
        </Button>
        <Button variant="outline" className="min-w-[120px]" onClick={handlePrint}>
          <Printer className="mr-1.5 h-4 w-4" />
          打印小票
        </Button>
        <Button variant="ghost" className="min-w-[120px]" onClick={onReset}>
          返回首页
        </Button>
      </div>

      {/* 自动返回提示 */}
      {autoTimer && (
        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          3 秒后自动返回收银台首页...
        </p>
      )}
    </div>
  );
}

// ==================== 主组件 ====================

/**
 * 收银台 Step 3：收款确认
 *
 * 显示总价、支持修改单项价格、快速折扣、选择支付方式、备注、确认收款
 */
export default function StepPayment({
  customer,
  items,
  onItemsChange,
  onPrev,
  onComplete,
  onContinue,
}: StepPaymentProps) {
  // ==================== 状态 ====================

  const [expandedPriceEdit, setExpandedPriceEdit] = useState(false);
  const [discountType, setDiscountType] = useState<'none' | 'round_down' | 'ten_percent_off' | 'custom'>('none');
  const [customDiscountPercent, setCustomDiscountPercent] = useState(10);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ done: 0, total: 0 });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // ==================== 计算属性 ====================

  const rawTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.sellingPrice, 0),
    [items],
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.actualPrice, 0),
    [items],
  );

  const discountAmount = rawTotal - totalAmount;

  // ==================== 价格调整操作 ====================

  /** 抹零：将总价向下取整 */
  function handleRoundDown() {
    const currentTotal = items.reduce((sum, item) => sum + item.actualPrice, 0);
    const rounded = Math.floor(currentTotal);
    const diff = currentTotal - rounded;
    if (diff <= 0) return;

    // 从最后一件货品减掉差额
    const updated = [...items];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = {
      ...updated[lastIdx],
      actualPrice: Math.max(0, +(updated[lastIdx].actualPrice - diff).toFixed(2)),
    };
    onItemsChange(updated);
    setDiscountType('round_down');
  }

  /** 打9折 */
  function handleTenPercentOff() {
    const updated = items.map(item => ({
      ...item,
      actualPrice: +(item.actualPrice * 0.9).toFixed(2),
    }));
    onItemsChange(updated);
    setDiscountType('ten_percent_off');
  }

  /** 自定义折扣 */
  function handleCustomDiscount() {
    const factor = (100 - customDiscountPercent) / 100;
    const updated = items.map(item => ({
      ...item,
      actualPrice: +(item.actualPrice * factor).toFixed(2),
    }));
    onItemsChange(updated);
    setDiscountType('custom');
  }

  /** 修改单项价格 */
  function handleItemPriceChange(index: number, value: string) {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    const updated = [...items];
    updated[index] = { ...updated[index], actualPrice: parsed };
    onItemsChange(updated);
    setDiscountType('none');
  }

  // ==================== 提交销售 ====================

  async function handleConfirm() {
    if (!paymentMethod) {
      toast.error('请选择支付方式');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitProgress({ done: 0, total: items.length });

    // 将支付方式映射为 API channel 值
    const channelMap: Record<string, string> = {
      cash: 'store',
      transfer: 'store',
      wechat: 'wechat',
      alipay: 'store',
      installment: 'store',
    };

    const channel = channelMap[paymentMethod] || 'store';
    const saleDate = new Date().toISOString().slice(0, 10);
    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const paymentNote = `[${paymentMethod}]${note ? ` ${note}` : ''}`;
        await salesApi.createSale({
          itemId: item.id,
          actualPrice: item.actualPrice,
          channel,
          saleDate,
          customerId: customer?.id,
          note: paymentNote,
        });
        successCount++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '提交失败';
        lastError = message;
        failCount++;
      }
      setSubmitProgress({ done: i + 1, total: items.length });
    }

    if (failCount === 0) {
      // 全部成功
      setCompleted(true);
    } else if (successCount > 0) {
      // 部分成功
      toast.warning(`已成功 ${successCount} 件，失败 ${failCount} 件`);
      setCompleted(true);
    } else {
      // 全部失败
      setSubmitError(lastError || '提交失败，请重试');
      setSubmitting(false);
    }
  }

  // ==================== 完成回调 ====================

  function handleContinue() {
    setCompleted(false);
    setPaymentMethod(null);
    setNote('');
    setDiscountType('none');
    setCustomDiscountPercent(10);
    setExpandedPriceEdit(false);
    setSubmitError(null);
    onContinue();
  }

  function handleReset() {
    setCompleted(false);
    setPaymentMethod(null);
    setNote('');
    setDiscountType('none');
    setCustomDiscountPercent(10);
    setExpandedPriceEdit(false);
    setSubmitError(null);
    onComplete();
  }

  // ==================== 完成页渲染 ====================

  if (completed) {
    return (
      <div className="space-y-4">
        <PaymentCompletionPage
          totalAmount={totalAmount}
          itemCount={items.length}
          paymentMethod={paymentMethod || ''}
          customerName={customer?.name || ''}
          items={items}
          onContinue={handleContinue}
          onReset={handleReset}
        />
      </div>
    );
  }

  // ==================== 主内容渲染 ====================

  return (
    <div className="space-y-5">
      {/* 1. 客户信息 */}
      <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
          <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {customer ? customer.name : '散客'}
          </p>
          {customer?.phone && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</p>
          )}
        </div>
      </div>

      {/* 2. 合计金额 */}
      <div className="text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">合计金额</p>
        <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
          ¥{totalAmount.toFixed(2)}
        </p>
        {discountAmount > 0 && (
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            <span className="line-through">¥{rawTotal.toFixed(2)}</span>
            <span className="ml-2 text-red-500">-¥{discountAmount.toFixed(2)}</span>
          </p>
        )}
      </div>

      {/* 3. 修改单项价格（可展开） */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setExpandedPriceEdit(!expandedPriceEdit)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium
                     text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200
                     cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            修改单项价格
          </span>
          {expandedPriceEdit ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {expandedPriceEdit && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-3 dark:border-gray-800">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
              >
                {/* 缩略图 */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      {item.typeName?.slice(0, 1)}
                    </div>
                  )}
                </div>

                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {item.name || item.skuCode}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.materialName} · {item.typeName}
                  </p>
                </div>

                {/* 价格输入 */}
                <div className="w-28 shrink-0">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      ¥
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.actualPrice}
                      onChange={e => handleItemPriceChange(index, e.target.value)}
                      className="h-8 pl-6 text-right text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 快速调整 */}
      <div>
        <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
          快速调整
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRoundDown}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm 
                        font-medium transition-colors cursor-pointer
                        ${discountType === 'round_down'
                          ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
          >
            <Scissors className="h-3.5 w-3.5" />
            抹零
          </button>

          <button
            onClick={handleTenPercentOff}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm 
                        font-medium transition-colors cursor-pointer
                        ${discountType === 'ten_percent_off'
                          ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
          >
            <Tag className="h-3.5 w-3.5" />
            打9折
          </button>

          <div className="inline-flex items-center gap-1">
            <button
              onClick={handleCustomDiscount}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm 
                          font-medium transition-colors cursor-pointer
                          ${discountType === 'custom'
                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                          }`}
            >
              <Percent className="h-3.5 w-3.5" />
              自定义
            </button>

            {discountType === 'custom' && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={customDiscountPercent}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    setCustomDiscountPercent(Math.min(99, Math.max(1, val)));
                  }}
                  className="h-8 w-16 text-center text-sm"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. 支付方式 */}
      <div>
        <p className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
          选择支付方式
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PAYMENT_METHODS.map(method => (
            <button
              key={method.key}
              onClick={() => setPaymentMethod(method.key)}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4
                         transition-all cursor-pointer
                         ${paymentMethod === method.key
                           ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-300'
                           : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800'
                         }`}
            >
              <div className={`${paymentMethod === method.key ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {method.icon}
              </div>
              <span className="text-sm font-medium">{method.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. 备注 */}
      <div>
        <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
          备注（可选）
        </p>
        <div className="relative">
          <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="输入备注信息..."
            className="min-h-[72px] pl-9 resize-none"
            maxLength={200}
          />
          <span className="absolute bottom-2 right-3 text-[11px] text-gray-400">
            {note.length}/200
          </span>
        </div>
      </div>

      {/* 7. 提交错误提示 */}
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {submitError}
        </div>
      )}

      {/* 8. 确认收款按钮 */}
      <div className="sticky bottom-0 -mx-4 -mb-4 bg-white px-4 pb-4 pt-3 dark:bg-gray-950">
        <Button
          onClick={handleConfirm}
          disabled={submitting || !paymentMethod}
          className="w-full h-14 text-base font-bold bg-emerald-600 hover:bg-emerald-700
                     disabled:bg-gray-300 disabled:text-gray-500
                     dark:disabled:bg-gray-800 dark:disabled:text-gray-600"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              提交中... ({submitProgress.done}/{submitProgress.total})
            </span>
          ) : (
            `确认收款 ¥${totalAmount.toFixed(2)}`
          )}
        </Button>
      </div>
    </div>
  );
}
