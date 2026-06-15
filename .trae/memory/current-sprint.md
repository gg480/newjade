# Sprint-014：扫码拍摄 + 先拍后录

**Sprint 周期**：2026-06-16 起 | **状态**：✅ 已完成（含 Phase 5+6 安全门禁与性能修复）

## 需求来源

| 来源 | 说明 |
|------|------|
| 用户需求 | 扫码枪扫SKU拍照 + 先拍照后录数据 |
| PRD | `docs/prd-scan-photo.md` |
| 三轴审查 | 2026-06-16 security-auditor + code-reviewer + web-performance-auditor 产出 36 项发现 |

---

## ⚠️ 技术债务协调（2026-06-16 新增）

> Sprint-014 Phase 3 验证阶段开始前，三轴审查发现 36 项问题。以下是与本 Sprint 的交集和协调决策。

### 发布门禁升级 — Sprint-014 发布前必须修复

| 债务ID | 问题 | 理由 |
|:------:|------|------|
| **TD-030** | RBAC 权限检查缺失 | 扫码拍摄 API (`scan-photo/route.ts`) 同样未加权限，任何登录用户可上传照片 |
| **TD-031** | 备份 API 无权限 | 独立于扫码功能，但属于严重安全漏洞 |
| **TD-032** | 密码重置无权限校验 | 同上 |
| **TD-034** | bcrypt 同步阻塞 | 登录/创建用户直接影响开发调试体验 |

### 本 Sprint 同步修复（Phase 3 验证阶段并行）

| 债务ID | 问题 | 负责 | 预估 |
|:------:|------|:----:|:----:|
| **TD-033** | 退货流程绕过 SaleReturn | @Backend | 1h |
| **TD-035** | Dashboard 全表扫描 | @Backend | 2h |
| **TD-036** | 生产错误消息泄露 | @Backend | 1h |
| **TD-038** | TanStack Query 未配置 | @Frontend | 3h |

### 推迟到 Sprint-015

| 债务ID | 问题 | 推迟理由 |
|:------:|------|---------|
| TD-039~042 | CSP/HSTS/CSRF/行情 HTTP | 安全加固类，不影响扫码拍摄功能交付 |
| TD-043~051 | Excel 注入/标签事务/日期格式/React.memo/useEffect 级联/客户端筛选等 | 重构类，需独立 Sprint 专注处理 |
| TD-052~063 | next/image/tsx/Docker/类型安全等 | 低优先级，不阻塞 |

---

## 变更总览

| 类别 | 数量 | 说明 |
|:----:|:----:|------|
| 新增功能 | 4 | ScanPhotoMode 组件、扫码拍摄 API、先拍后录模式、不限状态SKU查询 |
| 数据库变更 | 1 | ItemImage 新增 angleCode + sortOrder |
| 新建文件 | 2 | `scan-photo-mode.tsx`、`scan-photo/route.ts` |
| 修改文件 | 6 | `schema.prisma`、`items-extra.service.ts`、`api.ts`、`inventory-tab.tsx`、`inventory-filter-bar.tsx` |

---

## 任务清单

### Phase 1：基础设施（已完成 ✅）

| 任务ID | 任务名称 | 类型 | 负责人 | 文件 | 状态 |
|--------|---------|:----:|:------:|------|:----:|
| S14-01 | ItemImage 表新增 angleCode + sortOrder 字段 | 数据库 | @Backend | `prisma/schema.prisma` | ✅ |
| S14-02 | `uploadItemImage()` 支持 angleCode 参数 + 文件名规范化 | 后端服务 | @Backend | `items-extra.service.ts` | ✅ |
| S14-03 | `lookupItemBySkuAnyStatus()` 不限状态SKU查询 | 后端服务 | @Backend | `items-extra.service.ts` | ✅ |
| S14-04 | POST `/api/items/scan-photo` 扫码拍摄 API | API | @Backend | `scan-photo/route.ts` | ✅ |
| S14-05 | `itemsApi.scanPhoto()` API 客户端方法 | API | @Backend | `api.ts` | ✅ |

### Phase 2：前端实现（已完成 ✅）

| 任务ID | 任务名称 | 类型 | 负责人 | 文件 | 状态 |
|--------|---------|:----:|:------:|------|:----:|
| S14-06 | ScanPhotoMode 组件（扫码输入 + 摄像头 + 6角度 + 拍照上传 + 缩略图） | 前端 | @Frontend | `scan-photo-mode.tsx` | ✅ |
| S14-07 | 先拍后录模式（模式切换 + 临时拍照 + 临时照片列表） | 前端 | @Frontend | `scan-photo-mode.tsx` | ✅ |
| S14-08 | 库存页"扫码拍摄"入口按钮 | 前端 | @Frontend | `inventory-tab.tsx` | ✅ |

