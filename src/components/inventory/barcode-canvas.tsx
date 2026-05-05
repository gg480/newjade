'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeCanvasProps {
  /** SKU 编码，作为条形码内容 */
  value: string;
  /** 额外的 CSS class */
  className?: string;
  /** 条形码高度（px），默认 40 */
  height?: number;
  /** 条形码线宽，默认 1.5 */
  width?: number;
}

/**
 * 共享条形码 Canvas 组件
 * 使用 jsbarcode 在 Canvas 上生成 CODE128 条形码
 * 用于单品标签打印和批量标签打印
 */
export default function BarcodeCanvas({ value, className, height = 40, width = 1.5 }: BarcodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (e) {
        console.error('条形码生成失败:', e);
      }
    }
  }, [value, height, width]);

  return <canvas ref={canvasRef} className={className} />;
}
