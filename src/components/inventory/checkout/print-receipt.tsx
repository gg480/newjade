'use client';

/**
 * 销售小票打印组件
 *
 * 纯前端功能，生成打印 HTML 并用 window.print() 打印。
 * 不依赖后端 API，读取店铺名称从 localStorage 或默认值。
 */

interface ReceiptItem {
  skuCode: string;
  name: string;
  actualPrice: number;
}

interface PrintReceiptProps {
  /** 货品明细 */
  items: ReceiptItem[];
  /** 合计金额 */
  totalAmount: number;
  /** 支付方式 */
  paymentMethod: string;
  /** 客户姓名（可选） */
  customerName?: string;
  /** 销售单号（可选） */
  saleOrderNo?: string;
}

/** 支付方式中文映射 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现款',
  transfer: '转账',
  wechat: '微信',
  alipay: '支付宝',
  installment: '分期',
  store: '门店',
};

/**
 * 打开打印窗口并渲染小票 HTML
 */
export function printReceipt({
  items,
  totalAmount,
  paymentMethod,
  customerName,
  saleOrderNo,
}: PrintReceiptProps): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return;
  }

  // 店铺名称（从 localStorage 缓存读取，后端 SysConfig 返回后缓存）
  const storeName =
    localStorage.getItem('store_name') ||
    localStorage.getItem('sysconfig_store_name') ||
    '翡翠进销存';

  // 今日日期
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  const methodLabel = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;

  const itemsHtml = items
    .map(
      (item, i) => `
        <tr>
          <td style="padding:3px 0;font-size:11px;text-align:center;">${i + 1}</td>
          <td style="padding:3px 0;font-size:11px;">${item.skuCode}</td>
          <td style="padding:3px 0;font-size:11px;">${item.name}</td>
          <td style="padding:3px 0;font-size:11px;text-align:right;">¥${item.actualPrice.toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>销售小票</title>
  <style>
    @page { margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'PingFang SC', 'Microsoft YaHei', monospace;
      font-size: 12px;
      color: #333;
      padding: 16px;
      max-width: 80mm;
      margin: 0 auto;
    }
    .header { text-align: center; margin-bottom: 14px; }
    .header .store-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .header .divider { border-top: 1px dashed #bbb; margin: 10px 0; }
    .header .meta { font-size: 11px; color: #888; line-height: 1.6; }
    .info { margin-bottom: 10px; }
    .info .row { display: flex; justify-content: space-between; font-size: 12px; line-height: 1.8; }
    .info .label { color: #888; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    thead th {
      text-align: left;
      font-size: 11px;
      color: #888;
      padding: 4px 0;
      border-bottom: 1px solid #ddd;
    }
    tbody td { font-size: 12px; }
    .total {
      text-align: right;
      font-size: 15px;
      font-weight: bold;
      padding: 8px 0 4px;
      border-top: 1px dashed #bbb;
    }
    .footer { text-align: center; margin-top: 18px; }
    .footer .thanks { font-size: 13px; color: #555; margin-bottom: 4px; }
    .footer .note { font-size: 10px; color: #aaa; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="store-name">${storeName}</div>
    <div class="divider"></div>
    <div class="meta">
      ${saleOrderNo ? `单号：${saleOrderNo}<br>` : ''}
      日期：${dateStr}
    </div>
  </div>

  <div class="info">
    ${customerName ? `<div class="row"><span class="label">客户：</span><span>${customerName}</span></div>` : ''}
    <div class="row"><span class="label">支付方式：</span><span>${methodLabel}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:24px;text-align:center;">#</th>
        <th>SKU</th>
        <th>名称</th>
        <th style="text-align:right;">金额</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="total">
    合计：¥${totalAmount.toFixed(2)}
  </div>

  <div class="footer">
    <p class="thanks">感谢您的惠顾！</p>
    <p class="note">本小票由系统生成，不作报销凭证</p>
  </div>

  <script>
    window.onload = function () {
      window.print();
      window.close();
    };
  </script>
</body>
</html>`);

  printWindow.document.close();
}

/**
 * 将店铺名称缓存到 localStorage，供打印小票时读取
 * 在系统配置加载成功后调用
 */
export function cacheStoreName(name: string): void {
  localStorage.setItem('store_name', name);
}
