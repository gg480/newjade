# Task 22 Summary - Jade Inventory Enhancement Features

## Overview
6 features were tasked. 2 were already fully implemented in the codebase (Features 1 & 2). 4 new features were implemented.

## Feature Details

### Feature 1: 销售退货对话框增强 ✅ Already Implemented
- The sales return dialog in `sales-tab.tsx` (lines 634-753) already contains all requested features:
  - Item card with thumbnail, name, SKU, material, type, original price
  - Sales metadata grid (date/customer/phone)
  - Warning banner with AlertTriangle icon
  - Refund amount input with ¥ prefix and original price validation
  - Return reason dropdown (质量问题/尺寸不合适/客户反悔/其他 + custom)
  - Return date picker (default today)
  - Submit with "处理中..." loading state
- **No changes needed**

### Feature 2: 客户排序功能 ✅ Already Implemented
- Customer sort dropdown in `customers-tab.tsx` (lines 422-428, 592-613, 648-659) already has:
  - Sort options: 最近购买(Clock), 消费总额(DollarSign), 购买次数(ShoppingCart), 名称(ArrowDownAZ)
  - Default: 最近购买
  - Client-side sorting with proper comparison logic
  - Icons in dropdown items
- **No changes needed**

### Feature 3: 批次数据CSV导出 (batches-tab.tsx)
**File**: `src/components/inventory/batches-tab.tsx` (lines 99-139)
**Changes**:
- Updated CSV columns to match spec: 批次编号, 材质, 供应商, 数量, 已录入, 进度%, 总成本, 单价, 创建日期
- Added computed fields: `pct` (进度百分比) and `unitPrice` (单价=总成本/数量)
- Fixed filename typo: `批次数據` → `批次数据` (simplified Chinese)
- Fixed toast message typo to match

### Feature 4: Dashboard 销售渠道分布图
**Files**:
- `src/app/api/dashboard/sales-by-channel/route.ts` — **NEW** (48 lines)
  - GET endpoint grouping sales by channel (门店/微信/null→其他)
  - Returns array of `{channel, label, count, totalRevenue, totalProfit}`
  - Supports start_date/end_date query params
- `src/lib/api.ts` — Added `getSalesByChannel()` method (lines 226-229)
- `src/components/inventory/dashboard-tab.tsx`:
  - Added `salesByChannel` state (line 94)
  - Added `Store` to lucide-react imports (line 22)
  - Added API call in `fetchData()` Promise.allSettled (line 221)
  - Added `setSalesByChannel(val(15, []))` result extraction (line 242)
  - Changed sparkline index from 15 to 16 (line 244)
  - Added new "销售渠道分布" PieChart card (lines 827-879):
    - Inner/outer radius donut chart with specific color coding
    - 门店=sky blue (#0284c7), 微信=emerald green (#059669), 其他=gray (#94a3b8)
    - Right-side legend with colored dots, count, revenue, percentage
    - Progress bars showing channel share
  - Changed grid from `lg:grid-cols-2` to `lg:grid-cols-3` (line 784)

### Feature 5: 库存快速操作菜单 (inventory-tab.tsx)
**File**: `src/components/inventory/inventory-tab.tsx`
**Changes**:
- Desktop dropdown menu (after line 1027): Added "退货" menu item with RotateCcw icon
  - Only visible when `item.status === 'in_stock'`
  - Triggers `setReturnConfirmItem({ open: true, item })`
- Mobile dropdown menu (after line 1150): Added same "退货" menu item
  - Same visibility condition and behavior

### Feature 6: 设置页面数据概览 (settings-tab.tsx)
**File**: `src/components/inventory/settings-tab.tsx` (lines 387-459)
**Changes**:
- Replaced 4-card grid with 5-card grid (`grid-cols-2 md:grid-cols-5`)
- Updated stat cards:
  1. 货品总数 (Package icon, emerald accent)
  2. 销售总数 (ShoppingCart icon, sky accent) — **NEW** (was missing)
  3. 客户总数 (Users icon, amber accent)
  4. 批次总数 (Layers icon, teal accent) — **NEW** (replaced 总供应商)
  5. 数据库信息 (Database icon, violet accent) — shows lastBackup time
- Changed from nested Card components to flat div layout with `border-l-4` colored accents
- Dark mode support with `dark:` color variants
- Reduced icon/spacing for more compact 5-column layout

## Verification
- `bun run lint` → **0 errors, 0 warnings** ✅
- All changes use existing code patterns and shadcn/ui components
- Chinese UI text everywhere as required
