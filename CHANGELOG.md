# Changelog

All notable changes to the Jade Inventory Management System (翡翠进销存管理系统).

Format: [BUG] Bug修复 | [FEAT] 功能更新 | [TEST] 测试相关 | [DEPLOY] 部署修复

---

## [2026-04-17]

### [FEAT] 图片存储本地化 + Docker 镜像支持
- **新增文件**: `src/app/api/images/[filename]/route.ts`, `docker-compose.yml`
- **修改文件**: `src/app/api/items/[id]/images/route.ts`, `Dockerfile`
- **内容**:
  - 图片上传 API：开发环境存 `public/images/`（Next.js 静态服务），生产环境存 `/app/data/images/`（Docker Volume）
  - 数据库中图片路径：开发 `/images/xxx.png`，生产 `/api/images/xxx.png`
  - 新增 `/api/images/[filename]` 路由：生产环境通过 API 读取本地图片文件，含目录遍历防护 + MIME 类型校验 + 缓存头
  - Dockerfile 添加 `VOLUME ["/app/data", "/app/db"]` 声明，`/app/data/images` 和 `/app/db` 持久化
  - docker-compose.yml 一键启动，数据库和图片分别挂载 volume
  - 图片上传增加文件类型校验（JPG/PNG/GIF/WEBP）和大小限制（10MB）

### [FEAT] 修复移动端显示适配
- **修改文件**: `dialog.tsx`, `inventory-tab.tsx`, `item-create-dialog.tsx`, `item-detail-dialog.tsx`, `batch-create-dialog.tsx`, `batch-detail-dialog.tsx`, `sales-tab.tsx`, `customers-tab.tsx`, `batches-tab.tsx`, `settings-tab.tsx`, `customer-search-select.tsx`
- **内容**:
  - Dialog 组件基础样式：移动端 padding 从 p-6 改为 p-4 sm:p-6，宽度从 calc(100%-2rem) 改为 calc(100%-1rem)
  - 所有 `grid-cols-2` 改为 `grid-cols-1 sm:grid-cols-2`（筛选区、表单、详情面板）
  - 所有 `grid-cols-3` 改为 `grid-cols-1 sm:grid-cols-3`（入库规格、销售详情）
  - 所有 `grid-cols-2 md:grid-cols-N` 改为 `grid-cols-2 sm:grid-cols-3 md:grid-cols-N`（统计卡片）
  - CustomerSearchSelect 下拉宽度改为 `min(320px, calc(100vw-2rem))` 防溢出
  - Settings Tab 标签页 `grid-cols-6` 改为 `grid-cols-3 sm:grid-cols-6`
- **涉及组件**: 11个文件，约30处 grid-cols 响应式断点调整

### [BUG] 修复 customersApi is not defined — 点击库存管理报错
- **文件**: `src/components/inventory/inventory-tab.tsx`
- **原因**: 替换客户Select为搜索组件时误删了 `customersApi` import，但批量出库仍依赖它加载客户数据
- **修复**: 恢复 `customersApi` import
- **commit**: `d0c9133`

### [FEAT] 出库模块客户选择器改为手机号/姓名/微信搜索模式
- **新增文件**: `src/components/inventory/customer-search-select.tsx`
- **修改文件**: `src/components/inventory/inventory-tab.tsx`
- **内容**:
  - 新增 `CustomerSearchSelect` 组件（基于 Popover + Command）
  - 输入时 300ms 防抖搜索后端 API（`/api/customers?keyword=xxx`）
  - 支持按姓名、手机号、微信搜索客户
  - 下拉列表展示客户姓名+手机号/微信，支持"散客"选项
  - 出库对话框和批量出库对话框均替换为搜索模式
- **commit**: `56885d5`

### [BUG] 修复 getItemTagColor is not defined — 点击SKU数据行报错
- **文件**: `src/components/inventory/inventory-tab.tsx`
- **原因**: 第2074行使用了 `getItemTagColor(tag)`，但函数实际定义名是 `getTagColor`
- **修复**: `getItemTagColor(tag)` → `getTagColor(tag)`
- **commit**: `ca765dc`

### [BUG] 修复 P0-P1 业务问题（4项）
- **修改文件**: `inventory-tab.tsx`, `item-create-dialog.tsx`, `items/route.ts`, `items/batch/route.ts`, `batch-create-dialog.tsx`, `batches/route.ts`
- **内容**:
  1. **P0-#4 点击多选框时弹出侧边框**: TableCell/Checkbox 加 `onClick={e => e.stopPropagation()}`
  2. **P0-#2 批次入库成本价校验逻辑**: `validateRequiredFields` 区分高货/通货模式，通货模式成本从批次分摊；前端展示"预计分摊成本"；后端有batchId时自动计算allocatedCost
  3. **P1-#6 SKU编码和批次编码纯ASCII**: SKU格式改为 `{材质ID2位}{类型ID2位}-{月日4位}-{序号3位}` 如 `0601-0417-001`；批次格式改为 `B{类别码}{月日4位}{序号3位}` 如 `BJ0417001`；后端增加非ASCII字符校验
  4. **P1-#3 所有编号默认生成不许用户录入**: batchCode Input改为只读+自动生成；移除batchCode空值校验
- **commit**: `be045f2`

