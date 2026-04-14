# Task 3 - Frontend Missing Features Agent

## Task Summary
Rewrite `/home/z/my-project/src/app/page.tsx` to add ALL missing features while keeping existing functionality for a jade inventory management system (玉器店进销存).

## Files Modified
1. **`src/lib/store.ts`** - Added `theme` and `setTheme` to AppState
2. **`src/app/layout.tsx`** - Added ThemeProvider from next-themes, switched to sonner Toaster, updated metadata
3. **`src/app/page.tsx`** - Complete rewrite with all missing features

## Features Added
1. **ItemCreateDialog** - Dual-mode creation dialog (高货入库/通货入库) with dynamic spec fields based on type's specFields JSON
2. **ItemDetailDialog** - Full item detail view with all fields, spec params, tags, sales history, image placeholder
3. **BatchCreateDialog** - New batch creation form with all required fields
4. **BundleSaleDialog** - Bundle sale with multi-item selection, by_ratio/chain_at_cost allocation, chain items checkbox
5. **ThemeToggle** - Dark mode toggle dropdown (light/dark/system) in desktop nav header
6. **MobileNav** - Bottom navigation bar for mobile (6 tabs, emerald accent)
7. **DesktopNav** - Top navigation with theme toggle button
8. **Sticky Footer** - Desktop footer with mt-auto
9. **Export Buttons** - On Inventory, Sales, and Batches tabs linking to /api/export/* endpoints

## Validation
- ✅ `bun run lint` passes with 0 errors
- ✅ Dev server running, all API routes returning 200
- ✅ No TypeScript errors

## Known Limitations
- Image upload requires backend multipart support (placeholder shown)
- Mobile card view for inventory table not implemented
- Page transition animations not added
