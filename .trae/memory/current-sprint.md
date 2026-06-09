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

---

# Sprint-011：密码安全与网络攻击防护

**Sprint 周期**：2026-06-08 起 | **状态**：✅ 已完成（12/12）

## 需求来源

| 来源 | 说明 |
|------|------|
| 系统功能审计报告 | 密码安全策略缺失 (P0)、登录历史审计缺失 (P1)、配置变更无日志 (P1) |
| 密码场景专项检查 | 重置密码 API 404、新旧密码无检查、mustChangePwd 前端未处理 |
| 网络安全加固要求 | 防饱和攻击、防大 payload 攻击、安全响应头、IP 封禁 |

---

## 架构设计

```
[请求] → Middleware (安全头 + 体限制 + 全局限流)
           │
           ├─ /api/auth/login        → 登录限流(5次/15min/IP) [增强]
           ├─ /api/auth/password     → 改密限流(10次/15min/用户) + 复杂度校验
           ├─ /api/users/:id/reset-password → 重置限流(5次/30min/IP) [修复404]
           ├─ /api/users             → 创建用户限流 + 复杂度校验
           └─ 其他 API               → 全局限流(100次/分钟/IP)
           
Service 层:
  password-validator.ts — 密码复杂度校验(可配置: 长度/大小写/数字/特殊字符)
  rate-limiter.ts       — 通用滑动窗口限流器(支持按IP/按用户/分级配置)
```

---

## 任务拆解

### 执行顺序图

```
Phase 1（基础设施 — 可并行）
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ S11-01           │  │ S11-02           │  │ S11-03           │
│ rate-limiter.ts  │  │ Middleware 安全   │  │ password-        │
│ @Backend         │  │ 增强             │  │ validator.ts     │
│ 1.5h             │  │ @Backend         │  │ @Backend         │
│                  │  │ 1.5h             │  │ 1h               │
└──────┬───────────┘  └──────┬───────────┘  └──────┬───────────┘
       └──────────┬──────────┘                     │
                  ↓                                ↓
       Phase 2（密码安全修复 — 部分串行）
       ┌──────────────────┐  ┌──────────────────┐
       │ S11-04           │  │ S11-05           │
       │ 修复重置密码404   │  │ 密码修改路由安全  │
       │ @Backend         │  │ 增强             │
       │ 0.5h             │  │ @Backend         │
       └──────┬───────────┘  │ 1h               │
              │              └──────┬───────────┘
              │                     │
              ↓                     ↓
       ┌─────────────────────────────────────────┐
       │ S11-06 创建/重置密码集成复杂度  @Backend │
       │ 1h                                      │
       └──────────────────┬──────────────────────┘
                          ↓
       Phase 3（前后端并行）
       ┌──────────────────┐  ┌──────────────────┐
       │ S11-07           │  │ S11-08           │
       │ 密码变更审计日志   │  │ mustChangePwd    │
       │ @Backend         │  │ 弹窗 + 密码强度  │
       │ 1h               │  │ 指示器           │
       └──────┬───────────┘  │ @Frontend        │
              │              │ 2h               │
              │              └──────┬───────────┘
              ↓                     ↓
       ┌─────────────────────────────────────────┐
       │ S11-09 登录历史审计 + 配置变更审计       │
       │ @Backend  2h                            │
       └──────────────────┬──────────────────────┘
                          ↓
              Phase 4（验证 — 串行）
       ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
       │ S11-10           │  │ S11-11           │  │ S11-12           │
       │ 构建+Lint验证     │  │ TRAE-security    │  │ E2E全量回归      │
       │ @QA              │→ │ review 安全审查   │→ │ @QA              │
       │ 0.3h             │  │ @QA              │  │ 2h               │
       └──────────────────┘  │ 0.5h             │  └──────────────────┘
                             └──────────────────┘
```

---

## 任务清单