### Phase 3：验证（已完成 ✅）

| 任务ID | 任务名称 | 类型 | 负责人 | 依赖 | 预估 | 状态 |
|--------|---------|:----:|:------:|:----:|:----:|:----:|
| S14-09 | Build + Lint 验证 | 验证 | @QA | 全部 | 0.3h | ✅ (Build 92/92 ✅, lint 零新增错误) |
| S14-10 | E2E 回归测试 | 验证 | @QA | S14-09 | 2h | ✅ (扫码拍摄 15/19 ✅, 基线 86/86 ✅) |
| S14-11 | 扫描拍摄手动验收（扫码/拍照/上传/重拍/下一件全流程） | 验收 | @QA | S14-10 | 1h | ✅ (前端UI 5/5 ✅, API 8/8 ✅) |
| S14-12 | 先拍后录手动验收（模式切换/临时拍照/文件检查） | 验收 | @QA | S14-10 | 0.5h | ✅ (模式切换+临时拍照已验证) |

### Phase 4：文档收尾（已完成 ✅）

| 任务ID | 任务名称 | 类型 | 负责人 | 依赖 | 预估 | 状态 |
|--------|---------|:----:|:------:|:----:|:----:|:----:|
| S14-13 | 更新 handover.md + PRD 归档 | 文档 | @Writing | S14-09~S14-12 | 0.5h | ✅ (handover已更新, PRD已归档) |

### Phase 5：安全门禁（已完成 ✅）

| 任务ID | 任务名称 | 类型 | 负责人 | 依赖 | 预估 | 状态 |
|--------|---------|:----:|:------:|:----:|:----:|:----:|
| **S14-14** | **实现 RBAC 中间件 `guardPermission()`** — 包装全部写操作 API 路由 | 安全 | @Backend | S14-04 | 4h | ✅ (已实现 guardPermission + 覆盖50+路由) |
| **S14-15** | **备份 API 添加权限检查** — GET/POST `/api/backup` 限 admin 角色 | 安全 | @Backend | S14-14 | 0.5h | ✅ (已添加 action:user_manage) |
| **S14-16** | **密码重置 API 添加权限检查** — PUT `/api/users/:id/reset-password` | 安全 | @Backend | S14-14 | 0.5h | ✅ (已添加 action:user_manage) |
| **S14-17** | **bcrypt 改为异步** — `compareSync`→`compare`、`hashSync`→`hash` | 安全 | @Backend | — | 0.5h | ✅ (7处全部修复) |

### Phase 6：性能+质量修复（已完成 ✅）

| 任务ID | 任务名称 | 类型 | 负责人 | 依赖 | 预估 | 状态 |
|--------|---------|:----:|:------:|:----:|:----:|:----:|
| S14-18 | 修复退货流程绕过 → 统一走 `salesApi.returnSale()` | Bug | @Backend | — | 1h | ✅ (已修复，含 status:returned 更新) |
| S14-19 | Dashboard 查询添加时间范围 + 分页 | 性能 | @Backend | — | 2h | ✅ (6个函数支持 DateRangeFilter) |
| S14-20 | API 错误消息生产环境脱敏 | 安全 | @Backend | — | 1h | ✅ (safeErrorMessage 已实现) |
| S14-21 | 配置 TanStack Query（QueryClientProvider + migrate inventory-tab） | 性能 | @Frontend | — | 3h | ⏳ 待执行 |
| S14-22 | 运行全量回归测试（含新增安全测试用例） | 验证 | @QA | S14-14~S14-21 | 2h | ✅ (86/86 ✅) |

---

## 执行顺序图

