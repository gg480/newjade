# PRD：AI 生成代码仿生物免疫自验证系统

> 版本：v1.0 | 状态：DRAFT | 日期：2026-06-25

---

## 一、产品背景与问题定义

### 1.1 核心矛盾

AI 生成代码存在根本性的**信息差**：

- AI 只看当前文件的代码上下文，不知道整个项目的依赖网络
- AI 不知道其他会话对同名函数、类型、模块做了什么修改
- AI 不理解完整的业务流程链路（哪些步骤不可跳过、哪些数据必须先准备好）
- AI 不知道 UI 组件库的版本差异、API 契约的最新变更

传统软件测试是**事后验证**——代码已经写完了才去跑测试套件。这匹配的是人类开发者的工作方式，但不匹配 AI 生成代码的工作方式。AI 需要的是**生成即验证、问题即修复**的共生闭环。

### 1.2 设计隐喻

本系统参照人体免疫体系的运作机制：

| 生物机制 | 软件映射 |
|---------|---------|
| 皮肤/黏膜 — 物理屏障 | 编译期类型检查、lint |
| 先天免疫 — 巨噬细胞/NK 细胞，通用识别「非己」 | 依赖完整性检查、循环依赖检测 |
| 适应性免疫 — T 细胞/B 细胞，特异性识别+免疫记忆 | 业务流程契约、属性测试、故障模式库 |
| 炎症反应 — 局部红肿热痛，发出定位信号 | 结构化故障码，精确定位问题文件和行号 |
| 伤口愈合 — 血小板聚集、组织再生 | AI 根据故障码 + fix_hint 自动修复代码 |
| 免疫记忆 — 记忆 B 细胞，同类问题快速响应 | 故障修复记录库，相似故障秒级定位 |
| 免疫自稳 — 清除衰老/损伤细胞 | 死代码检测、无用导出清理 |

### 1.3 核心定位

这不是一个「测试框架」，而是一个**代码文件内部的共生验证层**——验证标注与业务代码共存于同一文件，由 AI 在生成代码时同步生成，在开发模式下自动运行，输出 AI 可直接消费的结构化故障码。

---

## 二、系统架构

### 2.1 双层验证模型

```
                    ┌─────────────────────────────────┐
                    │       外部验证（免疫感知层）        │
                    │  从软件运行态倒推，从外部观察        │
                    │                                 │
                    │  1. 视觉验证 — 界面元素是否正确呈现  │
                    │  2. 结果验证 — 计算/推导结果是否正确 │
                    │  3. 流程验证 — 业务链路是否完整     │
                    └──────────────┬──────────────────┘
                                   │ 互相触发验证
                    ┌──────────────┴──────────────────┐
                    │       内部共生验证（器官功能层）     │
                    │  嵌在代码文件内部，随代码共生        │
                    │                                 │
                    │  1. 依赖验证 — 双向依赖关系完整性    │
                    │  2. 格式验证 — 代码格式规范         │
                    │  3. 类型验证 — 类型正确性           │
                    │  4. 流程验证 — 文件内函数调用链路    │
                    │  5. 契约验证 — 前置/后置/不变量     │
                    └─────────────────────────────────┘
```

### 2.2 运行闭环

```
AI 生成代码 + 验证标注
        │
        ▼
  ┌─────────────────────────────────────────┐
  │          dev:verify（开发模式前置检查）      │
  │                                         │
  │  1. 扫描所有文件的 @verification-* 标注    │
  │  2. 运行轻量验证器（依赖/格式/类型）         │
  │  3. 运行重量验证器（流程/契约/属性测试）     │
  │  4. 运行视觉验证（Playwright 快照比对）     │
  └──────────────┬──────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
   全部通过           有故障码
        │                 │
        ▼                 ▼
  正常启动         输出 fault-report.json
                        │
                        ▼
                AI 读取 fault-report.json
                        │
                        ▼
                按 fix_hint 逐条精准修复
                        │
                        ▼
                重新 dev:verify（循环直到通过）
                        │
                        ▼
                修复记录存入免疫记忆库
```

---

## 三、外部验证层详细规格

### 3.1 视觉验证

**目标**：确保界面元素在视觉上正确呈现——该有的 UI 要有，不该错位的不错位。