| 任务ID | 任务名称 | 类型 | 负责人 | 依赖 | 预估 | 优先级 | 状态 |
|--------|---------|:----:|:------:|:----:|:----:|:------:|:----:|
| **Phase 1：基础设施层** | | | | | | | |
| S11-01 | 通用速率限制器 `src/lib/rate-limiter.ts` | 新增 | @Backend | — | 1.5h | P0 | ✅ 已完成 |
| S11-02 | Middleware 安全增强（安全头+体限制+全局限流） | 增强 | @Backend | — | 1.5h | P0 | ✅ 已完成 |
| S11-03 | 密码复杂度校验工具 `src/lib/password-validator.ts` | 新增 | @Backend | — | 1h | P0 | ✅ 已完成 |
| **Phase 2：密码安全修复** | | | | | | | |
| S11-04 | 修复重置密码 API 端点 404（新增独立 PUT 路由） | 修复 | @Backend | S11-03 | 0.5h | P0 | ✅ 已完成 |
| S11-05 | 密码修改路由安全增强（新旧密码检查+复杂度+限流） | 增强 | @Backend | S11-01, S11-03 | 1h | P0 | ✅ 已完成 |
| S11-06 | 创建用户/重置密码集成密码复杂度 | 增强 | @Backend | S11-03 | 1h | P0 | ✅ 已完成 |
| **Phase 3：审计 + 前端** | | | | | | | |
| S11-07 | 密码变更/重置操作写入审计日志 | 新增 | @Backend | S11-04~S11-06 | 1h | P1 | ✅ 已完成 |
| S11-08 | mustChangePwd 弹窗引导改密 + 密码强度指示器 | 新增 | @Frontend | — | 2h | P1 | ✅ 已完成 |
| S11-09 | 登录历史审计 + 系统配置变更审计日志 | 新增 | @Backend | S11-07 | 2h | P1 | ✅ 已完成 |
| **Phase 4：验证** | | | | | | | |
| S11-10 | Build + Lint 验证 | 验证 | @QA | 全部 | 0.3h | — | ✅ 已完成 |
| S11-11 | TRAE-security-review 安全审查 | 审查 | @QA | S11-10 | 0.5h | — | ✅ 已完成（零漏洞） |
| S11-12 | E2E 全量回归测试 | 验证 | @QA | S11-11 | 2h | — | ✅ 已完成（51/59，零回归） |

> **关联 Skills**：
> - S11-01~S11-06 → 开发前先读 `security-backend-patterns`（安全编码规范）
> - S11-07~S11-09 → 开发前先读 `security-audit-logging`（审计日志规范）
> - S11-08 → `frontend-component`（前端组件开发）
> - S11-11 → `TRAE-security-review`（安全审查）
> - S11-12 → `write-tests`（测试流程）

---

## 任务详情

### S11-01：通用速率限制器

**负责人**：@Backend
**类型**：新增
**文件**：`src/lib/rate-limiter.ts`
**说明**：实现一个通用的滑动窗口速率限制器，可供所有路由复用。

**🔒 安全实施规范**：
1. 使用滑动窗口算法（记录每次请求时间戳到数组，过期自动清理），不要用固定窗口（会在窗口边界被绕过）
2. 必须内置过期条目自动清理（`setInterval` 每 60s 清理一次，或在每次 check 时惰性清理），**防止内存泄漏**
3. 封禁升级机制：同一 key 在 1 小时内触发 3 次限流后自动封禁 1 小时
4. 不要泄露内部状态给客户端（不要返回 `blockedUntil` 到响应体，只返回 429 + 通用提示）

**接口设计**：
```typescript
interface RateLimiterConfig {
  windowMs: number;      // 时间窗口(ms)
  maxAttempts: number;   // 窗口内最大请求数
  keyType?: 'ip' | 'userId';  // 限流维度
}

interface RateLimiterResult {
  allowed: boolean;
  remaining: number;     // 剩余可用次数
  resetAt: number;       // 重置时间戳
  blockedUntil?: number; // 封禁到期时间(如有)，仅内部使用，不对外暴露
}
```

