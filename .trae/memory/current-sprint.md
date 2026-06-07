# Sprint-010：系统设置 + 贵金属模块质量加固

**Sprint 周期**：2026-06-06 起 | **状态**：审计完成，待执行修复

---

## 审计结论（前置工作已完成）

### 审计范围
- `src/components/inventory/settings/` 下 12 个组件
- `src/app/api/metal-prices/` 下 9 个 API 路由
- `@/hooks/`、`@/lib/`、`@/services/` 等所有外部依赖

### 审计结果
| 检查项 | 结论 |
|-------|:----:|
| 所有 import 路径是否有效 | ✅ 全部有效，无断裂依赖 |
| hooks 是否有定义未用 | ✅ 全部正常使用 |
| useCallback/useEffect 依赖数组 | ✅ 无无限循环风险 |
| API 路由 import 是否完整 | ✅ 全部正常 |
| services 层导出是否匹配 | ✅ 全部匹配 |

### 需要修复的问题

| 问题 | 位置 | 类型 | 影响 |
|------|------|:----:|:----:|
| `useCallback(handleExportImage, [handleError])` handleError 每渲染重建 → useCallback 无效 | `competitor-compare-dialog.tsx:213` | ✅ 代码味道 | 极小（仅多了次重渲染） |
| 之前遗漏的 useErrorHandler 调用残留已修复 | `local-reference-panel.tsx` | ✅ 已修 | 之前导致生产环境崩溃 |
| `.gitignore` 中 `local-*` 过宽已修复 | `.gitignore:48` | ✅ 已修 | 路由此前被忽略 |
| 外部请求缺去重机制 | 全量（P0 规范） | 架构规范 | 详见下方 task |

---

## 任务拆解

### 总原则
1. 所有代码提交前必须过 **lint + build + 组件级测试**
2. 部署前必须过 **E2E 全量回归**
3. 不允许未经 @QA 验证就部署到生产环境

### 任务清单（按执行顺序）

| 任务ID | 任务名称 | 等级 | 负责人 | 依赖 | 预估 | 状态 |
|--------|---------|:----:|:------:|:----:|:----:|:----:|
| **Round 1：已知问题修复并行开工** | | | | | | |
| S10-01 | `competitor-compare-dialog` useCallback 依赖优化 | S1 | @Frontend | — | 0.5h | ⏳ 待启动 |
| S10-02 | 贵金属模块组件 props/类型正确性自检 + 注释更新 | S1 | @Frontend | — | 1h | ⏳ 待启动 |
| S10-03 | 外部请求去重机制（inflight 合并，按 `external-data-request-standard.md` P0 规范） | S2 | @Backend | — | 2h | ⏳ 待启动 |
| **Round 2：测试覆盖（Round 1 完成后）** | | | | | | |
| S10-04 | 编写金属价格 API 与服务层单元测试（Vitest） | S1 | @QA | S10-01~S10-03 | 2h | ⏳ 等待 |
| S10-05 | 贵金属前端组件单元测试（各状态：loading/error/empty/normal） | S1 | @QA | S10-01~S10-03 | 2h | ⏳ 等待 |
| **Round 3：全量回归（Round 2 完成后）** | | | | | | |
| S10-06 | E2E 全量回归测试（86+ 断言全部通过，对比 main 不得减少） | — | @QA | S10-04~S10-05 | 2h | ⏳ 等待 |
| S10-07 | 生产环境部署验证（熔断：E2E 失败 → 不部署） | — | @Frontend+@DevOps | S10-06 | 0.5h | ⏳ 等待 |
| **Round 4：文档收尾** | | | | | | |
| S10-08 | 更新 handover.md / tech-debt.md，沉淀经验 | — | @Writing | S10-07 | 0.5h | ⏳ 等待 |
| **Round 5：性能优化（并行开工）** | | | | | | |
| T-PM-01 | dashboard.service.ts 性能优化（N+1 + 嵌套循环 + 全表查询） | P0 | @Backend | — | 1.5h | ✅ 已完成 |
| T-PM-02 | inventory-tab.tsx 批量操作串行→Promise.allSettled | P0 | @Frontend | — | 1h | ✅ 已完成 |
| T-PM-03 | 生产代码 console.log 清理/保护 | P2 | @Frontend+@Backend | — | 0.5h | ✅ 已完成 |
| **Round 6：验证（Round 5 完成后）** | | | | | | |
| T-PM-04 | Build + Lint 验证 | — | @QA | T-PM-01~T-PM-03 | 0.3h | ⏳ 等待 |
| T-PM-05 | E2E 全量回归测试（86+ 断言全部通过） | — | @QA | T-PM-04 | 2h | ⏳ 等待 |
| **Round 7：提交（Round 6 完成后）** | | | | | | |
| T-PM-06 | 展示改动 + 用户确认后提交代码 | — | @SOLO | T-PM-05 | 0.3h | ⏳ 等待 |

