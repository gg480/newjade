# 任务交接 · Handover

> 最后更新：2026-06-07 | 更新人：前端工程师

---

## ❌ [重要] Git 提交红线（2026-06-06 新增）

**规则**：禁止未经用户确认就自动 `git commit` + `git push`。所有代码提交必须先展示改动内容，等用户说"提交"再操作。

---

## ❌ [重要] NAS 部署操作红线（2026-06-06 新增）

**规则**：禁止直接用 `docker run`/`docker stop`/`docker rm` 等命令修改 NAS 上运行中的容器。NAS 上的部署使用 `docker compose` 管理，更新操作应指导用户自行执行 `sh nas-update.sh`。

**背景**：排查金价 API 问题时，SOLO Coder 直接用 raw `docker run` 重建容器，绕过了用户原有的 compose 管理方式，导致用户需要重新创建容器。

**正确做法**：
- 需要更新时 → 告诉用户：等 CI 构建完，在 NAS 上 `cd <compose目录> && sh scripts/nas-update.sh`
- 需要排查时 → 只读查看，不修改容器配置
- 需要改配置时 → 指导用户操作，不代劳

---

## ⚠️ 种子数据变更必检规则（2026-06-06 新增）

**规则**：任何涉及 prisma/seed*.ts 的变更，必须在 `scripts/entrypoint.sh` 中同步执行对应的种子文件。

**背景**：`seed-base.ts`（每次启动执行）创建旧版贵金属材质（`黄金/subType=k999`），`seed.ts`（从未执行）将其迁移为新版（`黄金999足金/subType=Au9999`）。生产环境跑了几个月旧版数据，导致贵金属行情价格获取失败。

**已修复**：`entrypoint.sh` 现在在 `seed-base.ts` 之后自动执行 `seed.ts`。

**检查清单**（后续涉及 seed 变更时）：
- [ ] `seed.ts` 是否纯增量（只 upsert/update，不 delete）？
- [ ] `entrypoint.sh` 是否已添加对应种子文件的执行？
- [ ] 新旧数据库都能跑（初始建库 + 存量升级）？
- [ ] 本地测试 `npx tsx prisma/seed.ts` 通过？

---

## 2026-06-06 SOLO Coder - 终端环境诊断与修复

状态：已完成 | 变更：新增环境隔离规则 + 项目配置 | 产出：`.trae/rules/environment-isolation.md`

**发现**：
- Trae IDE 终端 `shellIntegration.ps1` 被 vim 编辑过（6 个 swap 文件残留），导致 Shell Integration 损坏，终端输出全部空白
- 深挖后确认根因是**全局环境被 7 个 AI/自动化工具污染**（n8n、Claude Code、agent-browser 等）
- PATH 中存在 3 个不同 Node.js、全局 Python 装了 20+ 包、pnpm 版本不一致（全局 10.33 vs 项目 9.15）

**修复**：
- 删除 6 个 vim swap 文件 → 重启 IDE 恢复终端
- 创建 `.trae/rules/environment-isolation.md` 规则
- 项目新增 `.node-version` (22.22.1) + `.npmrc`（环境隔离）

**备注**：以后任何全局安装需过三道审批（规则第 7 节）

### 2026-06-06 追加 — dev-env-setup Skill 创建

- 创建 `.trae/skills/dev-env-setup/SKILL.md` — PC 开发环境初始化与依赖安装规范
- 更新 `project_rules.md` 技能映射表
- 覆盖：Node.js 版本管理、corepack 锁定 pnpm、Python venv、npx 替代全局安装、环境诊断命令
- 产出全局 npm/pip/PATH 污染完整清单（见 `environment-isolation.md` 第 5 节），待用户审查后逐一清理或迁移

---

## 当前状态

**Sprint-009 Sprint 计划已重建（current-sprint.md）✅。任务 ID 冲突已消除。23 个修改文件 + 大量新文件未提交。工厂模式继续推进中。**