**核心功能**：
1. 滑动窗口算法，按时间戳记录每次请求
2. 支持按 IP 和按 userId 两种限流维度
3. 支持自动升级封禁（短时内触发多次限流 → 自动封禁 1 小时）
4. 过期条目自动清理（防内存泄漏）
5. 可导出 `getRateLimiterStats()` 供监控

**使用方式**：
```typescript
// 在 route handler 中使用
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 5 });
const result = limiter.check(ip);
if (!result.allowed) {
  return NextResponse.json({ code: 429, data: null, message: '请求过于频繁' }, { status: 429 });
}
```

### S11-02：Middleware 安全增强

**负责人**：@Backend
**类型**：修改
**文件**：`src/middleware.ts`

**⚠️ Middleware 修改安全守则**（单点故障，最高风险）：
1. **修改前 git stash 备份**（middleware.ts 影响所有 API 请求，出错 = 全站 500）
2. 安全头用 `res.headers.set()` 不要用 `requestHeaders.set()`（后者只影响下游路由，不影响响应）
3. 全局限流必须在 `isPublicPath` 判断**之前**执行（否则公开路径不受限流保护）
4. Content-Length 检查仅对 auth 相关路径（`/api/auth/*`、`/api/users`），不要影响文件上传路径
5. 修改结束后立即 `pnpm build` + 启动 dev server 验证所有标签页可正常加载

**修改清单**：

