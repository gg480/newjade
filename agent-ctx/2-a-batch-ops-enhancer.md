# Task 2-a: Add Batch Operations to Inventory Page

## Agent: batch-ops-enhancer

## Summary
Enhanced the inventory-tab.tsx component with batch operation improvements and fixes.

## Changes Made

### 1. Selected Row Highlight Styling
- Desktop table: `bg-primary/5` → `bg-emerald-50 dark:bg-emerald-950/20`
- Mobile card: `ring-2 ring-primary/40 bg-primary/5` → `ring-2 ring-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/20`

### 2. Batch Delete Dialog - Max 5 Items
- Changed from showing all items to `selectedItems.slice(0, 5)`
- Added "等 {total} 件" text when more than 5 items selected

### 3. Batch Sell - Fix useCurrentPrice Bug + Individual Price Input
- Fixed bug where both branches of ternary used same value
- Added `batchSellPrices` state for individual price editing
- When `useCurrentPrice=false`, shows per-item price input fields
- Total revenue calculation uses individual prices when applicable

### 4. Batch Operation Progress Indicator
- Added `batchProgress` state: `{ current: number; total: number } | null`
- All 4 batch operations show colored progress bars:
  - Sell = emerald, Delete = red, Price = amber, Counter = sky
- Button text shows real-time progress: "出库中 3/10"

### 5. Custom Delete Confirmation Dialog
- Replaced native `confirm()` with AlertDialog component
- Shows item details: SKU, name, material, price, batch

### 6. Form Disable During Batch Operations
- All batch dialog inputs/selects disabled when `batchLoading=true`

## Files Modified
- `src/components/inventory/inventory-tab.tsx` (979 → 1120 lines)
- `worklog.md` (appended task record)

## Verification
- ESLint: 0 errors, 0 warnings
- All batch operations functional