### 完成总览（代码尚未提交）

| ID | 任务 | 负责 | 状态 |
|----|------|------|------|
| T-1~T-9 | Phase 1 收银台 + 提醒（全部） | @Frontend+@Backend | ✅ **完成** |
| T-10 | 工厂模式 Phase 1 拍照采集界面 | @Frontend | ✅ **完成** |
| T-11 | 字典管理分组筛选 + 材质重复检测 | @Frontend | ✅ **完成** |
| T-12 | 单品录货表单 | @Frontend | 🔄 **进行中** |
| T-13 | 行情价对接 + 行情源切换 + 本地参考行情 | @Frontend+@Backend | ✅ **完成** |
| T-14 | 数据补全功能 | @Frontend+@Backend | ✅ **完成** |
| T-15 | 贵金属定价改造 + 标签打印 CSV 导出 | @Frontend+@Backend | ✅ **完成** |

### 待推进（工厂模式）

| ID | 任务 | 负责 | 依赖 | 状态 |
|----|------|------|------|:----:|
| T-12 | 单品录货表单完成 | @Frontend | — | 🔄 |
| T-20 | 草稿列表 + 批量设置 | @Frontend | T-10 | ⏳ |
| T-21 | 批次录货 + 连续录入 | @Frontend | T-12 | ⏳ |
| T-22 | 拍照强制校验 + 入口适配 | @Frontend | T-10~T-21 | ⏳ |
| T-23 | 回归验证 | @QA | 全部 | ⏳ |

---