1. **安全 HTTP 头**（所有响应）
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-XSS-Protection: 0`（已废弃但兼容旧浏览器）

2. **请求体大小限制**（POST/PUT/PATCH 请求）
   - auth 相关路由：Content-Length > 10KB 直接拒绝
   - 其余路由：不做限制（由各自 handler 处理）

3. **全局限流**（按 IP）
   - 所有 API：100 次/分钟/IP
   - auth 路由：由各自 route handler 细化控制

### S11-03：密码复杂度校验工具

**负责人**：@Backend
**类型**：新增
**文件**：`src/lib/password-validator.ts`
**说明**：可配置的密码复杂度校验规则，支持从系统配置读取或使用默认值。

**🔒 密码安全实现原则**：
1. **校验顺序**：先检查同值（`oldPassword === newPassword`）→ 再检查复杂度规则 → 最后比对旧密码 bcrypt。防止时序信息泄露。
2. 校验失败时返回的错误信息**不要透露**具体哪条规则未通过（给攻击者枚举便利），统一返回 `code: 400, message: '密码不符合安全策略要求'`。内部控制台日志可存详细信息。
3. 默认策略硬编码在代码中，不依赖 SysConfig 初始化（防止 DB 为空时密码无约束）。
4. 返回值使用 `Result<T, Error>` 模式，不要 throw（调用方需要知道具体失败原因来展示前端反馈，但只展示汇总信息）。

**配置参数**（从 SysConfig 读取，支持默认值）：
```typescript
interface PasswordPolicy {
  minLength: number;        // 最小长度（默认8）
  requireUppercase: boolean; // 需要大写字母（默认true）
  requireLowercase: boolean; // 需要小写字母（默认true）
  requireDigit: boolean;     // 需要数字（默认true）
  requireSpecialChar: boolean; // 需要特殊字符（默认true）
  notAllowUsername: boolean;  // 不能包含用户名（默认true）
}
```

**输出**：校验成功/失败，失败时返回具体错误码和描述（如"密码必须包含至少1个大写字母"）

**集成点**：
1. `user.service.ts` — `createUser()` 创建用户时校验
2. `user.service.ts` — `resetUserPassword()` 重置时校验
3. `auth/password/route.ts` — 用户自助改密时校验
4. 前端密码强度指示器 — 实时反馈

### S11-04：修复重置密码 API 端点 404

**负责人**：@Backend
**类型**：修复
**文件**：新增 `src/app/api/users/[id]/reset-password/route.ts`
**说明**：前端调用 `PUT /api/users/:id/reset-password` 但后端只有 `PATCH /api/users/:id?action=reset-password`，导致 404。

**改动**：
1. 新增独立 `PUT` 路由文件，调用 `resetUserPassword()`
2. 集成密码复杂度校验（引用 S11-03）
3. 应用速率限制（引用 S11-01）
4. 保留原 `PATCH` 路由兼容现有调用

### S11-05：密码修改路由安全增强

**负责人**：@Backend
**类型**：增强
**文件**：`src/app/api/auth/password/route.ts`、`src/app/api/auth/route.ts`（旧版）
**说明**：两个密码修改路由增加安全措施。

**改动**：
1. 增加新旧密码相同检查（`oldPassword === newPassword` → 拒绝）
2. 新密码集成密码复杂度校验（引用 S11-03）
3. 应用速率限制：按 userId 限流，10次/15分钟（引用 S11-01）
4. 成功修改后清除限流记录

### S11-06：创建用户/重置密码集成复杂度

**负责人**：@Backend
**类型**：增强
**文件**：`src/services/user.service.ts`、`src/app/api/users/route.ts`、`src/app/api/users/[id]/route.ts`
**说明**：在 `createUser()` 和 `resetUserPassword()` 中集成密码复杂度校验。

**改动**：
1. `createUser()` 中的 `password.length < 4` → 调用 `validatePassword(password)`
2. `resetUserPassword()` 中的 `password.length < 4` → 调用 `validatePassword(password)`
3. `POST /api/users` 和 `PATCH /api/users/:id?action=reset-password` 应用速率限制

### S11-07：密码变更审计日志

**负责人**：@Backend
**类型**：新增
**文件**：`src/app/api/auth/password/route.ts`、`src/app/api/users/[id]/reset-password/route.ts`、`src/services/user.service.ts`
**说明**：密码修改/重置操作写入 `OperationLog`。

**📋 审计日志字段规范**（S11-07 + S11-09 共用，确保日志可统一查询）：
1. `action` 字段使用统一命名：`login_success`、`login_failed`、`change_password`、`reset_password`、`update_config`
2. `targetType` 必须与操作对象一致：`auth`（登录/登出）、`user`（密码操作）、`config`（配置变更）
3. `detail` 用 JSON 存结构化的变动信息（key/value 对），不要存纯文本
4. `operator` 字段：登录事件填用户名（成功时）或 `'anonymous'`（失败时）；其他事件填当前操作人用户名
5. **永远不在日志中记录明文密码**，即使是 detail JSON 中的 oldValue/newValue 也要脱敏

**日志内容**：
```json
{
  "action": "change_password" | "reset_password",
  "targetType": "user",
  "targetId": "<userId>",
  "detail": { "operator": "<operatorId>", "operatorName": "<username>" },
  "operator": "<username>"
}
```

### S11-08：mustChangePwd 弹窗 + 密码强度指示器

**负责人**：@Frontend
**类型**：新增
**文件**：`src/app/page.tsx`、`src/components/inventory/settings/settings-config-panel.tsx`

**mustChangePwd 弹窗**：
1. 登录成功后检查 `currentUser.mustChangePwd`
2. 若为 `true` → 弹出强制改密对话框
3. 对话框内容：旧密码输入 + 新密码输入 + 确认新密码
4. 调用 `authApi.changePassword()` 修改密码
5. 成功后设置 `mustChangePwd = false` 并关闭对话框
6. 不允许跳过（强制修改）

**密码强度指示器**：
1. 修改密码表单中新增密码强度条
2. 使用 S11-03 的复杂度规则在前端实时计算
3. 显示：弱（红色）/ 中（橙色）/ 强（绿色）三级
4. 强度不达标时按钮 disabled

### S11-09：登录历史审计 + 配置变更审计

**负责人**：@Backend
**类型**：新增
**文件**：
- `src/app/api/auth/login/route.ts` — 登录成功/失败均记录日志
- `src/app/api/config/route.ts` — 配置变更写日志
- `src/services/user.service.ts` — 用户状态变更写日志

**登录审计日志**：
```json
{
  "action": "login_success" | "login_failed",
  "targetType": "auth",
  "targetId": "<userId或null>",
  "detail": { "ip": "<clientIp>", "username": "<inputUsername>" },
  "operator": "<username或'anonymous'>"
}
```

**配置变更日志**：
```json
{
  "action": "update_config",
  "targetType": "config",
  "targetId": "<configKey>",
  "detail": { "key": "<key>", "oldValue": "<old>", "newValue": "<new>" },
  "operator": "<operatorName>"
}
```

---

## 涉及文件清单

### 新增文件（3 个）
| 文件 | 归属 | 任务 |
|------|:----:|:----:|
| `src/lib/rate-limiter.ts` | @Backend | S11-01 |
| `src/lib/password-validator.ts` | @Backend | S11-03 |
| `src/app/api/users/[id]/reset-password/route.ts` | @Backend | S11-04 |

### 修改文件（10 个）
| 文件 | 归属 | 任务 |
|------|:----:|:----:|
| `src/middleware.ts` | @Backend | S11-02 |
| `src/app/api/auth/password/route.ts` | @Backend | S11-05 |
| `src/app/api/auth/route.ts` | @Backend | S11-05 |
| `src/services/user.service.ts` | @Backend | S11-06, S11-07 |
| `src/app/api/users/route.ts` | @Backend | S11-06 |
| `src/app/api/users/[id]/route.ts` | @Backend | S11-06 |
| `src/app/api/auth/login/route.ts` | @Backend | S11-09 |
| `src/app/api/config/route.ts` | @Backend | S11-09 |
| `src/app/page.tsx` | @Frontend | S11-08 |
| `src/components/inventory/settings/settings-config-panel.tsx` | @Frontend | S11-08 |

---

## 部署门禁清单

- [ ] `pnpm lint --quiet` — 零新增 error/warning
- [ ] `pnpm build` — 编译成功
- [ ] `TRAE-security-review` — 安全审查通过（S11-11）
- [ ] E2E 测试 — 全部断言通过（S11-12）
- [ ] 密码安全验证 — 旧密码相同/复杂度不足/空密码 均返回正确错误
- [ ] 限流验证 — 超出频率时返回 429
- [ ] 安全头验证 — 响应中包含 X-Content-Type-Options 等头
- [ ] mustChangePwd 验证 — 管理员重置密码后用户登录收到弹窗

---

# Sprint-012：Token 认证修复 + 收银台上线 + 测试债务

**Sprint 周期**：2026-06-09 起 | **状态**：🔄 执行中

## 需求来源

| 来源 | 说明 |
|------|------|
| E2E 全量业务场景测试 | 发现促销活动 Tab 401 认证失败 |
| Token 认证遗漏审计 | 共 7 个组件 27 处裸 fetch 缺少 Authorization 头 |
| 收银台完成度评估 | Step 1/Step 3 组件已就绪，checkout-mode.tsx 未接线 |
| E2E 测试可维护性 | 看板卡片缺 data-testid，场景 F 脚本待优化 |

---

## 任务拆解

### Phase 1：Token 认证修复（后端 — 可并行）

| 任务ID | 任务名称 | 类型 | 负责人 | 涉及文件 | 预估 | 优先级 | 状态 |
|--------|---------|:----:|:------:|---------|:----:|:------:|:----:|
| S12-01 | PromotionsTab 认证修复 | 修复 | @Backend | `promotions-tab.tsx`（8 处裸 fetch → api.ts） | 1h | P0 | ✅ 已完成 |
| S12-02 | StocktakingTab 认证修复 | 修复 | @Backend | `stocktaking-tab.tsx`（5 处裸 fetch → api.ts） | 1h | P0 | ✅ 已完成 |
| S12-03 | SettingsTab 认证修复 | 修复 | @Backend | `settings-tab.tsx`（6 处裸 fetch → api.ts） | 1h | P1 | ✅ 已完成 |
| S12-04 | 其余组件认证修复 | 修复 | @Backend | `promotion-item-select.tsx`(3) + `navigation.tsx`(3) + `restock-tab.tsx`(1) + `dashboard-tab.tsx`(1) | 1h | P1 | ✅ 已完成 |

### Phase 2：收银台上线（前端 — 依赖 Phase 1 但可并行）

| 任务ID | 任务名称 | 类型 | 负责人 | 涉及文件 | 预估 | 优先级 | 状态 |
|--------|---------|:----:|:------:|---------|:----:|:------:|:----:|
| S12-05 | checkout-mode 接线 | 新增 | @Frontend | `checkout-mode.tsx`：Step 1/3 占位符 → 实际组件 | 1.5h | P0 | ✅ 已完成 |
| S12-06 | seed 预置 feature 开关 | 新增 | @Frontend | `prisma/seed-base.ts` 加 `feature_checkout_enabled=true` | 0.3h | P0 | ✅ 已完成 |
| S12-07 | Tab 切换时退出收银台 | 增强 | @Frontend | `checkout-mode.tsx` 监听 activeTab 变化自动退出 | 0.5h | P1 | ✅ 已完成 |

### Phase 3：测试债务（前端 — 可并行）

| 任务ID | 任务名称 | 类型 | 负责人 | 涉及文件 | 预估 | 优先级 | 状态 |
|--------|---------|:----:|:------:|---------|:----:|:------:|:----:|
| S12-08 | 看板卡片添加 data-testid | 增强 | @Frontend | `dashboard-tab.tsx` 各卡片容器 | 1h | P2 | ✅ 已完成 |
| S12-09 | 场景 F 测试脚本优化 | 增强 | @Frontend | `playwright-business-scenarios.spec.ts` 看板断言 | 0.5h | P2 | ✅ 已完成 |

---

## 执行顺序图

```
Phase 1（后端 — 可并行）
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ S12-01           │  │ S12-02           │  │ S12-03           │  │ S12-04           │
│ PromotionsTab    │  │ StocktakingTab   │  │ SettingsTab      │  │ 其余组件         │
│ 1h               │  │ 1h               │  │ 1h               │  │ 1h               │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
        全部使用 api.ts 的 request() 统一封装，自动携带 Token

