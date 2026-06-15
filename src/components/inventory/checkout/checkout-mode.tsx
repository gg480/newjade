'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { StepIndicator } from './step-indicator';
import StepCustomer from './step-customer';
import StepItems from './step-items';
import StepPayment from './step-payment';

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
  /** 当前活跃 Tab（用于 Tab 切换时自动退出收银台） */
  activeTab?: string;
}

/**
 * 收银台模式主容器组件
 *
 * 管理三步流程状态：选择客户 → 选择货品 → 收款确认
 * 支持连续销售模式开关
 */
export function CheckoutMode({ onClose, onComplete, activeTab }: CheckoutModeProps) {
  // 状态管理
  const [step, setStep] = useState<CheckoutState['step']>(1);
  const [customer, setCustomer] = useState<CheckoutState['customer']>(null);
  const [items, setItems] = useState<CheckoutState['items']>([]);
  const [payment, setPayment] = useState<CheckoutState['payment']>({ ...INITIAL_PAYMENT });
  const [continuousMode, setContinuousMode] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Tab 切换检测：收银台模式下切换到其他 Tab 则自动退出
  const entryTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab && entryTabRef.current !== activeTab) {
      onClose?.();
    }
  }, [activeTab, onClose]);

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

  /** 选择客户（同时进入 Step 2） */
  const handleSelectCustomer = useCallback((selected: { id: number; name: string }) => {
    setCustomer(selected);
    setStep(2);
  }, []);

  /** 跳过客户选择（进入 Step 2） */
  const handleSkipCustomer = useCallback(() => {
    setStep(2);
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
      <div className="flex-1 overflow-y-auto px-4 pb-32 md:pb-24">
        {step === 1 && (
          <StepCustomer
            onSelectCustomer={handleSelectCustomer}
            onSkip={handleSkipCustomer}
          />
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
          <StepPayment
            customer={customer}
            items={items}
            onItemsChange={setItems}
            onPrev={handlePrev}
            onComplete={handleReset}
            onContinue={handleContinueSelling}
          />
        )}
      </div>

      {/* ===== 底部固定操作栏（Step 3 时由 StepPayment 内部处理） ===== */}
      {step !== 3 && (
        <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-950 z-10">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={step === 1}
              className="min-w-24"
            >
              上一步
            </Button>

            <Button
              variant="default"
              onClick={handleNext}
              disabled={!canProceed()}
              className="min-w-24"
            >
              下一步
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