## 最近完成
| 2026-06-07 | BE+FE | **T-PM-01~T-PM-03 性能优化全部完成**：(1) Backend: dashboard.service.ts 5 项优化 — getSummary/addTrend/getTurnover 全表查询加 where 过滤 + getTurnover N+1 修复（`db.item.findMany()` 移出循环）+ 2 处嵌套循环改为 `Array.find()` 短路查找；(2) Frontend: inventory-tab.tsx 4 处批量操作 `Promise.allSettled()` 并行化；(3) 7 处生产 console.log 添加 `NODE_ENV` 保护。`pnpm build` ✅ 89/89，lint 零新增错误 ✅。|
| 2026-06-07 | BE | **S10-03 外部数据请求 inflight 去重**：为 3 个外部请求函数添加统一的 inflight 去重机制。(1) `local-reference-price.service.ts` 提取 `doFetchLocalReference()` 内部函数，外层包装 inflight 去重（cacheKey=`gzjn168:local-reference`）；(2) `market-price.service.ts` 提取 `doFetchFromTanshu()`（cacheKey=`tanshu:market-prices`）和 `doFetchCompetitorGoldPrices()`（cacheKey=`tanshu:competitor-prices`）。所有函数保持原有签名和返回类型不变，`finally` 中清理 inflight 条目。`pnpm build` 编译成功 ✅。|
| 2026-06-05 | 全员 | **技术债务集中清理**：P1 T-9-1 已静默修复 ✅；TD-006 认证已启用 ✅；后端 13 处 + 前端 4 处 any→具体类型（覆盖 11 个文件）；tech-debt.md 更新。any 收敛率：665→~6（99.1%）。lint 零错误 + build 通过 ✅。 |
| 2026-06-05 | FE | **page.tsx any 类型清理**：4 处 `any` 替换为具体类型 — L88/L153 `s: any` → `{ actualPrice?: number }`，L92 `b: any` → `{ itemsCount?: number; quantity?: number }`，L249 `c: any` → `{ key: string; value?: string }`。纯类型注解修改，零逻辑变更。`npx eslint --quiet` 零错误 ✅，`pnpm build` 编译成功 ✅。|
| 2026-06-05 | BE | **后端生产代码 any 类型清理**：13 处 `any` 替换为具体类型，覆盖 9 个文件。(1) `errors.ts` ValidationError 新增 `tagData?` 可选属性；(2) `items.service.ts` 2 处 `(err as any).tagData` → `err.tagData`；(3) `items/route.ts` + `items/[id]/route.ts` 4 处 `(e as any).tagData` → `e.tagData`；(4) `customers.service.ts` L180 `where: any` → `Prisma.CustomerWhereInput`；(5) `user.service.ts` L53 `user: any` → `Prisma.UserGetPayload<{include:{role:true}}>` + L77 `where: any` → `Prisma.UserWhereInput`；(6) `role.service.ts` L30 `role: any` → `Prisma.RoleGetPayload`；(7) `bundle/route.ts` L10 `id: any` → `id: string`；(8) `restock.service.ts` 新增 `RawRestockRec` 接口，2 处 `any[]` → `RawRestockRec[]`；(9) `logs.service.ts` L21 `items: any[]` → `Prisma.OperationLogGetPayload[]`。`pnpm build` 编译成功 ✅，lint 零新增错误 ✅。|
| 2026-06-05 | 元管理 | **创建 `gh-pr-compliance` Skill**：`technical-researcher` 调研 GitHub 提交规范工具链（commitlint/husky/lint-staged/CODEOWNERS/分支命名/CI 质量门禁），`solution-consultant` 评审设计方案（确认命名为 `gh-pr-compliance`，定位三级门禁 Level 1，7 项排查维度），`writing-expert` 生成 SKILL.md（587 行，含代理配置、7 项排查、报告模板、修复指引、SOP 衔接、一键排查脚本）。已注册到 project_rules.md 技能体系表。变更文件：新增 `.trae/skills/gh-pr-compliance/SKILL.md`，修改 `.trae/rules/project_rules.md`（+2行），更新 `.trae/memory/consulting-context.md`（评审记录）。|
| 2026-06-05 | FE | **批量补图入口集成到库存列表**：`src/components/inventory/inventory-tab.tsx` 新增 `import BatchPhotoMode`、`showBatchPhoto` 状态、入口按钮（Camera 图标"批量补图"，`bg-emerald-600` 风格，移动端+桌面端均可见）、条件渲染 `<BatchPhotoMode onClose={...} />`（关闭时自动刷新列表）。纯增量修改，4 处 SearchReplace，未修改现有逻辑。`npx eslint --quiet` 零错误 ✅，`pnpm build` 编译成功 ✅。新增交互路径：库存 Tab → 批量补图按钮 → BatchPhotoMode 全屏组件 → 逐件补拍照片 → 完成/关闭 → 列表自动刷新。|
| 2026-06-05 | FE | **行情源切换 UI**：`src/lib/api.ts` metalApi.getMarketPrices 新增可选 source 参数（'auto' | 'gzjn168' | 'tanshu'），自动拼接 `?source=` 查询参数；`src/components/inventory/settings/settings-metal-panel.tsx` 标题栏按钮组中新增 DropdownMenu 行情源切换下拉按钮（数据库图标，三选项：自动/融通金/探数API），切换后自动刷新行情数据。非 auto 模式下显示行情源来源提示条。`pnpm lint --quiet` + `pnpm build` 通过 ✅。路由路径：设置 Tab → 贵金属市价管理 → 标题栏行情源切换按钮。新增交互路径：DropdownMenu "自动/融通金/探数API" 三选一 → 调用 `GET /api/metal-prices/market?source=xxx` → 自动刷新行情列表。|
| 2026-06-05 | BE | **本地参考行情后端 API（gzjn168.com）**：新建 `src/services/local-reference-price.service.ts`（5分钟内存缓存、10秒fetch超时、纯字符串HTML解析`<tr>`+`<td>`、跳过表头行、容错设计返回`available:false`、`clearLocalReferenceCache()`）；新建 `src/app/api/metal-prices/local-reference/route.ts`（GET端点，withApiLogging包装+AppError处理）。前端已预置 `local-reference-panel.tsx` 组件，只缺后端接口，现已就绪。`pnpm lint --quiet` + `pnpm build` 通过 ✅。|
| 2026-06-05 | FE | **本地参考行情（融通金 gzjn168.com）前端组件完成**：`src/lib/api.types.ts` 新增 `LocalReferencePriceItem` 和 `LocalReferenceResponse` 类型；`src/lib/api.ts` metalApi 新增 `getLocalReference()` 方法；新建 `src/components/inventory/settings/local-reference-panel.tsx`（蓝色左边框卡片，含自动加载/刷新/3种状态处理/商品色标签/等宽字体/脚注）；集成到 `settings-metal-panel.tsx`（贵金属市价管理卡片下方）。`pnpm lint --quiet` + `pnpm build` 通过 ✅。✅ **后端接口现已就绪**。|
| 2026-06-05 | BE | **标签打印 CSV 导出 API**：`src/services/export.service.ts` 新增 `getLabelExportData()` 函数（按货品 ID 数组查询，JOIN material/type/spec，返回 CSV 行列结构，重量从 ItemSpec.weight 提取，条码使用 skuCode）；新建 `src/app/api/export/labels/route.ts` POST 端点（接收 `{ ids: number[] }`，校验非空数组，BOM+UTF-8 CSV 输出，文件名 `labels_YYYY-MM-DD.csv`）。适配德佟 P2 热敏标签打印机「微打」App。更新 `api-contracts.md` 新增接口文档。`pnpm build` 编译成功 ✅。|
| 2026-06-05 | FE | **库存列表新增「导出标签数据」按钮（德佟 P2 微打 App 用）**：`src/lib/api.ts` exportApi 新增 `exportLabels()` 方法（POST /api/export/labels，接收 ids[]，带 auth token，自动触发浏览器 CSV 下载）；`src/components/inventory/inventory/inventory-batch-ops-bar.tsx` 新增 `onBatchLabelExport` 可选 prop 和"导出标签数据"按钮（FileSpreadsheet 图标，紧邻批量标签打印按钮之后）；`src/components/inventory/inventory-tab.tsx` 新增 `handleBatchLabelExport` 处理函数（调用 exportApi.exportLabels + toast 成功/失败提示），并在 InventoryBatchOpsBar 传入 prop。`npx eslint --quiet` 零错误 ✅，`pnpm build` 编译成功 ✅。|
| 2026-06-05 | BE | **贵金属行情价对接后端（T-13 后端部分）**：`prisma/schema.prisma` DictMaterial 新增 `marketRatio` 字段；`prisma/seed.ts` 贵金属材质标准化（8种，含行情码 Au9999/Ag(T+D)/Pt9995 及折算比例）+ SysConfig 新增 `tanshu_api_key`；新建 `src/services/market-price.service.ts` 行情价服务（探数API调用 + 5分钟内存缓存 + Ag(T+D)元/千克→元/克自动转换 + 材质折算参考价）；新建 `src/app/api/metal-prices/market/route.ts` 行情价API；更新 `src/lib/api.types.ts` MarketPriceItem 类型含折算参考价；更新 `src/lib/api.ts` metalApi 已有 `getMarketPrices` 方法。`npx prisma generate` + `db push` 通过 ✅。|
| 2026-06-05 | FE | **贵金属行情价对接 + 贵金属材质锁定（T-13）**：`settings-metal-panel.tsx` 每个材质行增加"获取行情价"按钮（仅 subType 不为空时显示），调用 `GET /api/metal-prices/market` 获取行情价，按 subType 匹配并自动填入输入框，支持 marketRatio 换算。`settings-dicts-panel.tsx` 材质表格中贵金属类显示 Lock 图标、编辑按钮替换为 Lock 并 disabled。`settings-tab.tsx` 编辑材质弹窗中名称和 subType 字段对贵金属材质 disabled。`api.types.ts` 新增 MarketPriceItem 类型、DictMaterial 增加 marketRatio 字段。`api.ts` metalApi 新增 getMarketPrices 方法。`npx eslint --quiet` 零错误 ✅，`pnpm build` 编译成功 ✅。|
| 2026-06-05 | FE | **字典管理分组筛选增强（T-11）**：`settings-dicts-panel.tsx` 材质卡新增大类 Select 筛选（玉/贵金属/水晶/文玩/其他），统计栏和表格使用 `filteredMaterials`；器型卡新增搜索输入框，实时模糊匹配名称；标签卡新增搜索输入框，与材质Select/分组Select AND联动。`settings-tab.tsx` 新增 `materialCategoryFilter`、`typeSearchFilter`、`tagSearchFilter` 三个 useState。所有筛选逻辑纯前端 useMemo，不修改现有 CRUD 逻辑。`npx eslint` 零错误 ✅，`npx next build` 编译成功 ✅。|
| 2026-06-05 | FE | **材质即时重复检测**：`settings-tab.tsx` 新增 `materialNameConflict` useMemo，在材质新增/编辑表单中输入名称和子类时实时检查与已有材质的 (name, subType) 组合是否冲突。冲突时在名称输入框下方显示红色警告"该材质名称+子类已存在"，同时禁用创建/保存按钮。编辑模式排除自身 ID，空名称不触发检测，trim 比较。`npx eslint settings-tab.tsx` 零错误零警告 ✅，`npx next build` 编译成功 ✅。|
| 2026-06-03 | FE | **T-10 工厂模式 Phase 1 拍照采集界面完成**：创建 `src/components/inventory/create/photo-phase.tsx`，全屏深色背景相机取景器。支持连续拍摄（隐藏 input[type=file capture=environment multiple]）、底部横向滚动缩略图预览列表（支持删除）、左右箭头切换大图预览、已拍张数进度展示、"完成拍照，去填信息"按钮回调。第一张自动设为封面，封面显示星标，删除封面时第一张替补。配套添加 `imagesApi` 到 `src/lib/api.ts`（`POST /api/images/upload`）。`pnpm lint --quiet` + `pnpm build` 通过 ✅。路由路径：无独立路由，作为组件被 `<CreateEntry>` 引用。|
| 2026-06-02 | FE | **T-4 Step 3 收款确认组件完成**：创建 `src/components/inventory/checkout/step-payment.tsx`，支持客户信息展示、总价大号显示、修改单项价格（可展开）、快速调整（抹零/打9折/自定义折扣）、5种支付方式大图标按钮网格、备注输入、确认收款（逐件调用 POST /api/sales）、完成页（3秒自动返回）。 |
| 2026-06-02 | FE | **T-3 Step 2 选货品组件完成**：创建 `step-items.tsx` + `inventory-picker.tsx`，集成到 `checkout-mode.tsx`。支持三种添加方式（扫码/库存搜索/手动输入SKU），含防重复校验+状态校验。 |
| 2026-06-02 | BE | **T-2a 最近客户 API 增强完成**：`GET /api/customers?sort=lastPurchaseAt` 按最近购买日期返回前 6 条客户（id/name/phone）。 |
| 2026-06-02 | 元管理 | **Skill 驱动的开发协作流程写入项目规则**：更新 project_rules.md 和 AGENTS.md，加入优先调度智能体、方案团队先行研讨需求+搜寻案例+生成 Skill、开发团队基于 Skill 规范开发、各智能体任务汇报沉淀 Skill 等原则。 |
| 2026-06-02 | 标准 | **二次开发安全标准发布**：`secondary-dev-standards.md` 写入 `.trae/rules/`，包含 Additive First 原则、S1-S5 变更分级、功能开关规范、回滚方案模板。已关联引用于 project_rules.md。 |
| 2026-05-22 | DevOps | **修复 entrypoint.sh schema 同步错误被静默吞掉**：已有数据库场景 `prisma db push` 失败时从 `echo WARN 继续` 改为 `echo ERROR + exit 1`，防止容器带病运行。 | 
| 2026-05-22 | DevOps | **Docker 部署配置完成（T-901）**：Dockerfile（多阶段 + 多架构）、docker-compose.yml、.dockerignore、scripts/docker-build.sh、scripts/docker-deploy.sh。面向极空间 NAS，一键构建部署。 |
| 2026-05-22 | QA | **全量穷举测试全部完成：42/42 ✅。8 篇用户操作手册已产出。** 生产模式运行，7 个 QA-FINDING（全部为测试脚本 BUG）已全部修复，零生产代码缺陷。详见手测报告。 |
| 2026-05-22 | **元管理** | **学习闭环：QA 全量穷举测试规范建立**。详见 `learning-loop-2026-05-22-qa-testing-sop.md` |
| 2026-05-22 | BE | **修复 2 处 `@typescript-eslint/no-empty-object-type`** |
| 2026-05-22 | ALL | **Sprint-008 全部完成**：72 个文件，+1427 / -1003 行已提交。any 类型 84% 收敛率。构建通过 ✅ | E2E 86/86 通过 ✅ |
| 2026-05-20 | QA | **T-409 回归验证完成**：Sprint-007 全部代码已提交 |