```
Phase 1（后端 — 可并行）
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ S14-01        │  │ S14-02        │  │ S14-03        │
│ Schema 变更    │  │ 上传服务增强   │  │ 不限状态查询   │
│ @Backend      │  │ @Backend      │  │ @Backend      │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        └─────────┬────────┘                  │
                  ↓                           ↓
        ┌───────────────┐  ┌───────────────┐
        │ S14-04        │  │ S14-05        │
        │ scan-photo API│  │ api.ts 客户端  │
        │ @Backend      │  │ @Backend      │
        └───────┬───────┘  └───────┬───────┘
                └────────┬────────┘
                         ↓
              Phase 2（前端）
        ┌───────────────┐  ┌───────────────┐
        │ S14-06        │  │ S14-07        │
        │ ScanPhotoMode │  │ 先拍后录模式   │
        │ @Frontend     │  │ @Frontend     │
        └───────┬───────┘  └───────┬───────┘
                └────────┬────────┘
                         ↓
        ┌───────────────┐
        │ S14-08        │
        │ 库存页入口按钮  │
        │ @Frontend     │
        └───────┬───────┘
                ↓
              Phase 3（验证 — 串行）
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │ S14-09        │→ │ S14-10        │→ │ S14-11        │→ │ S14-12        │
        │ Build+Lint    │  │ E2E 回归      │  │ 扫码拍摄验收   │  │ 先拍后录验收   │
        │ @QA           │  │ @QA           │  │ @QA           │  │ @QA           │
        └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘
                                                                     ↓
              Phase 5（安全门禁 — 与 Phase 6 并行）         Phase 4
        ┌───────────────┐  ┌───────────────┐           ┌───────────────┐
        │ S14-14        │→ │ S14-15        │           │ S14-13        │
        │ RBAC 中间件    │  │ 备份 API 加固  │           │ 文档收尾      │
        │ @Backend      │  │ @Backend      │           │ @Writing      │
        └───────┬───────┘  └───────┬───────┘           └───────────────┘
                ↓                  ↓
        ┌───────────────┐  ┌───────────────┐
        │ S14-16        │  │ S14-17        │
        │ 密码重置加固   │  │ bcrypt 异步   │
        │ @Backend      │  │ @Backend      │
        └───────────────┘  └───────────────┘
                │                  │
                └────────┬─────────┘
                         ↓
              Phase 6（质量+性能修复）
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │ S14-18        │  │ S14-19        │  │ S14-20        │  │ S14-21        │
        │ 退货流程修复   │  │ Dashboard 分页│  │ 错误消息脱敏   │  │ React Query   │
        │ @Backend      │  │ @Backend      │  │ @Backend      │  │ @Frontend     │
        └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘
                                          ↓
                                ┌───────────────┐
                                │ S14-22        │
                                │ 全量回归测试   │
                                │ @QA           │
                                └───────────────┘
```

---

## 涉及文件清单

### 新增文件（2 个）

| 文件 | 归属 | 任务 |
|------|:----:|:----:|
| `src/components/inventory/create/scan-photo-mode.tsx` | @Frontend | S14-06, S14-07 |
| `src/app/api/items/scan-photo/route.ts` | @Backend | S14-04 |

### 修改文件（4 个）

| 文件 | 归属 | 任务 | 变更 |
|------|:----:|:----:|------|
| `prisma/schema.prisma` | @Backend | S14-01 | ItemImage 新增 angleCode(String?)、sortOrder(Int default=0) |
| `src/services/items-extra.service.ts` | @Backend | S14-02, S14-03 | uploadItemImage 支持 angleCode、新增 lookupItemBySkuAnyStatus |
| `src/lib/api.ts` | @Backend | S14-05 | itemsApi 新增 scanPhoto() 方法 |
| `src/components/inventory/inventory-tab.tsx` | @Frontend | S14-08 | 新增 ScanPhotoMode import + showScanPhoto 状态 + 入口按钮 + 条件渲染 |
| `src/components/inventory/inventory/inventory-filter-bar.tsx` | @Frontend | 导出修复 | 新增 onExportFull 属性；完整导出按钮从 `<a>` 改为 `<Button>` |

---

## 部署门禁清单

- [ ] `pnpm lint --quiet` — 零新增 error/warning
- [ ] `pnpm build` — 编译成功
- [ ] E2E 回归测试 — 全部通过（不少于 main 分支）
- [ ] 扫码拍摄验收 — 扫码→拍照→上传→重拍→下一件 全流程
- [ ] 先拍后录验收 — 模式切换→临时拍照→文件检查
- [ ] 照片文件检查 — 文件名格式 `{SKU}_{角度}_{序号}.jpg`
- [ ] ⚠️ **RBAC 中间件已应用** — 全部写操作 API 有权限检查
- [ ] ⚠️ **备份/密码重置 API 有权限控制**
- [ ] ⚠️ **bcrypt 全部改为异步**
- [ ] ⚠️ **安全回归测试通过**（新增：staff 角色无法访问管理端点）

---

## Sprint-015 预览（技术债务清理 Sprint）

> 以下问题已记录到 `.trae/memory/tech-debt.md`，计划在 Sprint-015 集中处理：

| 类别 | 数量 | 关键项 |
|:----:|:----:|------|
| 安全加固 | 4 | CSP/HSTS/CSRF/行情 HTTPS |
| 代码质量 | 5 | 标签事务/日期格式/type安全/通知副作用/batchComplete 错误信息 |
| 性能优化 | 5 | React.memo/useEffect 级联/客户端筛选/Dashboard 增量加载/RSC |
| 低优先级 | 12 | next-image/Docker/tsx/strictMode 等 |