---

## 任务详细信息

### S10-01：competitor-compare-dialog useCallback 优化

**负责人**：@Frontend
**类型**：优化
**文件**：`src/components/inventory/settings/competitor-compare-dialog.tsx`
**修改**：第 213 行 `useCallback(handleExportImage, [handleError])` → `useCallback(handleExportImage, [])`
**原因**：`handleError` 来自 `useErrorHandler()`，每次渲染都是新引用，`useCallback` 不产生实际缓存效果。而 `handleExportImage` 仅在点击导出按钮时调用，不需要跟随错误处理器更新。
**验证**：`pnpm lint --quiet` 通过 + 组件加载/导出功能正常

### S10-02：组件自检

**负责人**：@Frontend
**任务**：
1. 验证每个 settings 组件的 props 接口定义正确
2. 检查组件的 loading/error/empty/normal 四种状态都有对应的 UI
3. 更新注释、清理未使用的变量
**涉及文件**：
- `src/components/inventory/settings/settings-metal-panel.tsx`
- `src/components/inventory/settings/local-reference-panel.tsx`
- `src/components/inventory/settings/competitor-compare-dialog.tsx`
- `src/components/inventory/settings/settings-weight-pricing-panel.tsx`

### S10-03：外部请求去重（P0）

**负责人**：@Backend
**依据**：`external-data-request-standard.md` §2.2 请求去重规范
**改动**：
1. 在 `src/services/local-reference-price.service.ts` 和 `src/services/market-price.service.ts` 中添加 inflight 请求去重
2. 相同 cacheKey 的请求在飞行中时，后续请求复用同一个 Promise
3. 请求完成后从 inflight 表中移除
**说明**：当前已有缓存(5min) + 失败冷却(30s)，但缺少请求飞行中的去重。当组件挂载时多次调用同一接口，仍会发出重复请求。

### S10-04 ~ S10-05：单元测试

**负责人**：@QA
**依据**：`project_rules.md` §测试门禁
**要求**：
1. 使用 Vitest + 项目现有测试配置
2. 测试贵金属服务层函数的边界情况：
   - 外部 API 返回有效数据
   - 外部 API 返回空数据
   - 外部 API 超时
   - 缓存命中/未命中
3. 测试前端组件的状态渲染：
   - loading 态 → 显示加载指示器
   - error 态 → 显示错误信息和重试按钮
   - empty 态 → 显示空状态提示
   - normal 态 → 正确渲染价格数据
**测试文件目录**：`src/__tests__/`（服务层）和 `src/__tests__/unit/components/`（组件层）

### S10-06：E2E 全量回归

**负责人**：@QA
**命令**：
```
pnpm build && npx tsx tests/e2e-click-test.ts
```
**门禁**：全部断言通过数 ≥ main 分支通过数，否则阻塞部署

### S10-07：部署

**负责人**：@Frontend + @DevOps
**流程**：
1. 合并 PR 到 main → GitHub Actions 构建 Docker 镜像
2. 等待 CI 通过（Status: Success）
3. 通知用户在 NAS 上执行 `docker compose pull && docker compose up -d`
4. 验证：访问生产环境 `/api/health` + 贵金属面板正常展示

### S10-08：文档

**负责人**：@Writing
**产出**：
1. 更新 `handover.md` 记录本次 Sprint 完成情况
2. 如有可复用经验 → 更新 `tech-debt.md`

---

## Round 5 任务详情（性能优化）

