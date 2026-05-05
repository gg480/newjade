# Jade Inventory Management System (翡翠进销存管理系统)

**处理每个用户请求的第一步：读取 `Skill/team-sop/SKILL.md`**

## Project Overview

A full-featured jade/jewelry inventory management system built with Next.js 16 + Prisma + SQLite + Tailwind CSS + shadcn/ui.

**Tech Stack**: Next.js 16 (App Router) | React 19 | TypeScript 5 | Prisma (SQLite) | Tailwind CSS 4 | shadcn/ui | Zustand | Recharts

**Key Features**: Dashboard analytics, inventory CRUD, batch management, sales records, customer management, operation logs, system settings, barcode scanner, dark mode, mobile responsive.

## Build & Run Commands

```bash
pnpm install          # Install dependencies
npx prisma generate   # Generate Prisma client (required after install/pull)
npx prisma db push    # Push schema to SQLite (first time or after schema change)
pnpm run dev          # Start dev server on port 5000 (HMR enabled)
pnpm run build        # Production build (creates .next/ directory)
pnpm run start        # Start production server on port 5000
pnpm run lint         # ESLint check
npx tsx prisma/seed.ts # Seed demo data
npx tsx tests/e2e-click-test.ts # Run E2E business flow test (79 assertions)
```

**Important**: After pulling code or changing Prisma schema, always run `rm -rf .next && npx prisma generate` before starting.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main SPA page (tab-based navigation, default tab=sales)
│   ├── layout.tsx            # Root layout (ThemeProvider, fonts)
│   ├── globals.css           # Global styles + Tailwind
│   └── api/                  # 60+ API routes
│       ├── auth/             # Auth API (未启用，局域网无需认证)
│       ├── items/            # Inventory CRUD + batch ops
│       ├── sales/            # Sales + returns + bundles
│       ├── batches/          # Batch management + allocation
│       ├── customers/        # Customer CRUD (supports keyword search)
│       ├── suppliers/        # Supplier CRUD
│       ├── dashboard/        # Dashboard aggregate + 23 chart APIs
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
│   │   ├── inventory-tab.tsx       # Inventory list + sale dialog + batch sell
│   │   ├── sales-tab.tsx
│   │   ├── batches-tab.tsx
│   │   ├── customers-tab.tsx
│   │   ├── settings-tab.tsx
│   │   ├── logs-tab.tsx
│   │   ├── navigation.tsx
│   │   ├── shared.tsx              # ErrorBoundary, LoadingSkeleton, etc.
│   │   ├── item-create-dialog.tsx  # High-value + batch item creation
│   │   ├── item-detail-dialog.tsx
│   │   ├── batch-create-dialog.tsx # Quick + full batch creation
│   │   ├── batch-detail-dialog.tsx
│   │   ├── customer-search-select.tsx  # Async customer search (phone/name/wechat)
│   │   ├── barcode-scanner.tsx
│   │   ├── image-lightbox.tsx
│   │   ├── login-page.tsx    # 未启用（前端直接进入工作区）
│   │   └── notification-bell.tsx
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── api.ts                # Frontend API client
│   ├── store.ts              # Zustand state management
│   ├── db.ts                 # Prisma client singleton (DATABASE_URL fallback)
│   └── auth.ts               # Session管理（未启用）
prisma/
├── schema.prisma             # 18 models (SQLite)
└── seed.ts                   # Demo data seeder
scripts/
└── deploy-build.sh           # Deployment build script (install + prisma + build)
tests/
└── e2e-click-test.ts         # E2E business flow test (15 scenarios, 79 assertions)
```

## Database

- SQLite via Prisma ORM (file: `db/custom.db`)
- 30 tables (Prisma models): SysConfig, DictMaterial, DictType, DictTag, Supplier, Customer, Batch, Item, ItemTag, ItemSpec, ItemImage, SaleRecord, BundleSale, MetalPrice, User, SaleReturn, OperationLog, Session, PriceRange, CustomerSegment, ProductCategory, Promotion, PromotionItem, PromotionEffect, Stocktaking, StocktakingDetail, SeasonalFactor, RestockRecommendation, PriceChangeLog
- Default admin password: `admin123` (stored in SysConfig)

## Code Style

- TypeScript strict mode (noImplicitAny: false for flexibility)
- Client components use `'use client'` directive
- API routes follow `{ code: 0, data: T, message: "ok" }` response format
- API error responses: `{ code: 400/500, data: null, message: "错误描述" }`
- Tailwind CSS with emerald/teal color scheme (jade-themed)
- Dark mode via next-themes

## Business Rules

- **SKU编码**: 纯ASCII格式 `{材质ID2位}{类型ID2位}-{月日4位}-{序号3位}`，如 `0601-0417-001`，系统自动生成，不允许用户输入
- **批次编码**: 纯ASCII格式 `B{类别码}{月日4位}{序号3位}`，如 `BJ0417001`，系统自动生成，不允许用户输入
- **类别码映射**: 玉→J、贵金属→M、水晶→C、文玩→A、其他→O
- **成本价规则**: 高货模式必填；通货模式（有batchId）由批次自动分摊 `totalCost / quantity`
- **客户选择**: 出库/批量出库使用异步搜索组件，支持手机号/姓名/微信搜索
- **必填字段**: 器型(typeId)、成本价(costPrice，高货模式)、成交价(actualPrice，出库时)、销售渠道、销售日期
- **标签渲染**: API返回 `item.tags` 是对象数组，渲染时需提取 `.name` 属性

## Environment Variables

- `DATABASE_URL` - SQLite connection string (default: `file:./db/custom.db`, fallback in db.ts)
- `COZE_PROJECT_DOMAIN_DEFAULT` - Deployment domain
- `DEPLOY_RUN_PORT` - Service port (must be 5000)

## Deployment

- `.coze` config uses `scripts/deploy-build.sh` for build (handles install + prisma + build)
- `package.json` has `postinstall: "prisma generate"` and `prebuild: "prisma generate"` as safeguards
- Production start script: `DATABASE_URL=${DATABASE_URL:-file:./db/custom.db} NODE_ENV=production next start -p 5000`

## Known Issues

- HMR "Router action dispatched before initialization" error in dev mode (cosmetic, not functional)
- barcode-scanner requires HTTPS for camera access (falls back to manual input)
- After pulling fresh code or updating Prisma schema, MUST clear `.next` cache (`rm -rf .next`) and re-run `npx prisma generate` before starting dev server
- 认证代码（`login-page.tsx`, `auth/route.ts`, `auth.ts`）存在但未启用，前端直接进入工作区，局域网无需登录
- Deployment environment uses `/tmp/workdir` as project path (not `/workspace/projects`)
- Turbopack production build sometimes caches old chunks — if code changes don't take effect, do `rm -rf .next && pnpm build`

## \[CRITICAL] File Safety Rules（防文件清空）

### 事故记录（2026-05-05）

`inventory-tab.tsx`（2199行）被 @Backend agent 意外清空。根因：SOLO Coder 将包含前端文件修改的任务委派给了 @Backend，@Backend 执行 Write 操作时全量覆盖了文件内容。已通过 `git checkout` 恢复。

### 大文件保护清单（>1000行，修改前必须 git stash 备份）

| 文件                  | 行数     | 所有者       |
| ------------------- | ------ | --------- |
| `inventory-tab.tsx` | \~2200 | @Frontend |
| `settings-tab.tsx`  | \~1200 | @Frontend |
| `dashboard-tab.tsx` | \~1864 | @Frontend |
| `sales-tab.tsx`     | \~1343 | @Frontend |
| `customers-tab.tsx` | \~1012 | @Frontend |

### 修改文件的铁律

1. **用 SearchReplace，永远不要用 Write 修改现有文件**（Write 只用于新建文件）
2. **修改前先 Read**确认文件当前内容
3. **修改后立即 Read 前5行**验证文件非空
4. \*\*大文件修改前 `git stash`\*\*做备份
5. **跨所有权任务必须拆分**，禁止一个 Agent 同时修改前后端文件

### 恢复命令

```bash
git checkout -- <被清空文件路径>
```

## Change Log

See [CHANGELOG.md](./CHANGELOG.md) for detailed change history with bug fixes and feature updates categorized by date.

## Development Workflow

1. Before modifying: Record planned changes in CHANGELOG.md under a new date entry
2. After modifying: Update the CHANGELOG entry with actual changes (files, reasons, fixes)
3. Update AGENTS.md if project structure, business rules, or known issues change
4. Run `pnpm lint --quiet` and `npx tsx tests/e2e-click-test.ts` before committing