---

## 回归验证结果（2026-06-03）

| 测试套件 | 结果 | 通过/总数 | 耗时 |
|---------|:----:|:---------:|:----:|
| **E2E 点击测试** (`tests/e2e-click-test.ts`) | ✅ **全部通过** | 86/86 | 3.8s |
| **Playwright 穷举测试** (`npx playwright test`) | ❌ **部分失败** | 39/71 | 13.1m |

### E2E 点击测试 — 86/86 通过 ✅

覆盖 14 个场景：首页加载、7 个 Tab 数据加载、23 个图表 API、高货入库、编辑货品、销售出库、退货闭环、批次入库、客户管理、贵金属价格、字典管理、套装销售、数据库备份、操作日志。

### Playwright 穷举测试 — 39/71 通过，32/71 失败 ❌

**执行模式**：生产构建（`pnpm build && pnpm start`），`npx playwright test`

**失败原因分析**：

```
根因：sales-tab.tsx:261 configApi.get() 调用方法不存在
  └─ configApi 只有 .getConfig() 方法，没有 .get() 方法
  └─ 默认 Tab 为 'sales'，组件挂载时触发 useEffect -> TypeError
  └─ ErrorBoundary 捕获异常，显示"页面出错了"
  └─ 阻塞所有 UI 测试（32 个测试全部因此失败）
```