### [BUG] 修复 React error #31 — item.tags 对象被当作字符串渲染
- **文件**: `src/components/inventory/inventory-tab.tsx`
- **原因**: API返回 `item.tags` 是对象数组 `[{id, name, groupName, isActive}]`，3处代码直接当 `string[]` 渲染
- **修复**: 3处标签渲染逻辑改为 `tgs.map(t => typeof t === 'string' ? t : t.name)` 提取标签名
- **commit**: `472cc71`

### [BUG] 修复确认出库报错 — 全面增加 API 参数校验防止 NaN 崩溃
- **修改文件**: `sales/route.ts`, `sales/return/route.ts`, `sales/bundle/route.ts`, `items/route.ts`, `items/batch/route.ts`, `batches/route.ts`, `metal-prices/route.ts`, `metal-prices/reprice/route.ts`, `customers/route.ts`, `inventory-tab.tsx`
- **原因**: `actualPrice` 为空字符串时 `parseFloat("")` 返回 NaN，Prisma 收到 NaN 后抛异常
- **修复**:
  - 8个API路由增加必填参数校验和NaN防护
  - 前端出库对话框增加成交价/渠道/日期必填验证和红色星号标记
  - 修复 `items/route.ts` 中校验代码在 `finalMaterialId` 声明前使用导致的运行时错误
- **commit**: `f8431e6`

### [TEST] 添加前端业务流程 E2E 点击测试脚本
- **新增文件**: `tests/e2e-click-test.ts`
- **内容**: 覆盖15个业务场景、79项断言——首页加载、7个Tab导航、23个Dashboard图表、入库/编辑/销售/退货/批次/客户/贵金属/系统设置/认证/套装/备份/日志
- **commit**: `dba4f46`

---

## [2026-04-16]

### [FEAT] 器型必填、成本价必填、采购日期默认当天
- **文件**: `src/components/inventory/item-create-dialog.tsx`
- **内容**:
  - 添加器型(typeId)必填验证 + 红色星号标记
  - 添加成本价(costPrice)必填验证 + 红色星号标记
  - purchaseDate 默认值从空字符串改为当天日期
- **commit**: `8b4644e`

### [BUG] 全面排查并修复 API 数据类型转换问题，解决入库 Internal Server Error
- **修改文件**: `items/route.ts`, `items/[id]/route.ts`, `items/batch/route.ts`, `sales/route.ts`, `sales/return/route.ts`, `sales/bundle/route.ts`, `batches/route.ts`, `metal-prices/route.ts`, `metal-prices/reprice/route.ts`
- **原因**: 前端传 Int 值（如 braceletSize=56）但 Prisma schema 要求 String?，10个API路由缺少类型转换
- **修复**: 全面添加 spec 字段类型转换 + 数值字段 parseInt/parseFloat
- **commit**: `6fc463f`, `6bd8888`

### [BUG] 修复部署环境 DATABASE_URL 缺失导致前端加载失败
- **修改文件**: `src/lib/db.ts`, `package.json`, `scripts/deploy-build.sh`
- **原因**: `.env` 只在构建时被 Turbopack 读取，运行时不加载，Prisma Client 初始化失败
- **修复**: 三重保障 — db.ts fallback + package.json start脚本 + deploy-build.sh export
- **commit**: `6432291`

### [BUG] 修复部署 Turbopack panic — Invalid distDirRoot
- **修改文件**: `next.config.ts`
- **原因**: 硬编码 `outputFileTracingRoot: "/workspace/projects"`，部署环境路径为 `/tmp/workdir`
- **修复**: 移除 outputFileTracingRoot，添加 `turbopack: { root: path.resolve(__dirname) }` 动态解析
- **commit**: `f1a09ec`

### [DEPLOY] 修复部署构建失败 — bash -c 复合命令解析异常
- **新增文件**: `scripts/deploy-build.sh`
- **修改文件**: `.coze`, `package.json`
- **原因**: `.coze` 的 `["bash", "-c", "compound string"]` 被部署平台解析异常
- **修复**: 创建独立部署脚本，改用 `["sh", "scripts/deploy-build.sh"]`；添加 postinstall/prebuild 钩子
- **commit**: `62ce13a`

### [DEPLOY] 修复部署构建缺少 pnpm install 和 prisma generate 步骤
- **修改文件**: `.coze`
- **原因**: deploy build 仅配置 `["pnpm", "run", "build"]`，部署环境无 node_modules
- **修复**: 改为包含 install + prisma generate 的复合命令
- **commit**: `d1417ac`

---

## [2026-04-14]

### [BUG] Dashboard 分批加载+图表延迟渲染，解决页面卡死无法交互
- **文件**: `src/components/inventory/dashboard-tab.tsx`
- **内容**: Dashboard 组件分批加载图表数据，延迟渲染减少首屏计算量
- **commit**: `8d7714c`

### [BUG] 用 next/dynamic 替换 React.lazy，修复看板页卡死无法切标签
- **文件**: `src/app/page.tsx`, `src/lib/store.ts`
- **内容**: Dashboard/Inventory/Settings 动态导入添加 `ssr:false`，默认 activeTab 改为 sales
- **commit**: `b57d7ec`, `adffeda`

### [BUG] 适配沙箱环境并修复服务启动问题
- **文件**: 多项环境配置
- **内容**: 修复 Prisma Client 未生成、端口绑定、构建缓存等问题
- **commit**: `82fe902`, `0e9ec7e`

### [INIT] Initial commit
- **内容**: 项目初始化，翡翠进销存管理系统基础代码
- **commit**: `5ff65ed`