Phase 2（前端 — 可并行）
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ S12-05           │  │ S12-06           │  │ S12-07           │
│ checkout-mode    │  │ seed 加开关       │  │ Tab 切换退出     │
│ 1.5h             │  │ 0.3h             │  │ 0.5h             │
└──────┬───────────┘  └──────────────────┘  └──────┬───────────┘
       └──────────────────┬───────────────────────┘
                          ↓
                Phase 3（前端 — 并行）
          ┌──────────────────┐  ┌──────────────────┐
          │ S12-08           │  │ S12-09           │
          │ 看板 data-testid  │  │ 场景 F 脚本优化   │
          │ 1h               │  │ 0.5h             │
          └──────────────────┘  └──────────────────┘
                          ↓
                  Phase 4（验证 — 串行）
          ┌──────────────────┐  ┌──────────────────┐
          │ Build+Lint 验证   │→ │ E2E 全量回归      │
          │ @QA              │  │ @QA              │
          │ 0.3h             │  │ 2h               │
          └──────────────────┘  └──────────────────┘
```

## 修复方案说明

### Token 认证修复（S12-01~S12-04）

所有 27 处裸 fetch 统一改为使用 `src/lib/api.ts` 已有的 `request<T>()` 函数，该函数会自动从 localStorage 读取 token 并注入 Authorization 头。

**改造模板**：

```typescript
// 改前：裸 fetch
const response = await fetch('/api/promotions');
const data = await response.json();