| 失败模块 | 失败数 | 原因 |
|---------|:------:|------|
| `playwright-exhaustive.spec.ts` | 23 | configApi.get bug 导致 React 崩溃 |
| `playwright-walkthrough-*.spec.ts` (除 auth) | 8 | configApi.get bug 导致 React 崩溃 |
| `playwright-exhaustive O4 套装至少2件` | 1 | raw fetch() 未传 auth token，收到 401 而非 400 |

**通过的 39 个测试**（含 auth 登录模块全量 3 个测试 ✅）。

### [QA-FINDING]

#### [QA-FINDING:BUG] T-9-1: sales-tab.tsx configApi.get 方法不存在

| 项 | 内容 |
|----|------|
| **文件** | [sales-tab.tsx:L261](file:///d:/02工作/ERP/newjade/src/components/inventory/sales-tab.tsx#L261) |
| **类型** | `[QA-FINDING:BUG]` — 未按开发要求实现 |
| **严重度** | **阻塞级** — 导致 React ErrorBoundary 崩溃，全部 Playwright UI 测试失败 |
| **表现** | 应用加载后默认 Tab 为 'sales'，`useEffect` 中调用 `configApi.get('feature_checkout_enabled')`，但 `configApi` 只有 `.getConfig()` 方法。报错 `i.configApi.get is not a function`，ErrorBoundary 捕获后显示"页面出错了"，后续操作全部失败 |
| **截图** | `test-results/playwright-walkthrough-inventory-*/test-failed-1.png` |
| **修复方案** | L261 将 `configApi.get('feature_checkout_enabled')` 改为 `configApi.getConfig()` 并从中查找 key |
| **流向** | → @Frontend 修复 |

#### [QA-FINDING:BUG] T-9-2: playwright-exhaustive O4 测试缺失 auth token

| 项 | 内容 |
|----|------|
| **文件** | [playwright-exhaustive.spec.ts:L511](file:///d:/02工作/ERP/newjade/tests/playwright-exhaustive.spec.ts#L511) |
| **类型** | `[QA-FINDING:BUG]` — 未更新适配认证系统 |
| **严重度** | **低** — 仅影响此单个测试用例 |
| **表现** | O4 套装至少2件测试使用 raw `fetch()` 未传 auth token，生产模式下返回 401 而非预期的 400 |
| **修复方案** | 测试脚本需先登录获取 token 并传入 `Authorization` header |
| **流向** | → @QA 修复测试脚本 |

---

## Sprint-009 成果

- **any 类型收敛率**：665 处 → 84 处（87.4%），生产代码中仅剩约 60 处
- **错误处理统一**：withApiLogging 覆盖全部 Route Handler（零裸 try/catch）
- **Prisma 类型化**：所有 `where/orderBy/updateData: any` 替换为 Prisma 内置类型
- **前端统一错误**：83 处 `catch(e: any)` 替换为 `handleError`
- **Service 层**：所有 map 回调自动类型推导，导出函数有明确的返回类型

## 技术债务快照（2026-06-05 更新）

| 优先级 | 债务项 | 状态 |
|--------|--------|------|
| P1 | 无 | ✅ 已清理 |
| P2 | 无 | ✅ 已清理 |
| P3 | 生产代码 any 类型：~23→~6 处（catch 块惯用法，4个文件） | ✅ **已收敛** |
| P3 | HMR 初始化错误、barcode HTTPS、Turbopack 缓存 | ⏳ 待处理 |



Phase 2（工厂模式录货）和 Phase 3（补图/打印等）待当前 Sprint 完成后根据情况安排。

---

## 📋 待接手

### @Frontend — 标签打印 CSV 导出功能前端对接

**新 API：`POST /api/export/labels`**
- 调用方：请求体 `{ ids: number[] }`（货品 ID 数组，非空）
- 返回：CSV 文件下载（`text/csv; charset=utf-8`，含 BOM 头）
- CSV 列名：`SKU编码`, `商品名称`, `材质`, `器型`, `重量`, `条码`
- 文件名：`labels_YYYY-MM-DD.csv`
- 用途：生成的 CSV 可导入德佟 P2 热敏标签打印机「微打」App 打印标签
- 典型用法：在库存列表中勾选货品 → 点击"打印标签" → 前端调用此 API → 触发浏览器文件下载

### @Frontend — 贵金属行情价对接 + 数据库变更注意事项

**新 API：`GET /api/metal-prices/market`**
- 调用方：`metalApi.getMarketPrices()` 返回 `MarketPriceItem[]`
- 功能：从探数API获取行情价（Au9999/Ag(T+D)/Pt9995），自动匹配材质并计算折算参考价
- 返回值现含 `materialId`, `materialName`, `marketRatio`, `refPrice`（参考价 = 行情价 × marketRatio）
- 前置条件：在系统设置中填写 `tanshu_api_key`（SysConfig）
- 未配置 API Key 时返回 400 错误
- 5 分钟内存缓存，重复调用不会频繁请求外部API

**数据库变更**：`npx prisma generate && npx prisma db push` 必须执行
- `DictMaterial` 新增 `marketRatio`（Float?）字段
- `DictMaterial.subType` 现用于存行情码（Au9999/Ag(T+D)/Pt9995）

**Seed 数据变更**：贵金属材质已标准化
- 旧 `黄金`(k999) → `黄金999足金`(Au9999, ratio=1.0)
- 旧 `银`(990) → `足银990`(Ag(T+D), ratio=0.99)
- 旧 `铂金` → `铂金999`(Pt9995, ratio=1.0)
- `18K金` → 新增 subType=Au9999, marketRatio=0.75
- 新增：`玫瑰金`(Au9999, 0.75), `K白金`(Au9999, 0.75), `925银`(Ag(T+D), 0.925)
- 注意：已有 `items` 引用的材质 ID 不会变，但材质名称已更新

### @Frontend — Sprint-009 后端新 API 对接说明（历史）

已完成的 3 个后端任务可供前端对接：

**1. T-2a 最近客户 API** (`GET /api/customers?sort=lastPurchaseAt`)
- 返回 `{ items: [{ id, name, phone }], pagination }`，按最近购买日期排序取前 6 条
- 用于收银台 Step 1"最近客户"快速选择

**2. T-7 照片上传 API**
- `POST /api/images/upload` — FormData `{ file, itemId? }`，返回 `{ id, url, thumbnailUrl: null }`
- `DELETE /api/images/{filename}?imageId=N` — 按 DB 记录 ID 删除图片（imageId 查询参数）
- 文件访问路径 `/api/images/{uuid}.ext`

**3. T-8a 新增通知类型**（供 T-8b 前端元数据对接）
- `no_photo` — `{ count, skus, description }`
- `price_anomaly` — `{ count, skus, description }`
- 查询示例：`GET /api/notifications?type=no_photo`

---

## 2026-06-07 前端工程师 — T-PM-02 + T-PM-03 性能优化

### T-PM-02：inventory-tab.tsx 批量操作并行化

将 4 处串行 for 循环改为 `Promise.allSettled()` 并行执行：

| 函数 | 位置 | 说明 |
|------|------|------|
| `handleBatchRestore` | L464-478 | 批量恢复库存到在库状态 |
| `handleBatchSell` | L615-640 | 批量出库创建销售记录 |
| `handleBatchDelete` | L655-681 | 批量删除（标记/彻底） |
| `handleBatchCounter` | L725-756 | 批量修改柜台号 |

**变更模式**：每个函数中 `let successCount/failCount + for 循环 + try/catch` → `Promise.allSettled() + filter`，`batchProgress` 保持非空，进度一次性设置为 total。
**文件**：[inventory-tab.tsx](file:///d:/02工作/ERP/newjade/src/components/inventory/inventory-tab.tsx)

### T-PM-03：生产代码 console.log 清理

3 个文件共 7 处调试日志添加 `if (process.env.NODE_ENV !== 'production')` 保护：

| 文件 | 行号 | 日志内容 |
|------|------|---------|
| [inventory-tab.tsx](file:///d:/02工作/ERP/newjade/src/components/inventory/inventory-tab.tsx) | L326, L344, L354 | `[InventoryTab] loadData` START/OK/FINALLY |
| [sales-tab.tsx](file:///d:/02工作/ERP/newjade/src/components/inventory/sales-tab.tsx) | L151, L162, L167 | `[SalesTab] loadData` START/OK/FINALLY |
| [restock-tab.tsx](file:///d:/02工作/ERP/newjade/src/components/inventory/restock-tab.tsx) | L423 | `季节性因子:` |

**保留的日志**：`src/lib/api/with-api-logging.ts` L16 的 API 请求日志（有实际运维用途）
**验证结果**：`pnpm lint --quiet` 零新增错误，`pnpm build` 编译通过（89 个页面）