### T-PM-01：dashboard.service.ts 性能优化

**负责人**：@Backend
**类型**：性能优化
**涉及文件**：`src/services/dashboard.service.ts`
**修改清单**：
1. **N+1 查询修复**（L420-454 `getTurnoverRate()`）— 循环月份查 DB，改为一次性查询全部月份范围的数据，JS 侧按月过滤
2. **嵌套循环优化**（L1061-1068 `getSellingPriceDistribution()`）— O(n×7) 改为二分查找或 switch-case
3. **嵌套循环优化**（L1099-1106 `getCostPriceDistribution()`）— 同上
4. **全表查询加 where**（L350 `allSales`、L381 `allSales`、L416 `allSales`、L663 `allSales`）— 用 Prisma where 做 DB 端过滤
**验证**：`pnpm build` 编译成功 ✅
**约束**：不改函数签名，不改 API 返回格式，纯内部实现优化

### T-PM-02：inventory-tab.tsx 批量操作并行化

**负责人**：@Frontend
**类型**：性能优化
**涉及文件**：`src/components/inventory/inventory-tab.tsx`
**修改清单**：
1. L469-472 批量恢复库存：`for` 串行 → `Promise.allSettled()` 并行，进度用分批更新
2. L621-624 批量减少库存：同上
3. L660-663 批量删除：同上
4. L735-738 批量打印标签：同上
**验证**：`pnpm lint --quiet` + `pnpm build` 通过 ✅
**约束**：保持 toast 提示和进度条功能不变

### T-PM-03：生产代码 console.log 清理

**负责人**：@Frontend + @Backend
**类型**：清理
**涉及文件**：
- `src/components/inventory/inventory-tab.tsx` L326,344,354（前端）
- `src/components/inventory/sales-tab.tsx` L151,162,167（前端）
- `src/components/inventory/restock-tab.tsx` L423（前端）
- `src/services/import.service.ts` L129,158（后端）
- `src/lib/api/with-api-logging.ts` L16（保留，API 日志有用途）
**修改**：调试日志改用 `runtime-logger.ts` 或添加 `if (process.env.NODE_ENV !== 'production')` 保护
**验证**：`pnpm lint --quiet` + `pnpm build` 通过 ✅

---

## 执行顺序图

```
Round 1（并行）
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  S10-01       │  │  S10-02       │  │  S10-03       │
│  @Frontend    │  │  @Frontend    │  │  @Backend     │
│  0.5h         │  │  1h           │  │  2h           │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        └─────────┬────────┘                  │
                  ↓                           ↓
        Round 2（并行）
        ┌───────────────┐  ┌───────────────┐
        │  S10-04       │  │  S10-05       │
        │  @QA          │  │  @QA          │
        │  2h           │  │  2h           │
        └───────┬───────┘  └───────┬───────┘
                └────────┬────────┘
                         ↓
              Round 3（串行）
        ┌───────────────┐  ┌───────────────┐
        │  S10-06       │  │  S10-07       │
        │  @QA          │→ │  @DevOps      │
        │  2h           │  │  0.5h         │
        └───────────────┘  └───────┬───────┘
                                   ↓
                          Round 4
        ┌───────────────┐
        │  S10-08       │
        │  @Writing     │
        │  0.5h         │
        └───────────────┘
```

---

## 部署门禁清单

每次部署前逐项确认：

- [ ] `pnpm lint --quiet` — 零新增 error/warning
- [ ] `pnpm build` — 编译成功
- [ ] 单元测试 — 全部通过
- [ ] E2E 测试 — 全部断言通过，不少于 main 分支
- [ ] 组件验收 — 贵金属面板 loading/error/empty/normal 四种状态验证
- [ ] API 验收 — `/api/metal-prices/market?source=gzjn168` 返回有效数据
- [ ] 生产验证 — `docker compose up -d` 后 `/api/health` 返回 200
- [ ] 回滚方案 — 确认可以通过 `docker compose down && docker compose up -d` 快速回退

---

## 功能开关

| 开关 Key | 默认值 | 用途 |
|----------|:------:|------|
| `feature_checkout_enabled` | `false` | 控制收银台模式显隐（已有，与本 Sprint 无关） |
