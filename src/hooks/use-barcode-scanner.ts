'use client';

import { useEffect, useRef } from 'react';

const DEFAULT_MAX_DELAY = 50;
const DEFAULT_COMPLETION_DELAY = 100;
const DEFAULT_MIN_LENGTH = 3;

interface UseBarcodeScannerOptions {
  /** 扫描枪字符间最大间隔（ms），超过则视为人类输入。默认 50ms */
  maxDelay?: number;
  /** 软件兜底超时（ms）：无 Enter 终止时，静默超过此时间自动提交。默认 100ms */
  completionDelay?: number;
  /** 最小条码长度，默认 3 */
  minLength?: number;
  /** 是否启用扫码监听。默认 true。设为 false 可避免与其他扫码组件冲突（如 ScanPhotoMode） */
  enabled?: boolean;
  /** 扫码完成回调 */
  onComplete: (code: string) => void;
}

/**
 * 全局扫描枪监听 Hook（HID 键盘模拟器模式）
 *
 * 工作原理：扫描枪以极快速度（字符间隔 <50ms）逐字符注入 keydown，
 * 最后注入 Enter。人类打字间隔 >200ms，据此区分。
 *
 * 软件兜底：若扫描枪未配置 Enter 后缀，在 completionDelay 静默后自动提交。
 *
 * 注意：本 Hook 不阻止字符进入聚焦的 input/textarea，调用方应在
 * onComplete 回调中清空相关输入框，避免重复处理。
 *
 * 兼容：USB 扫描枪、蓝牙扫描枪（HID 模式），所有浏览器。
 *
 * enabled 参数：当其他组件（如 ScanPhotoMode 扫码拍摄）使用摄像头扫码时，
 * 应设为 false 禁用此 hook，防止 HID 扫描枪事件触发错误流程。
 */
export function useBarcodeScanner(options: UseBarcodeScannerOptions) {
  const {
    maxDelay = DEFAULT_MAX_DELAY,
    completionDelay = DEFAULT_COMPLETION_DELAY,
    minLength = DEFAULT_MIN_LENGTH,
    enabled = true,
    onComplete,
  } = options;
  const bufferRef = useRef('');
  const lastTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 标记当前序列是否为快速输入（扫描枪特征），第二字符起判定
  const isFastRef = useRef(false);
  const callbackRef = useRef(onComplete);
  const enabledRef = useRef(enabled);

  // 保持回调引用最新，避免 effect 频繁重建
  useEffect(() => {
    callbackRef.current = onComplete;
  }, [onComplete]);

  // 保持 enabled 引用最新
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const resetBuffer = () => {
      bufferRef.current = '';
      isFastRef.current = false;
      lastTimeRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const submitIfValid = (code: string) => {
      if (code.length >= minLength && isFastRef.current) {
        callbackRef.current(code);
      }
    };

    const handler = (e: KeyboardEvent) => {
      // disabled 时跳过处理
      if (!enabledRef.current) return;

      // 忽略修饰键组合（Ctrl/Cmd/Alt），避免与快捷键冲突
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const timeSinceLast = now - lastTimeRef.current;

      // Enter 终止符
      if (e.key === 'Enter') {
        const code = bufferRef.current;
        if (code.length >= minLength && isFastRef.current) {
          e.preventDefault();
          e.stopPropagation();
          submitIfValid(code);
        }
        resetBuffer();
        return;
      }

      // 仅累积可打印字符（单字符 key）
      if (e.key.length === 1) {
        // 超时重置：上一字符距今超过 maxDelay，视为新序列或人类输入
        if (bufferRef.current.length > 0 && timeSinceLast > maxDelay) {
          bufferRef.current = '';
          isFastRef.current = false;
        }
        // 第二字符起，若间隔 <= maxDelay 则标记为快速序列
        if (bufferRef.current.length > 0 && timeSinceLast <= maxDelay) {
          isFastRef.current = true;
        }
        bufferRef.current += e.key;
        lastTimeRef.current = now;

        // 软件兜底超时：无 Enter 时自动提交（仅快速序列）
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          submitIfValid(bufferRef.current);
          resetBuffer();
        }, completionDelay);
      }
    };

    // capture 阶段：确保先于 React 合成事件，以便 stopPropagation 生效
    document.addEventListener('keydown', handler, { capture: true });
    return () => {
      document.removeEventListener('keydown', handler, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [maxDelay, completionDelay, minLength]);
}