**验证内容**：

| 检查项 | 说明 | 技术手段 |
|-------|------|---------|
| 关键元素存在性 | 指定 data-testid 的元素是否存在 | DOM 选择 + Playwright |
| 元素可见性 | 元素是否可见（非 hidden、非被遮挡） | Playwright `isVisible()` |
| 视觉回归 | 截图与基线比对，发现像素差异 | Percy / BackstopJS |
| 语义布局 | 按钮是否错位、文字是否截断、色彩是否正确 | AI 视觉模型（VLM）|

**嵌入式标注语法**：

```
// @verification-visual:
//   assert-element: button[data-testid="submit-btn"]
//   assert-element: input[data-testid="search-input"]
//   assert-visible: .result-panel
//   assert-text: "提交成功"
//   snapshot: page-checkout-confirm  // 与基线快照比对
```

**故障码规范**：

| 故障码 | 含义 | 触发条件 |
|-------|------|---------|
| `VISUAL-MISSING-001` | 关键元素缺失 | data-testid 元素在 DOM 中不存在 |
| `VISUAL-HIDDEN-002` | 关键元素不可见 | 元素存在但 display:none 或被遮挡 |
| `VISUAL-DIFF-003` | 视觉回归差异 | 截图与基线差异超过阈值 |
| `VISUAL-TEXT-004` | 预期文本缺失 | 页面中找不到指定文本 |

---

### 3.2 结果验证

**目标**：确保计算逻辑和推导结论在任意合法输入下都正确。

**验证内容**：

| 检查项 | 说明 | 技术手段 |
|-------|------|---------|
| 属性测试 | 「对所有合法输入，属性 P 恒成立」 | fast-check（随机海量输入） |
| 快照断言 | API 响应、序列化结果的快照比对 | Jest/Vitest snapshots |
| 边界覆盖 | 空值、零值、极大值、极长字符串 | 由属性测试自动覆盖 |
| 并发正确性 | 竞态条件下的结果一致性 | fast-check 内置 race-condition 检查 |

**嵌入式标注语法**：

```
// @verification-result:
//   property: 入库后库存 = 原库存 + 入库量
//     for-all: current: nat, inbound: nat
//     assert: calculateStock(current, inbound) === current + inbound
//
//   property: 库存永不为负
//     for-all: current: nat, outbound: nat
//     pre: outbound <= current
//     assert: calculateStock(current, -outbound) >= 0
//
//   property: 字符串 MD5 长度恒为 32
//     for-all: input: string
//     assert: md5(input).length === 32
```

**故障码规范**：

| 故障码 | 含义 |
|-------|------|
| `RESULT-FAIL-001` | 属性测试失败（已收缩到最小反例） |
| `RESULT-BOUNDARY-002` | 边界条件未处理（空值/零值崩溃） |
| `RESULT-SNAPSHOT-003` | 输出快照与基线不一致 |
| `RESULT-RACE-004` | 并发场景下存在竞态条件 |

---

### 3.3 流程验证

**目标**：确保业务操作链路的完整性和正确性——该有的步骤不可跳过，步骤之间数据流转正确。

**验证内容**：

| 检查项 | 说明 | 技术手段 |
|-------|------|---------|
| 状态机完整性 | 状态是否全部可达、转换是否合法 | 状态机静态检查 |
| 步骤依存性 | 后续步骤依赖的前置数据是否已准备好 | 数据流追踪 |
| E2E 链路 | 真实浏览器环境运行完整流程 | Playwright |
| 异常路径 | 每个状态到 error 状态的转换是否存在 | 状态机穷举 |

**嵌入式标注语法**：

```
// @verification-flow:
//   state-machine: checkout-flow
//   states: [BROWSING, CART, CHECKOUT, PAYING, CONFIRMED, ERROR]
//   transitions:
//     BROWSING → CART (on: addToCart)
//     CART → CHECKOUT (on: proceedToCheckout)
//     CHECKOUT → PAYING (on: submitOrder)      // ⚠️ 不可跳过
//     PAYING → CONFIRMED (on: paymentSuccess)   // ⚠️ 不可跳过
//     ANY → ERROR (on: error)                   // ⚠️ 异常路径必须存在
//   invariants:
//     - CONFIRMED 状态之前必须经过 PAYING 状态
//     - 每个 transition 的目标函数必须存在且可调用
//     - 不存在不可达的孤立状态
```

