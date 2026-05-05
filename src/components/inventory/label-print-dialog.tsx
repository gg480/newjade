'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Printer } from 'lucide-react';

// 规格字段中文映射
const specFieldLabels: Record<string, string> = {
  weight: '克重', metalWeight: '金重', size: '尺寸', braceletSize: '圈口',
  beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈',
};

function LabelPrintDialog({ item, open, onOpenChange }: { item: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // 弹窗打开时用 jsbarcode 在 Canvas 上生成 CODE128 条形码
  useEffect(() => {
    if (open && item?.skuCode && barcodeCanvasRef.current) {
      try {
        JsBarcode(barcodeCanvasRef.current, item.skuCode, {
          format: 'CODE128',
          width: 1.5,
          height: 45,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (e) {
        console.error('条形码生成失败:', e);
      }
    }
  }, [open, item]);

  if (!item) return null;

  const specParts = item.spec
    ? Object.entries(item.spec)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${specFieldLabels[k] || k}:${v}`)
        .join(' ')
    : '';

  // 打印：打开新窗口，将 Canvas 转图片嵌入 HTML
  function handlePrint() {
    const barcodeDataUrl = barcodeCanvasRef.current?.toDataURL('image/png') || '';
    const printWindow = window.open('', '_blank', 'width=400,height=300');
    if (!printWindow) return;

    const sku = item.skuCode || '';
    const materialType = `${item.materialName || '-'} · ${item.typeName || '-'}`;
    const originLine = item.origin ? `<div class="info-line">产地: ${item.origin}</div>` : '';
    const specLine = specParts ? `<div class="info-line">${specParts}</div>` : '';
    const priceLine = item.sellingPrice != null
      ? `<div class="price">\u00a5${item.sellingPrice.toFixed(2)}</div>`
      : '';

    printWindow.document.write(`
      <html><head><title>标签打印</title><style>
        @page { size: 60mm 40mm; margin: 1.5mm; }
        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: monospace; }
        .label { border: 1px solid #000; padding: 3mm; width: 54mm; text-align: center; font-size: 9pt; }
        .label .barcode-img { display: block; margin: 0 auto; max-width: 100%; height: auto; }
        .label .sku-text { font-size: 8pt; letter-spacing: 1px; margin: 1mm 0; }
        .label .info-line { font-size: 7.5pt; line-height: 1.4; }
        .label .price { font-size: 12pt; font-weight: bold; margin-top: 1mm; }
        @media print { .label { border: 1px solid #000; } }
      </style></head><body>
      <div class="label">
        ${barcodeDataUrl ? `<img class="barcode-img" src="${barcodeDataUrl}" alt="barcode" />` : ''}
        <div class="sku-text">${sku}</div>
        <div class="info-line">${materialType}</div>
        ${specLine}
        ${originLine}
        ${priceLine}
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    // 等图片渲染完成再调打印
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>标签打印</DialogTitle></DialogHeader>
        <div className="flex justify-center py-4">
          {/* 预览区 - 模拟标签外观 */}
          <div className="border-2 border-black rounded p-2 w-[210px] font-mono text-xs text-center bg-white text-black">
            {/* 条形码 Canvas */}
            <canvas ref={barcodeCanvasRef} className="block mx-auto" style={{ maxWidth: '100%' }} />
            {/* SKU 文字 */}
            <p className="text-[10px] tracking-wider my-0.5">{item.skuCode || ''}</p>
            {/* 材质 · 器型 */}
            <p className="text-[10px]">{item.materialName || '-'} · {item.typeName || '-'}</p>
            {/* 规格信息 */}
            {specParts && <p className="text-[10px]">{specParts}</p>}
            {/* 产地 */}
            {item.origin && <p className="text-[10px]">产地: {item.origin}</p>}
            {/* 售价 */}
            {item.sellingPrice != null && (
              <p className="text-sm font-bold mt-1">¥{item.sellingPrice.toFixed(2)}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700">
            <Printer className="h-3 w-3 mr-1" />打印
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LabelPrintDialog;
