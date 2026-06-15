# AGENTS.md — Agent 调度与 Skill 路由

> 本文件为 AI 编码智能体提供任务调度指南。基于 addyosmani/agent-skills 工程技能体系。

---

## 核心规则

1. **任务匹配 Skill 则必须调用** — 绝不跳过 Skill 直接实现
2. Skill 位于 `.trae/skills/<skill-name>/SKILL.md`
3. **严格遵循 SKILL.md 工作流**，不能部分应用、不能跳过验证步骤
4. 无 Skill 覆盖的任务 → 先快速研讨方案再动手

---

## Agent 调度决策矩阵

收到用户请求后，按以下决策树确定调度方式：

```
用户请求
  │
  ├── 需要多视角并行审查（发布前检查）?
  │   └── YES → 并行扇出 code-reviewer + security-auditor + test-engineer
  │              （仅当 <=2文件、<=50行 diff、不涉及 auth/payments/data 时跳过）
  │
  ├── 需要单一专业视角?
  │   ├── 代码审查 → 调度 code-reviewer（调 code-review-and-quality skill）
  │   ├── 安全审计 → 调度 security-auditor（调 security-and-hardening skill）
  │   ├── 测试分析 → 调度 test-engineer（调 test-driven-development skill）
  │   ├── 性能审计 → 调度 web-performance-auditor（调 performance-optimization skill）
  │   └── 用户培训/手册 → 调度 implementation-consultant（调 implementation-consulting skill）
  │
  ├── 需要 Skill 工作流（开发任务）?
  │   └── 匹配下方 Intent → Skill 映射表 → 按 SKILL.md 执行
  │
  └── 简单任务（<3步、无复杂逻辑、单文件变更）?
      └── 直接执行，无需调度
```

### 角色禁止规则

- **Persona 不能调用其他 Persona** — 只有用户或命令可以编排
- Persona 可以调用 Skill（作为工作流的一部分）
- 禁止构建"路由器 Persona"来代理调度

---

## Agent 角色一览

| Agent | 角色 | 调度场景 | 输出格式 |
|:-----:|------|----------|---------|
| code-reviewer | 高级工程师 | 五轴代码审查（正确性/可读性/架构/安全/性能） | 结构化审查报告 |
| security-auditor | 安全工程师 | 漏洞检测、OWASP 审计、威胁建模 | 安全审计报告 |
| test-engineer | QA 工程师 | 测试策略、覆盖率分析、Prove-It 模式 | 测试分析报告 |
| web-performance-auditor | 性能工程师 | Core Web Vitals 审计、加载/渲染/网络分析 | 性能审计报告 |
| implementation-consultant | 实施顾问 | 用户培训、操作手册编制（含截图）、反馈收集 | 培训文档/反馈记录 |

### 调度方式

| 方式 | 说明 |
|:----:|------|
| **直接调度** | 用户明确需要某一专业视角时，直接调用对应 Agent |
| **并行扇出** | 发布前检查（`/ship`），同时运行 code-reviewer + security-auditor + test-engineer，合并报告 |
| **串行调度** | 按开发生命周期顺序：spec → plan → build → test → review → ship |

---

## Intent → Skill 映射（快速路由）