**故障码规范**：

| 故障码 | 含义 |
|-------|------|
| `FLOW-BREAK-001` | 流程链路断裂（步骤间缺少中间节点） |
| `FLOW-MISSING-002` | transition 的目标函数不存在 |
| `FLOW-UNREACHABLE-003` | 存在不可达的孤立状态 |
| `FLOW-NO-ERROR-004` | 缺少异常处理路径（无 ERROR 转换） |
| `FLOW-TYPE-MISMATCH-005` | 步骤间数据流转类型不匹配 |

---

## 四、内部共生验证层详细规格

### 4.1 依赖双向验证

**目标**：确保模块间的依赖关系双向一致——A 引用了 B，B 知道自己被 A 引用；A 导出了 X，已知 X 被谁引用。

**验证内容**：

| 检查项 | 说明 |
|-------|------|
| 循环依赖 | A → B → C → A 的环状引用 |
| 正向依赖缺失 | A 引用了 B，但 B 不在 A 的依赖声明中 |
| 反向引用完整性 | B 被 A 引用后，B 的变更需要通知 A |
| 死导出 | 导出了但没有任何文件引用的函数/类型 |
| 死文件 | 所有导出都无人引用的孤立文件 |
| 死依赖 | package.json 声明了但代码中未使用的包 |
| 缺失依赖 | 代码中用了但 package.json 未声明的包 |
| 模块边界违规 | A 层代码引用了不应引用的 B 层代码 |

**嵌入式标注语法**：

```
// @verification-dep:
//   requires: 
//     - ./authService (must export: validateToken, refreshToken)
//     - ./cacheService (must export: get, set, del)
//   provides:
//     - checkPermission(userId, resource)
//   importers: 
//     - ./middleware/authGuard (uses: checkPermission)
//     - ./routes/adminRoutes (uses: checkPermission)
//   boundaries:
//     - this-layer: service
//     - allowed-from: [controller, middleware]
//     - forbidden-from: [repository]
```

**故障码规范**：

| 故障码 | 含义 |
|-------|------|
| `DEP-CIRC-001` | 存在循环依赖 |
| `DEP-MISSING-002` | 引用了未声明的模块/包 |
| `DEP-ORPHAN-003` | 文件或导出为孤立状态（无人引用） |
| `DEP-UNUSED-004` | 声明了但从未使用的依赖包 |
| `DEP-STALE-005` | 反向依赖已过期：B 删除了函数 X，但 A 仍在引用 |
| `DEP-BOUNDARY-006` | 跨层引用违规 |
| `DEP-AMBIGUOUS-007` | 多个同名导出来源不明 |

**核心机制——反向依赖自检**：

```
文件 A：import { funcX } from './fileB'
文件 B：export function funcX() { ... }

AI 修改文件 B：删除 funcX，改为 funcY

此时系统自动检测：
  1. 扫描所有 import './fileB' 或 import { funcX } from './fileB' 的文件
  2. 发现文件 A 仍在引用 funcX
  3. 输出 DEP-STALE-005：
     "fileB 不再导出 funcX，但 fileA.ts:3 仍在引用"
  4. fix_hint: "将 fileA.ts:3 的 funcX 改为 funcY，或由 B 重新导出 funcX"
```

---

### 4.2 格式验证

**目标**：确保代码格式符合项目规范。

**技术手段**：ESLint + Prettier，前置到代码写入文件之前。

| 故障码 | 含义 |
|-------|------|
| `FMT-LINT-001` | ESLint 规则违反 |
| `FMT-PRETTIER-002` | 代码格式化不一致 |
| `FMT-NAMING-003` | 变量/函数/文件名不符合命名规范 |
| `FMT-STRUCT-004` | 文件目录结构与约定不符 |

---

### 4.3 类型验证

**目标**：确保类型系统层面的一致性。

**技术手段**：TypeScript `tsc --noEmit`、数据库 schema 校验。

