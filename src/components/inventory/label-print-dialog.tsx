'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Printer } from 'lucide-react';

// ========== Label Print Dialog ==========
function LabelPrintDialog({ item, open, onOpenChange }: { item: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!item) return null;
  const specFieldLabels: Record<string, string> = {
    weight: '克重', metalWeight: '金重', size: '尺寸', braceletSize: '圈口',
    beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈',
  };
  const specParts = item.spec ? Object.entries(item.spec).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${specFieldLabels[k] || k}:${v}`).join(' ') : '';

  function handlePrint() {
    const printContent = document.getElementById('label-print-content');
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=400,height=300');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>标签打印</title><style>
        body { margin: 0; font-family: monospace; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .label { border: 2px solid #000; padding: 8px; width: 200px; font-size: 12px; }
        .label .sku { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 4px; }
        .label .barcode { text-align: center; font-size: 24px; letter-spacing: 4px; margin: 4px 0; }
        .label .info { font-size: 10px; line-height: 1.4; }
        .label .price { font-size: 14px; font-weight: bold; text-align: center; margin-top: 4px; }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>标签打印</DialogTitle></DialogHeader>
        <div className="flex justify-center py-4">
          <div id="label-print-content">
            <div className="label" style={{ border: '2px solid #000', padding: '8px', width: '200px', fontFamily: 'monospace', fontSize: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '4px' }}>{item.skuCode}</div>
              <div style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '4px', margin: '4px 0' }}>
                {item.skuCode.split('').map((c: string, i: number) => <span key={i}>{c === '-' ? ' ' : c}</span>)}
              </div>
              <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
                <div>{item.materialName || '-'} · {item.typeName || '-'}</div>
                {specParts && <div>{specParts}</div>}
                {item.origin && <div>产地: {item.origin}</div>}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', marginTop: '4px' }}>¥{item.sellingPrice?.toFixed(2)}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700"><Printer className="h-3 w-3 mr-1" />打印</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LabelPrintDialog;
