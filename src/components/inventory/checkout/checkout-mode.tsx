'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { StepIndicator } from './step-indicator';
import { StepPlaceholder } from './step-placeholder';
import StepItems from './step-items';

// ==================== 类型定义 ====================

/** 购物车中的货品条目 */
interface CheckoutItem {
  id: number;
  skuCode: string;
  name: string;
  sellingPrice: number;
  actualPrice: number;
  materialName: string;
  typeName: string;
  image?: string;
}

/** 客户信息 */
interface SelectedCustomer {
  id: number;
  name: string;
  phone?: string;
}

/** 支付信息 */
interface PaymentInfo {
  method: string | null;
  note: string;
  discount: number;
}

/** 收银台完整状态 */
interface CheckoutState {
  step: 1 | 2 | 3;
  customer: SelectedCustomer | null;
  items: CheckoutItem[];
  payment: PaymentInfo;
  continuousMode: boolean;
}

// ==================== 初始状态 ====================

const INITIAL_PAYMENT: PaymentInfo = {
  method: null,
  note: '',
  discount: 0,
};

const INITIAL_STATE: CheckoutState = {
  step: 1,
  customer: null,
  items: [],
  payment: { ...INITIAL_PAYMENT },
  continuousMode: false,
};

// ==================== 完成页 ====================

/** 销售成功完成页，3秒后自动返回 */
function CompletionPage({
  onContinue,
  onReset,
}: {
  onContinue: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* 成功图标 */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
        <svg
          className="h-10 w-10 text-emerald-600 dark:text-emerald-300"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      {/* 标题 */}
      <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
        销售成功！
      </h2>

      <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
        销售单号生成中...
      </p>

      {/* 操作按钮 */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={onContinue}
        >
          继续销售
        </Button>
        <Button variant="outline" onClick={onReset}>
          返回首页
        </Button>
      </div>

      {/* 自动返回提示 */}
      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
        3秒后自动返回收银台首页...
      </p>
    </div>
  );
}

// ==================== 主容器 ====================

interface CheckoutModeProps {
  /** 关闭收银台回调 */
  onClose?: () => void;
  /** 销售完成回调（用于刷新父组件数据） */
  onComplete?: () => void;
}

/**
 * 收银台模式主容器组件
 *
 * 管理三步流程状态：选择客户 → 选择货品 → 收款确认
 * 支持连续销售模式开关
 * TODO: Step 1/2/3 组件待 T-2b/T-3/T-4 完成后替换为实际组件
 */
export function CheckoutMode({ onClose }: CheckoutModeProps) {
  // 状态管理
  const [step, setStep] = useState<CheckoutState['step']>(1);
  const [customer, setCustomer] = useState<CheckoutState['customer']>(null);
  const [items, setItems] = useState<CheckoutState['items']>([]);
  const [payment, setPayment] = useState<CheckoutState['payment']>({ ...INITIAL_PAYMENT });
  const [continuousMode, setContinuousMode] = useState(false);
  const [completed, setCompleted] = useState(false);

  // ==================== 计算属性 ====================

  /** 当前步骤是否可前进 */
  const canProceed = useCallback((): boolean => {
    if (step === 1) {
      // Step 1: 客户选择（过渡期非必填）
      return true;
    }
    if (step === 2) {
      // Step 2: 至少选择一件货品
      return items.length > 0;
    }
    if (step === 3) {
      // Step 3: 必须选择支付方式
      return payment.method !== null;
    }
    return false;
  }, [step, items, payment.method]);

  /** 合计金额 */
  const totalAmount = items.reduce((sum, item) => sum + item.actualPrice, 0);

  // ==================== 操作回调 ====================

  /** 前往上一步 */
  const handlePrev = useCallback(() => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
    }
  }, [step]);

  /** 前往下一步 或 确认收款 */
  const handleNext = useCallback(() => {
    if (step === 3) {
      // 确认收款 → 完成
      // TODO: 调用 POST /api/sales 逐件提交销售记录
      setCompleted(true);
      onComplete?.();
      return;
    }
    setStep((step + 1) as 1 | 2 | 3);
  }, [step, onComplete]);

  /** 连续模式：继续销售（保留客户，清空货品） */
  const handleContinueSelling = useCallback(() => {
    setStep(2);
    setItems([]);
    setPayment({ ...INITIAL_PAYMENT });
    setCompleted(false);
  }, []);

  /** 重置全部状态 */
  const handleReset = useCallback(() => {
    setStep(1);
    setCustomer(null);
    setItems([]);
    setPayment({ ...INITIAL_PAYMENT });
    setCompleted(false);
  }, []);

  /** 切换连续模式 */
  const handleToggleContinuous = useCallback((checked: boolean) => {
    setContinuousMode(checked);
  }, []);

  // ==================== 渲染 ====================

  // 完成页
  if (completed) {
    return (
      <div className="flex flex-col">
        <CompletionPage
          onContinue={handleContinueSelling}
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* ===== 顶部栏：标题 + 连续模式开关 ===== */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            收银台
          </h2>
        </div>

        {/* 右侧：连续模式开关 + 关闭按钮 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="continuous-mode"
              checked={continuousMode}
              onCheckedChange={handleToggleContinuous}
            />
            <Label
              htmlFor="continuous-mode"
              className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none"
            >
              连续模式
            </Label>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              关闭
            </Button>
          )}
        </div>
      </div>

      {/* ===== 步骤指示器 ===== */}
      <StepIndicator currentStep={step} />

      {/* ===== 步骤内容区（可滚动） ===== */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {step === 1 && (
          <div className="space-y-4">
            {/* TODO: 替换为 T-2b Step1CustomerSelect 组件 */}
            <StepPlaceholder step={1} />
          </div>
        )}

        {step === 2 && (
          <StepItems
            items={items}
            onItemsChange={setItems}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        )}

        {step === 3 && (
          <div className="space-y-4">
            {/* 已选客户摘要 */}
            {customer && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
                <span className="text-gray-500 dark:text-gray-400">客户：</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {customer.name}
                  {customer.phone && ` · ${customer.phone}`}
                </span>
              </div>
            )}

            {/* 已选货品摘要 */}
            {items.length > 0 && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
                <span className="text-gray-500 dark:text-gray-400">货品：</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {items.length} 件
                </span>
                <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ¥{totalAmount.toFixed(2)}
                </span>
              </div>
            )}

            {/* TODO: 替换为 T-4 Step3PaymentConfirm 组件 */}
            <StepPlaceholder step={3} />
          </div>
        )}
      </div>

      {/* ===== 底部固定操作栏 ===== */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-950 md:sticky">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          {/* 上一步 */}
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={step === 1}
            className="min-w-24"
          >
            上一步
          </Button>

          {/* 中间：合计金额（Step 3 时显示） */}
          {step === 3 && items.length > 0 && (
            <div className="text-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">合计：</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                ¥{totalAmount.toFixed(2)}
              </span>
              {payment.discount > 0 && (
                <span className="ml-2 text-xs text-red-500 line-through">
                  ¥{(totalAmount + payment.discount).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* 下一步 / 确认收款 */}
          <Button
            variant="default"
            onClick={handleNext}
            disabled={!canProceed()}
            className={`min-w-24 ${step === 3 ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          >
            {step === 3 ? '确认收款' : '下一步'}
          </Button>
        </div>
      </div>
    </div>
  );
}
