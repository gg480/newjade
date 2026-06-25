# 翡翠进销存管理系统 (Jade Inventory ERP)

> Next.js 16 全栈 ERP — 库存、销售、批次、客户、财务、设置一体化管理

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript 5 (strict) |
| 数据库 | Prisma 6 + SQLite (生产环境) |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 状态 | Zustand |
| 图表 | Recharts |
| 测试 | Playwright + E2E 业务场景测试 |

## 构建 & 运行

```bash
pnpm install              # 安装依赖
npx prisma generate       # 生成 Prisma client（拉代码/改 schema 后必执行）
npx prisma db push        # 推送 schema 到 SQLite（首次/改 schema 后）
pnpm run dev              # 开发服务器（端口 5000，HMR）
pnpm run build            # 生产构建（生成 .next/）
pnpm run start            # 生产服务器（端口 5000）
pnpm run lint             # ESLint 检查
npx tsx prisma/seed.ts    # 填充种子数据
npx playwright test       # 运行 Playwright E2E 测试
```

**重要**：拉代码或改 schema 后，先执行 `rm -rf .next && npx prisma generate && npx prisma db push`

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 主 SPA 页面（Tab 导航）
│   ├── layout.tsx            # 根布局（ThemeProvider）
│   └── api/                  # 60+ API 路由
│       ├── auth/             # 认证（登录/密码/会话）
│       ├── items/            # 库存 CRUD + 批量操作
│       ├── sales/            # 销售 + 退货 + 套装
│       ├── batches/          # 批次管理 + 分摊
│       ├── customers/        # 客户管理
│       ├── dashboard/        # 看板聚合 + 23 图表 API
│       ├── dicts/            # 字典（材质/器型/标签）
│       ├── config/           # 系统配置 key-value
│       ├── metal-prices/     # 贵金属定价
│       ├── logs/             # 操作日志
│       ├── export/           # CSV 导出
│       └── backup/           # 数据库备份/恢复
├── components/inventory/     # 业务组件（7 个 Tab + 对话框 + 共享）
├── lib/
│   ├── api.ts                # 前端 API 客户端
│   ├── store.ts              # Zustand 状态管理
│   ├── db.ts                 # Prisma 客户端单例
│   └── ...                   # 工具库
├── services/                 # 后端服务层（业务逻辑）
└── middleware.ts             # 全局中间件（限流/安全头/认证）
prisma/
└── schema.prisma             # 18 个数据模型
```

## 业务规则

- **SKU编码**：`{材质ID2位}{类型ID2位}-{月日4位}-{序号3位}`，系统自动生成
- **批次编码**：`B{类别码}{月日4位}{序号3位}`
- **成本价**：高货模式必填；通货模式由批次分摊 `totalCost / quantity`
- **认证已启用**：多用户系统，7 天会话有效期
- **必填字段**：器型(typeId)、成本价(costPrice，高货模式)、成交价(actualPrice，出库时)、销售渠道、销售日期
- **标签渲染**：API 返回 `item.tags` 是对象数组，取 `.name` 属性渲染

## Agent-Skills 体系（核心工作方式）

本项目集成 addyosmani/agent-skills 工程技能体系。**处理任何非平凡任务的第一步：匹配并使用对应的 Skill。**

### 快速路由

任务来了 → 判断属于哪个阶段 → 调用对应 Skill（严禁跳过 Skill 直接写代码）：

```
任务到达
  │
  ├── 需求模糊/不确定要什么？ ───→ interview-me 或 idea-refine
  ├── 新功能/新需求？ ──────────→ spec-driven-development → planning-and-task-breakdown
  ├── 规划/任务拆解？ ──────────→ planning-and-task-breakdown
  ├── 写代码/实现？ ────────────→ incremental-implementation + test-driven-development
  │   ├── UI 工作？ ────────────→ frontend-ui-engineering
  │   └── API/接口？ ──────────→ api-and-interface-design
  ├── 写测试？ ────────────────→ test-driven-development 或 write-tests（项目定制）
  ├── Bug/故障？ ──────────────→ debugging-and-error-recovery
  ├── 代码审查？ ──────────────→ code-review-and-quality
  │   ├── 太复杂？ ────────────→ code-simplification
  │   ├── 安全？ ──────────────→ security-and-hardening
  │   └── 性能？ ──────────────→ performance-optimization
  ├── 发布前检查？ ────────────→ /ship（并行扇出 code-reviewer + security-auditor + test-engineer）
  ├── 提交/分支？ ────────────→ git-workflow-and-versioning
  ├── CI/CD？ ────────────────→ ci-cd-and-automation
  ├── 部署/发布？ ────────────→ shipping-and-launch
  ├── NAS 部署？ ─────────────→ nas-deploy（项目定制）
  ├── E2E 测试？ ─────────────→ playwright-e2e（项目定制）
  ├── 方案咨询？ ────────────→ solution-consultant（项目定制）
  ├── 刷新图谱？ ────────────→ refresh-knowledge-graph（项目定制）
  ├── Excel数据治理？ ────────→ excel-data-governance（项目定制）
  └── 文档/ADR？ ─────────────→ documentation-and-adrs
