# Changelog

All notable changes to the Jade Inventory Management System (翡翠进销存管理系统).

Format: [BUG] Bug修复 | [FEAT] 功能更新 | [TEST] 测试相关 | [DEPLOY] 部署修复

---

## [2026-04-18]

### [BUG] 修复 NAS Docker 权限拒绝 + 图片按钮冒泡
- **修改文件**: `scripts/entrypoint.sh`, `Dockerfile`, `docker-compose.yml`, `src/components/inventory/inventory-tab.tsx`
- **内容**:
  - entrypoint.sh 移除 `set -e`，避免 mkdir 失败导致容器崩溃循环重启
  - Dockerfile 容器以 root 启动，安装 su-exec，支持 PUID/PGID 环境变量降权运行
  - entrypoint.sh 启动时自动 chown 数据目录，解决 NAS 映射目录权限问题
  - docker-compose.yml 添加 PUID=0/PGID=0 默认值（root 运行，兼容所有 NAS）
  - 修复图片列 TableCell 没有 stopPropagation 导致点击图片打开侧边栏的问题
  - 修复卡片视图中图片区域点击冒泡问题

### [DEPLOY] Docker 持久化路径统一 + 启动判断逻辑
- **修改文件**: `scripts/entrypoint.sh`(新增), `Dockerfile`, `docker-compose.yml`
- **内容**:
  - 新增 `entrypoint.sh` 启动脚本，统一 `DATABASE_URL=file:/app/data/db/custom.db`
  - 启动时判断数据库是否已存在：已存在则仅做 schema 迁移（`prisma db push`），不存在才创建表+种子数据
  - 修复之前 prisma db push 和应用使用不同数据库路径的问题
  - Dockerfile 改为 `ENTRYPOINT` 指向 entrypoint.sh，不再用 CMD 内联命令
  - docker-compose.yml 改为本地目录映射 `./jade-data:/app/data`（NAS 友好），注释标注可替换为 NAS 实际路径
  - 镜像更新时保留已有数据（db/images/logs），仅同步 schema 变更

### [DEPLOY] 生产 Docker 镜像排除测试数据
- **修改文件**: `prisma/seed.ts`, `prisma/seed-base.ts`(新增), `prisma/seed-demo.ts`(新增), `Dockerfile`, `.dockerignore`
- **内容**:
  - `seed.ts` 拆分为环境感知入口：`NODE_ENV=production` 仅初始化基础配置，否则初始化基础+演示数据
  - `seed-base.ts` 新增：仅包含系统配置/材质/器型/标签/贵金属市价（生产必需）
  - `seed-demo.ts` 新增：保留原完整演示数据（供应商/批次/货品/客户/销售记录）
  - Dockerfile CMD 改为 `prisma db push + seed-base.ts`（不再执行演示数据种子）
  - `.dockerignore` 排除 `db/`、`prisma/seed-demo.ts`、`prisma/seed-business.ts`、`tests/`、`public/images/`

### [DEPLOY] 修复 GitHub Actions Docker Hub 推送失败
- **修改文件**: `.github/workflows/docker-build.yml`
- **内容**:
  - 将 Docker Hub 用户名从 `gg480` 改为 `lrunningmjgoat`
  - 移除 secrets 条件判断导致的登录步骤跳过问题
  - 简化工作流：直接使用 `push: true`，移除 `load` 回退逻辑
  - 确保登录步骤始终执行，依赖 GitHub Secrets 正确配置

---

## [2026-04-17]

### [FEAT] 统一数据存储路径，Docker 单 Volume 持久化
- **修改文件**: `src/lib/db.ts`, `src/app/api/backup/route.ts`, `Dockerfile`, `docker-compose.yml`, `package.json`
- **内容**:
  - `db.ts` 统一数据库路径解析：有 `DATA_DIR` 环境变量时用 `{DATA_DIR}/db/custom.db`，否则用 `./db/custom.db`
  - `backup/route.ts` 备份/恢复路径与 db.ts 统一，使用 `DATA_DIR/db/` 目录
  - Docker 简化为单 VOLUME `/app/data`，子目录：`/app/data/db/`（数据库）、`/app/data/images/`（图片）、`/app/data/logs/`（日志预留）
  - Dockerfile 添加首次启动自动执行 `prisma db push` 初始化数据库
  - docker-compose.yml 从双 volume 简化为单 volume `jade-data:/app/data`
  - package.json start 脚本移除硬编码 DATABASE_URL

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