| 用户意图 | 匹配 Skill | 生命周期阶段 |
|----------|-----------|:----------:|
| 需求模糊/不确定要什么 | `interview-me` 或 `idea-refine` | DEFINE |
| 新功能/新需求 | `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `test-driven-development` | DEFINE→PLAN→BUILD |
| 规划/任务拆解 | `planning-and-task-breakdown` | PLAN |
| 实现/写代码 | `incremental-implementation` + `test-driven-development` | BUILD |
| UI/前端组件 | `frontend-ui-engineering` | BUILD |
| API/接口设计 | `api-and-interface-design` | BUILD |
| 写测试 | `test-driven-development` 或 `write-tests`（项目定制） | VERIFY |
| 浏览器调试 | `browser-testing-with-devtools` | VERIFY |
| Bug/故障/排查 | `debugging-and-error-recovery` | VERIFY |
| 代码审查 | `code-review-and-quality` | REVIEW |
| 重构/简化 | `code-simplification` | REVIEW |
| 安全加固 | `security-and-hardening` | REVIEW |
| 性能优化 | `performance-optimization` | REVIEW |
| 提交/分支 | `git-workflow-and-versioning` | SHIP |
| CI/CD | `ci-cd-and-automation` | SHIP |
| 发布部署 | `shipping-and-launch` | SHIP |
| NAS 部署 | `nas-deploy`（项目定制） | SHIP |
| E2E 测试 | `playwright-e2e`（项目定制） | VERIFY |
| 文档/ADR | `documentation-and-adrs` | SHIP |
| 方案咨询 | `solution-consultant`（项目定制） | DEFINE |
| Sprint 处理 | `task-sprint-processor`（项目定制） | PLAN |
| 刷新知识图谱 | `refresh-knowledge-graph`（项目定制） | VERIFY |

---

## 完整开发生命周期

```
DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP
```

**简化流程（Bug 修复）**：
```
debugging-and-error-recovery → test-driven-development → code-review-and-quality
```

**完整流程（新功能）**：
```
1. interview-me / idea-refine        → 澄清需求
2. spec-driven-development           → 规范定义
3. planning-and-task-breakdown       → 任务拆解
4. incremental-implementation        → 逐切片构建（每片含 TDD）
5. test-driven-development           → 验证每片
6. browser-testing-with-devtools     → 浏览器端验证
7. code-review-and-quality           → 审查
8. code-simplification               → 简化
9. security-and-hardening            → 安全加固
10. performance-optimization         → 性能优化
11. git-workflow-and-versioning      → 提交
12. shipping-and-launch              → 发布
```

---

## 反合理化（Anti-Rationalizations）

| 借口 | 现实 |
|------|------|
| "这太小了不用 Skill" | 简单代码也会变复杂。Skill 是最佳行为文档。 |
| "我可以快速实现" | 感觉快——出错时 500 行变更无从定位。 |
| "我先收集上下文" | 收集完上下文后仍然需要 Skill。先检查 Skill。 |
| "一次性做完更快" | 多人协作时 500 行变更无从 review，单人时出错无法精确定位。 |
| "以后会清理的" | "以后"从不会来。审查就是质量门。 |
| "能运行就行" | 不可读/不安全的代码会累积技术债。 |
| "似乎没问题" | "似乎"不是证据。验证需要实际测试结果。 |

**正确行为：总是先检查并使用 Skill。**

---

## 执行模型

每次请求的标准流程：

1. **读本文件** → 确定调度方式
2. **读记忆文件** → `.trae/memory/handover.md`（最新交接记录） → `.trae/memory/current-sprint.md`（当前 Sprint 状态）
3. **匹配 Skill** → 按上方 Intent → Skill 映射表确定 Skill → 调用对应的 `Skill` 工具
4. **严格按 SKILL.md 工作流执行** → 包含验证步骤
5. **阅读代码前先查图谱** → 在 Read 任何源文件之前，先查 `.understand-anything/knowledge-graph.json` 获取该文件的 summary + 依赖关系
6. **仅当所需步骤完成后**才进入实现

---

## 任务完成后 SOP

1. **运行验收命令**：`pnpm lint --quiet` + `pnpm build` +（如有改动）`npx playwright test`
2. **Git 提交**（需用户确认后）：展示改动内容 → 等用户说"提交" → `git commit`
3. **🔄 提交后刷新知识图谱**：`git commit` 后调用 `refresh-knowledge-graph` skill 增量更新图谱（如仅配置/文档变更可跳过）
4. **更新 handover.md**：记录变更内容、涉及文件、注意事项
5. **📦 检查是否需要归档**：如果 handover.md 超过 300 行 或 当前 Sprint 已关闭，触发归档门禁（迁移已完成条目到 archive/，保留活跃内容 ≤ 200 行）
6. **更新 CHANGELOG.md**：如有新功能或 Bug 修复
7. **评估是否沉淀为 Skill**：同类需求 2 次以上或流程复杂者
8. **输出变更摘要**：`CHANGES MADE / DIDN'T TOUCH / POTENTIAL CONCERNS` 格式
