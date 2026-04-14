# Jade Inventory Management System (翡翠进销存管理系统)

## Project Overview
A full-featured jade/jewelry inventory management system built with Next.js 16 + Prisma + SQLite + Tailwind CSS + shadcn/ui.

**Tech Stack**: Next.js 16 (App Router) | React 19 | TypeScript 5 | Prisma (SQLite) | Tailwind CSS 4 | shadcn/ui | Zustand | Recharts

**Key Features**: Dashboard analytics, inventory CRUD, batch management, sales records, customer management, operation logs, system settings, barcode scanner, dark mode, mobile responsive.

## Build & Run Commands
```bash
pnpm install          # Install dependencies
pnpm run dev          # Start dev server on port 5000
pnpm run build        # Production build
pnpm run start        # Start production server
pnpm run lint         # ESLint check
npx prisma db push    # Push schema to SQLite
npx tsx prisma/seed.ts # Seed demo data
```

## Project Structure
```
src/
├── app/
│   ├── page.tsx              # Main SPA page (tab-based navigation)
│   ├── layout.tsx            # Root layout (ThemeProvider, fonts)
│   ├── globals.css           # Global styles + Tailwind
│   └── api/                  # 60+ API routes
│       ├── auth/             # Login/session management
│       ├── items/            # Inventory CRUD + batch ops
│       ├── sales/            # Sales + returns + bundles
│       ├── batches/          # Batch management + allocation
│       ├── customers/        # Customer CRUD
│       ├── suppliers/        # Supplier CRUD
│       ├── dashboard/        # Dashboard aggregate + 15+ chart APIs
│       ├── dicts/            # Material/Type/Tag dictionaries
│       ├── config/           # System config key-value
│       ├── metal-prices/     # Precious metal pricing + repricing
│       ├── logs/             # Operation logs
│       ├── export/           # CSV/Excel export
│       ├── import/           # Data import
│       ├── pricing/          # Pricing engine
│       └── backup/           # DB backup/restore
├── components/
│   ├── inventory/            # All business components
│   │   ├── dashboard-tab.tsx
│   │   ├── inventory-tab.tsx
│   │   ├── sales-tab.tsx
│   │   ├── batches-tab.tsx
│   │   ├── customers-tab.tsx
│   │   ├── settings-tab.tsx
│   │   ├── logs-tab.tsx
│   │   ├── navigation.tsx
│   │   ├── shared.tsx        # ErrorBoundary, LoadingSkeleton, etc.
│   │   ├── item-create-dialog.tsx
│   │   ├── item-detail-dialog.tsx
│   │   ├── batch-create-dialog.tsx
│   │   ├── batch-detail-dialog.tsx
│   │   ├── barcode-scanner.tsx
│   │   ├── image-lightbox.tsx
│   │   ├── login-page.tsx
│   │   └── notification-bell.tsx
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── api.ts                # Frontend API client
│   ├── store.ts              # Zustand state management
│   ├── db.ts                 # Prisma client singleton
│   └── auth.ts               # Session management
prisma/
├── schema.prisma             # 18 models (SQLite)
└── seed.ts                   # Demo data seeder
```

## Database
- SQLite via Prisma ORM (file: `db/custom.db`)
- 18 tables: SysConfig, DictMaterial, DictType, DictTag, Supplier, Customer, Batch, Item, ItemTag, ItemSpec, ItemImage, SaleRecord, BundleSale, MetalPrice, User, SaleReturn, OperationLog, Session
- Default admin password: `admin123` (stored in SysConfig)

## Code Style
- TypeScript strict mode (noImplicitAny: false for flexibility)
- Client components use `'use client'` directive
- API routes follow `{ code: 0, data: T, message: "ok" }` response format
- Tailwind CSS with emerald/teal color scheme (jade-themed)
- Dark mode via next-themes

## Environment Variables
- `DATABASE_URL` - SQLite connection string (default: `file:./db/custom.db`)

## Known Issues
- HMR "Router action dispatched before initialization" error in dev mode (cosmetic, not functional)
- barcode-scanner requires HTTPS for camera access (falls back to manual input)