| 故障码 | 含义 |
|-------|------|
| `TYPE-TS-001` | TypeScript 类型错误 |
| `TYPE-SCHEMA-002` | 数据库 Schema 与模型不一致 |
| `TYPE-NARROW-003` | 存在不安全的类型收窄 |
| `TYPE-ANY-004` | 检测到不必要的 `any` 类型 |

---

### 4.4 内部流程验证

**目标**：验证单个文件内部的函数调用链路是否完整、参数类型是否匹配。

**嵌入式标注语法**：

```
// @verification-internal-flow:
//   call-chain: processOrder
//     → validateInput(orderData)           // step1
//     → calcTotal(orderData.items)         // step2（依赖 step1 的校验结果）
//     → checkInventory(orderData.items)    // step3（可与 step2 并行）
//     → createOrder(validatedData, total, inventoryOk)  // step4（依赖 1+2+3）
//
//   constraints:
//     - calcTotal 的返回值类型必须匹配 createOrder 的第二个参数类型
//     - checkInventory 必须在 createOrder 之前调用（时序约束）
//     - validateInput 失败时不可进入 calcTotal（短路约束）
```

| 故障码 | 含义 |
|-------|------|
| `IFLOW-MISSING-001` | 调用链路中某步骤函数不存在 |
| `IFLOW-TYPE-002` | 步骤间参数类型不匹配 |
| `IFLOW-ORDER-003` | 调用顺序违反时序约束 |

---

### 4.5 契约验证

**目标**：确保业务规则在运行时成立——前置条件被调用方满足、后置条件被执行方保证、不变量全程维持。

**嵌入式标注语法**：

```
// 形式一：纯标注（轻量，开发模式解析执行）
// @contract:
//   precondition:
//     - input.barcode.length >= 8 && input.barcode.length <= 20
//     - input.quantity > 0
//     - if input.mode === 'strict' then input.auditToken !== null
//   postcondition:
//     - result.id !== null
//     - result.status in ['pending', 'processing']
//     - result.totalAmount === input.quantity * input.unitPrice
//   invariant:
//     - system.inventory[result.productId] >= 0
//     - system.pendingOrders.length <= system.maxConcurrent

// 形式二：装饰器（运行时检查，开发模式自动激活）
@Contract.require((input) => input.quantity > 0, 'CNTR-PRE-001: 数量必须大于0')
@Contract.ensure((result) => result.id !== null, 'CNTR-POST-001: ID 不能为空')
@Contract.invariant((ctx) => ctx.inventory >= 0, 'CNTR-INV-001: 库存不能为负')
async function processOrder(input: OrderInput): Promise<OrderResult> {
  // ... 业务逻辑 ...
}
```

**故障码规范**：

| 故障码 | 含义 |
|-------|------|
| `CNTR-PRE-001` | 前置条件违反 |
| `CNTR-POST-001` | 后置条件违反 |
| `CNTR-INV-001` | 不变量违反 |
| `CNTR-TIMING-001` | 契约未在限时内满足 |

---

## 五、故障码体系设计

### 5.1 编码规范

```
{层级前缀}-{子类}-{序号}

层级前缀：
  VISUAL  — 视觉验证
  RESULT  — 结果验证
  FLOW    — 流程验证（外部）
  DEP     — 依赖验证
  FMT     — 格式验证
  TYPE    — 类型验证
  IFLOW   — 内部流程验证
  CNTR    — 契约验证
  SYS     — 系统级

严重级别：
  FATAL   — 阻断（无法继续运行）
  ERROR   — 必须修复（功能不正确）
  WARN    — 建议修复（潜在风险）
  INFO    — 提示（可选优化）
```

### 5.2 故障报告输出格式

