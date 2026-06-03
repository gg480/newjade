'use client';

import { cn } from '@/lib/utils';

interface StepPlaceholderProps {
  step: 1 | 2 | 3;
  className?: string;
}

/**
 * Step 占位组件
 * 在 T-2b/T-3/T-4 完成前使用，后续会被替换为实际组件
 * TODO: 待 T-2b/T-3/T-4 完成后替换为实际组件
 */
export function StepPlaceholder({ step, className }: StepPlaceholderProps) {
  const titles: Record<number, string> = {
    1: '选择客户',
    2: '选择货品',
    3: '收款确认',
  };

  const descriptions: Record<number, string> = {
    1: '选择已有客户或快速新建客户',
    2: '扫码添加或从库存选择货品',
    3: '确认价格、选择支付方式并完成收款',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      {/* Step 序号 */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
        {step}
      </div>

      {/* 标题 */}
      <h3 className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
        Step {step}：{titles[step]}
      </h3>

      {/* 描述 */}
      <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {descriptions[step]}
      </p>

      {/* 待实现标签 */}
      <span className="mt-4 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
        待实现
      </span>
    </div>
  );
}
