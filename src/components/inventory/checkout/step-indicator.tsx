'use client';

import { cn } from '@/lib/utils';

interface Step {
  id: number;
  label: string;
}

const STEPS: Step[] = [
  { id: 1, label: '选择客户' },
  { id: 2, label: '选择货品' },
  { id: 3, label: '收款确认' },
];

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

/**
 * 收银台步骤指示器
 * 显示三步线性进度：[●Step1] → [○Step2] → [○Step3]
 */
export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 py-4">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={step.id} className="flex items-center">
            {/* 步骤圆点 + 标签 */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors',
                  isActive && 'bg-emerald-500 text-white',
                  isCompleted && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300',
                  !isActive && !isCompleted && 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
                )}
              >
                {isCompleted ? '✓' : step.id}
              </div>
              <span
                className={cn(
                  'text-xs whitespace-nowrap transition-colors',
                  isActive && 'font-medium text-emerald-600 dark:text-emerald-400',
                  isCompleted && 'text-emerald-500 dark:text-emerald-500',
                  !isActive && !isCompleted && 'text-gray-400 dark:text-gray-500',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* 连接线 */}
            {!isLast && (
              <div
                className={cn(
                  'mx-2 h-0.5 w-12 sm:w-20 transition-colors',
                  step.id < currentStep
                    ? 'bg-emerald-400 dark:bg-emerald-600'
                    : 'bg-gray-200 dark:bg-gray-700',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