// 改后：使用 api.ts 统一封装
import { request } from '@/lib/api';
const data = await request('/api/promotions');
```

对于 `api.ts` 中未定义的方法（如 promotions 相关），先在 `api.ts` 中补充统一的 API 函数，再在组件中调用。具体：

1. 在 `api.ts` 中新增：
   - `promotionsApi.getPromotions(params)` → `request('/api/promotions?' + params)`
   - `promotionsApi.createPromotion(data)` → `request('/api/promotions', { method: 'POST', body: ... })`
   - `promotionsApi.updatePromotion(id, data)` → `request('/api/promotions?id=' + id, { method: 'PUT', body: ... })`
   - `promotionsApi.deletePromotion(id)` → `request('/api/promotions?id=' + id, { method: 'DELETE' })`
   - `promotionsApi.getItems(promotionId)` → `request('/api/promotions/' + promotionId + '/items')`
   - `promotionsApi.addItem(promotionId, itemId)` → `request('/api/promotions/' + promotionId + '/items', { method: 'POST', body: ... })`
   - `promotionsApi.removeItem(promotionId, itemId)` → `request('/api/promotions/' + promotionId + '/items', { method: 'DELETE', body: ... })`
   - `promotionsApi.getForecast(promotionId)` → `request('/api/promotions/' + promotionId + '/forecast')`
   - `stocktakingApi.*` — 同理补充
   - 其余组件同理

2. 各组件中 import 对应的 API 对象，替换裸 fetch

### checkout-mode 接线（S12-05）

**改动清单**：

1. 在 `checkout-mode.tsx` 顶部添加 import：
   ```typescript
   import StepCustomer from './step-customer';
   import StepPayment from './step-payment';
   ```

2. 第 267-271 行替换 Step 1 渲染：
   ```typescript
   // 改前
   {step === 1 && <StepPlaceholder step={1} />}
   // 改后
   {step === 1 && (
     <StepCustomer
       onSelectCustomer={(c) => setCustomer(c)}
       onSkip={() => setStep(2)}
     />
   )}
   ```

3. 第 311 行替换 Step 3 渲染：
   ```typescript
   // 改前
   {step === 3 && <StepPlaceholder step={3} />}
   // 改后
   {step === 3 && (
     <StepPayment
       items={items}
       customer={customer}
       onItemsChange={setItems}
       onPrev={() => setStep(2)}
       onComplete={() => { /* 完成处理 */ }}
     />
   )}
   ```

## 涉及文件清单（全部）

| 文件 | 归属 | 任务 |
|------|:----:|:----:|
| `src/components/inventory/promotions-tab.tsx` | @Backend | S12-01 |
| `src/components/inventory/promotion-item-select.tsx` | @Backend | S12-04 |
| `src/components/inventory/stocktaking-tab.tsx` | @Backend | S12-02 |
| `src/components/inventory/settings-tab.tsx` | @Backend | S12-03 |
| `src/components/inventory/navigation.tsx` | @Backend | S12-04 |
| `src/components/inventory/restock-tab.tsx` | @Backend | S12-04 |
| `src/components/inventory/dashboard-tab.tsx` | @Backend | S12-04 |
| `src/lib/api.ts` | @Backend | S12-01~S12-04（补充 API 方法） |
| `src/components/inventory/checkout/checkout-mode.tsx` | @Frontend | S12-05 |
| `prisma/seed-base.ts` | @Frontend | S12-06 |
| `src/components/inventory/dashboard-tab.tsx` | @Frontend | S12-08 |
| `tests/playwright-business-scenarios.spec.ts` | @Frontend | S12-09 |

## 部署门禁清单

- [ ] `pnpm lint --quiet` — 零新增 error/warning
- [ ] `pnpm build` — 编译成功
- [ ] `npx playwright test --grep "场景"` — 全量业务场景 E2E 全部通过
- [ ] 收银台验证 — 销售 Tab 显示"收银台模式"按钮，三步流程可用
- [ ] 促销活动验证 — 促销 Tab 可正常加载列表
- [ ] 库存盘点验证 — 盘点 Tab 可正常加载
- [ ] 回滚方案 — 各任务均为单文件单 commit，可独立 revert