```json
{
  "report_id": "vr-20260625-001",
  "timestamp": "2026-06-25T10:30:00.000Z",
  "mode": "dev:verify",
  "summary": {
    "total_checks": 156,
    "passed": 148,
    "failed": 8,
    "fatal": 0,
    "error": 5,
    "warn": 2,
    "info": 1
  },
  "faults": [
    {
      "code": "DEP-STALE-005",
      "severity": "ERROR",
      "layer": "internal",
      "category": "dependency",
      "message": "fileB 删除了 export function validateToken，但 fileA 和 fileC 仍在引用",
      "source_file": "src/services/authService.ts",
      "target_file": "src/services/tokenService.ts",
      "line": 3,
      "column": 10,
      "fix_hint": "将 fileA.ts:3、fileC.ts:7 的 validateToken 导入改为 refreshToken，或由 tokenService 重新导出 validateToken 别名",
      "affected_files": [
        "src/middleware/authGuard.ts:3",
        "src/routes/adminRoutes.ts:7"
      ]
    },
    {
      "code": "FLOW-BREAK-001",
      "severity": "ERROR",
      "layer": "external",
      "category": "flow",
      "message": "流程链路断裂: scanCode → lookupProduct 缺少中间步骤 validateCode",
      "source_file": "src/services/scanService.ts",
      "fix_hint": "在 scanCode 和 lookupProduct 之间插入 validateCode(barcode) 调用，确保条码格式合法后再查询",
      "missing_step": "validateCode"
    }
  ]
}
```

### 5.3 AI 消费故障报告的方式

AI Agent 读取 `fault-report.json` 后按优先级处理：

1. **FATAL** → 立即阻断，不修复无法继续
2. **ERROR** → 按 `fix_hint` 逐条修复，修复后重新验证
3. **WARN** → 收集并在最后统一修复，不阻塞开发流程
4. **INFO** → 仅记录，人工或低优先级修复

修复完成后，`fix_hint` + 实际修复内容存入免疫记忆库，下次同类故障直接匹配历史修复方案。

---

## 六、免疫记忆机制

### 6.1 故障修复记录库

```json
{
  "memory_version": "1.0",
  "last_updated": "2026-06-25T10:30:00Z",
  "records": [
    {
      "pattern_fingerprint": "DEP-STALE-005|export_deleted|import_still_exists",
      "fault_code": "DEP-STALE-005",
      "occurrence_count": 23,
      "first_seen": "2026-04-01",
      "last_seen": "2026-06-24",
      "common_root_cause": "AI 在一个文件中删除了导出，但不知道其他文件在引用它",
      "fix_strategy": "全局搜索被删除导出名的所有引用，批量更新或重新导出别名",
      "fix_success_rate": 0.96
    },
    {
      "pattern_fingerprint": "FLOW-BREAK-001|missing_intermediate_step",
      "fault_code": "FLOW-BREAK-001",
      "occurrence_count": 15,
      "first_seen": "2026-03-15",
      "last_seen": "2026-06-20",
      "common_root_cause": "AI 生成代码时跳过数据校验步骤，直接使用未经验证的输入",
      "fix_strategy": "在两个步骤之间插入校验函数调用，类型不匹配则插入转换函数",
      "fix_success_rate": 0.89
    }
  ]
}
```

### 6.2 匹配策略

1. **精确匹配**：故障码 + 涉及文件签名相同 → 直接复用上次修复方案
2. **模糊匹配**：故障码相同但文件不同 → 参考上次修复策略，调整参数后应用
3. **新故障**：无历史记录 → AI 分析 fix_hint + 代码上下文 → 生成修复 → 人工确认 → 记录入库

---

## 七、开发模式集成

### 7.1 CLI 命令体系

```bash
# 全量验证（开发模式启动前自动运行）
pnpm dev:verify

# 分层验证（可单独运行）
pnpm dev:verify:external       # 外部验证层（视觉+结果+流程）
pnpm dev:verify:internal       # 内部验证层（依赖+格式+类型+内部流程+契约）
pnpm dev:verify:visual         # 仅视觉验证
pnpm dev:verify:result         # 仅结果验证（属性测试）
pnpm dev:verify:flow           # 仅流程验证（状态机+E2E）
pnpm dev:verify:dep            # 仅依赖验证
pnpm dev:verify:contract       # 仅契约验证

# 免疫记忆管理
pnpm dev:verify:memory-stats   # 查看免疫记忆统计
pnpm dev:verify:memory-clean   # 清理过期的免疫记忆（超过 N 天未复现）
```

### 7.2 与 AI 编码 Agent 的协作流程

```
开发者：pnpm dev
  │
  └── 触发 dev:verify（自动）
        │
        ├── 通过 → 正常启动开发服务器
        │
        └── 失败 → 输出 fault-report.json
                    │
                    ▼
              AI Agent 自动读取
                    │
                    ├── 查询免疫记忆 → 有历史修复方案 → 快速修复
                    │
                    ├── 无历史方案 → 分析 fix_hint → 生成修复
                    │
                    └── 修复完成 → 自动重新验证 → 循环直到通过
```