```

### Skill 使用规则

1. **任务匹配 Skill 则必须调用** — 不跳过 Skill 直接写代码
2. Skill 位于 `.trae/skills/<skill-name>/SKILL.md` — 用 Read 工具加载
3. **严格遵循 SKILL.md 工作流** — 不能部分应用、不能跳过验证步骤
4. 无 Skill 覆盖的任务 → 先快速研讨方案再动手
5. **同类需求 2 次以上 → 沉淀为新的 Skill**

### 基础设施目录

| 目录 | 用途 |
|------|------|
| `.trae/skills/` | 40 个工程技能（SKILL.md per skill） |
| `.trae/agents/` | 4 个专业 Agent 角色 |
| `.trae/commands/` | 8 个 Slash 命令 |
| `.trae/memory/` | 项目持久记忆 |
| `.trae/rules/` | 项目规则（project_rules.md alwaysApply） |

### 会话启动工作流

每次新会话：

1. **阅读 AGENTS.md** → 完整 Agent 调度矩阵
2. **阅读记忆文件** → `.trae/memory/handover.md` → `.trae/memory/current-sprint.md`
3. **⚠️ 门禁检查** → handover.md 超过 300 行？→ 先归档再继续（见 project_rules.md 门禁流程）
4. **检查图谱新鲜度** → 读 `.understand-anything/meta.json`，若 `needsRefresh: true` 则调用 `refresh-knowledge-graph` skill 刷新
5. **匹配 Skill** → 按上方路由图确定 Skill → Read SKILL.md → 严格按工作流执行
6. **阅读代码前先查图谱** → Read 任何源文件前，先查 `.understand-anything/knowledge-graph.json`
7. **提交后刷新图谱** → `git commit` 后调用 `refresh-knowledge-graph` skill 增量更新
8. **仅当所需步骤完成后**才进入实现

## 核心操作行为

| # | 行为 | 说明 |
|---|------|------|
| 1 | 显式化假设 | 实现前列出假设，让用户纠正 |
| 2 | 主动管理困惑 | 遇到不一致 → 停止 → 指出 → 等待 |
| 3 | 合理抵制 | 方法有明确问题时指出，量化影响，提替代方案 |
| 4 | 强制简洁 | 写完后自问：能更少行吗？抽象值得吗？ |
| 5 | 范围纪律 | 只碰任务要求的，不清理无关代码 |
| 6 | 验证而非假设 | 每个技能含验证步骤，必须有实际证据 |

## 重要红线

- **Git 提交**：禁止未经用户确认自动 commit + push。先展示改动，等用户说"提交"
- **NAS 部署**：禁止直接用 docker 命令修改运行中容器。使用 `nas-update.sh`
- **种子数据**：涉及 prisma/seed*.ts 变更必须在 entrypoint.sh 同步
- **不推测代码**：必须 Read 文件后才能对代码做断言
