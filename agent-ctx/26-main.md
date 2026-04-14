# Task 26 - 上线前7项功能增强

## Agent: main

## Work Log
- Read worklog.md (100 lines) for project history context
- Read all source files needed: settings-tab.tsx, inventory-tab.tsx, sales-tab.tsx, dashboard-tab.tsx, page.tsx, api.ts, globals.css
- Verified existing import/sales-return APIs
- Implemented 7 features across backend + frontend

## Features Implemented

### 1. CSV批量导入 (P0)
- **New API**: `src/app/api/import/items-csv/route.ts`
  - POST endpoint accepting multipart CSV file
  - Handles BOM, custom CSV parser (quoted fields, commas)
  - Column mapping: SKU,名称,器型,材质,状态,成本,售价,柜台号,采购日期
  - Status mapping (在库/已售/已退)
  - Duplicate SKU detection (skips)
  - Transaction-safe batch processing
  - Returns: `{ success, skipped, errors[] }`
- **Frontend**: Enhanced settings-tab.tsx with new "CSV批量导入货品" section
  - Drag & drop zone with emerald highlight
  - Client-side template download (BOM for Excel)
  - Success (green), Skipped (amber), Errors (red) result display
  - Spinner during import
- **API client**: Added `importApi.importCsvItems()` and `itemsApiEnhanced.batchPriceAdjust()`

### 2. Excel导出 (inventory-tab.tsx)
- `handleExportExcel()` - HTML table approach that Excel recognizes
- Styled header row, all same columns as CSV export
- New "导出Excel" button with FileSpreadsheet icon

### 3. Dashboard 利润趋势增强 (dashboard-tab.tsx)
- Added `ReferenceLine` import from recharts
- Gradient fills (emerald for revenue, sky for profit)
- Reference line at y=0 (dashed)
- Dot markers on data points with active dot styling
- Smooth curve (type="monotone") - already existed

### 4. 批量调价功能 (inventory-tab.tsx)
- **New API**: `src/app/api/items/batch-price/route.ts`
  - PATCH endpoint with ids, adjustmentType, value, direction
  - Percentage and fixed amount support
  - Price floor at 0
  - Max 500 items per batch
  - Transaction-safe updates with error tracking
- **Frontend**: Enhanced batch price dialog
  - New "调整方向" toggle (加价/减价) with color-coded buttons
  - Preview summary showing "选中 N 件货品，预计调整..."
  - Uses new batch API instead of client-side loop

### 5. 销售退货 (Verified existing implementation)
- Existing return functionality is comprehensive:
  - Detailed dialog with item thumbnail, sale details
  - Refund amount, return reason dropdown, return date
  - Warning banner, validation
  - API creates SaleReturn, updates item status
- No changes needed - already production-ready

### 6. 移动端触摸优化 (globals.css)
- `touch-action: manipulation` on buttons/links/tabs
- `-webkit-tap-highlight-color: transparent`
- `user-select: none` on interactive elements
- `.scroll-touch` class with `-webkit-overflow-scrolling: touch`
- `.tab-fade-in`, `.card-slide-up`, `.card-glow` animations defined in CSS

### 7. 全局加载状态 (page.tsx + globals.css)
- Fixed top loading bar (2px height, emerald gradient)
- CSS `@keyframes loadingBar` animation (indeterminate sliding)
- Positioned at z-[100] above all content

## Files Changed
- `src/app/api/import/items-csv/route.ts` — NEW
- `src/app/api/items/batch-price/route.ts` — NEW
- `src/lib/api.ts` — Added importApi.importCsvItems, itemsApiEnhanced.batchPriceAdjust
- `src/components/inventory/settings-tab.tsx` — CSV quick import section
- `src/components/inventory/inventory-tab.tsx` — Excel export, batch price enhance
- `src/components/inventory/dashboard-tab.tsx` — Profit trend gradient/reference line
- `src/app/page.tsx` — Loading bar
- `src/app/globals.css` — Touch optimization + loading bar CSS

## Verification
- ✅ ESLint lint: 0 errors, 0 warnings
- ✅ Dev server compiles (server binds to port 3000)
- ⚠️ GitHub push failed - token expired (ghp_BoTLkx9... returns 401)

## Notes
- Git commit created locally: "Task 26: 上线前7项功能..."
- User needs to update GitHub token to push
- All 7 features implemented and lint-clean