### 7.3 验证标注的生成方式

AI 在生成代码文件时，应同时在文件末尾（或函数上方）生成对应的 `@verification-*` 标注。这可以在 System Prompt 中统一要求：

```
当生成源代码文件时，你必须同时生成对应的验证标注。规则如下：

1. 每个文件必须在末尾包含 @verification-dep，列出所有 import 依赖及其期望的导出
2. 每个核心业务函数必须包含 @contract（前置/后置条件）或 @verification-result（属性测试）
3. 如涉及多步骤业务流程，必须包含 @verification-flow 或 @verification-internal-flow
4. 如涉及 UI 页面/组件，必须包含 @verification-visual
5. 验证标注使用 // 或 /* */ 注释形式，对生产构建零影响
```

---

## 八、非功能性需求

### 8.1 性能要求

| 指标 | 目标值 | 说明 |
|------|:---:|------|
| dev:verify 总耗时 | < 5s（增量）/ < 30s（全量） | 不能成为开发体验瓶颈 |
| 依赖图分析时间 | < 1s（1000 文件项目） | rev-dep 实测 500K LoC/500ms |
| 属性测试运行时间 | < 10s（每 100 属性） | fast-check 默认每属性 100 次迭代 |
| 视觉快照比对 | < 3s（每页面） | Playwright 截图 + Percy 云端比对 |
| 故障报告的 JSON 输出 | < 500ms |

### 8.2 生产环境隔离

- 所有 `@verification-*` 标注为**注释形式**，对生产构建文件体积零影响
- 契约检查代码必须包裹在 `if (process.env.VERIFY_CONTRACT === '1')` 中，生产环境跳过
- 验证工具链安装为 `devDependencies`，不进入生产依赖

### 8.3 可扩展性

- 故障码注册表为开放结构，支持新增层级和子类
- 验证器支持插件机制，第三方可扩展自定义验证规则
- 免疫记忆库支持跨项目迁移和共享

---

## 九、验收标准

| 编号 | 验收项 | 通过条件 |
|:---:|-------|---------|
| AC-1 | 验证标注解析 | 能正确解析所有 `@verification-*` 标注语法 |
| AC-2 | 依赖双向自检 | A 删了 B 的导出，能自动发现 A 的所有引用者 |
| AC-3 | 循环依赖检测 | 能检测到 N 层嵌套的循环依赖 |
| AC-4 | 属性测试集成 | 嵌入式属性测试标注能正确生成和运行 |
| AC-5 | 流程链路完整性 | 状态机缺失转换或丢失中间步骤能被检测 |
| AC-6 | 契约运行时检查 | 开发模式下前置/后置条件违反时正确抛出故障码 |
| AC-7 | 故障码结构化输出 | 输出 JSON 符合规范，AI 可直接消费 |
| AC-8 | 免疫记忆匹配 | 同类故障第二次出现时直接命中历史修复方案 |
| AC-9 | 性能达标 | 增量验证 < 5s，全量验证 < 30s |
| AC-10 | 生产零影响 | 生产构建无验证代码残留 |

---

## 十、风险与开放问题

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 验证标注加重 AI 生成负担 | 生成代码质量可能下降 | 先做最小集（依赖+契约），逐步扩展 |
| 属性测试编写门槛高 | 团队难以维护 | 提供常见业务场景的属性模板库 |
| 视觉验证的环境差异 | 跨平台截图基线不一致 | 使用 Docker 固定浏览器环境 |
| 故障码体系过度膨胀 | 难以管理和检索 | 按 5 个严重级别收敛，定期清理低频码 |
| 免疫记忆库的冷启动 | 前期修复成功率低 | 初始化时人工注入 20-30 个高频故障模式 |

### 开放问题

1. 不同编程语言的验证标注是否需要统一的中间表示（IR）？
2. 免疫记忆库是否应该作为共享资产在团队/组织级别维护？
3. 故障码修复的正确性如何自动验证（防止修复引入新问题）？
4. 当多个故障码之间存在因果关联时，修复顺序如何确定？
