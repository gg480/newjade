---
name: "gh-pr-compliance"
description: "三级门禁体系的 Level 1 — 提交规范门禁。系统性排查 GitHub 提交和 PR 规范问题，涵盖 Commit Message 格式、分支命名、代码 Lint/类型检查、PR 描述完整性、CI 流水线状态、敏感信息泄露等 7 项维度。发现问题后按 SOP 分流处理。"
---

# gh-pr-compliance — 提交规范门禁（Level 1）

> **定位**：三级门禁体系的 **Level 1**，在 PR 提交后、代码审查前执行，确保提交基础规范达标。
>
> ```
> 三级门禁体系：
>   Level 1: gh-pr-compliance（提交规范门禁）— 本 Skill
>   Level 2: code-review / TRAE-security-review（代码质量审查）
>   Level 3: gh-address-comments（评审意见跟踪）
>   旁路: gh-fix-ci（CI 失败修复，仅在 Level 1 发现 CI 失败时触发）
> ```

---

## 1. 前置条件

### 1.1 gh CLI 认证

执行排查前，确认 `gh` CLI 已安装并已认证：

```bash
# 检查 gh 是否可用
gh --version

# 检查认证状态
gh auth status

# 如未认证，执行登录
gh auth login
```

### 1.2 代理配置（Windows 环境）

本项目使用代理端口 **7897**。排查前须配置环境变量：

```bash
# PowerShell 中设置代理（当前会话有效）
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
$env:HTTP_PROXY = "http://127.0.0.1:7897"

# 验证代理连通性
curl -x http://127.0.0.1:7897 -s https://api.github.com -o $null
if ($?) { echo "代理连通 ✅" } else { echo "代理异常 ❌" }
```

> **注意**：gh CLI 使用 HTTPS 协议与 GitHub API 通信，在 Windows 下通过 `HTTPS_PROXY` 环境变量透传代理。如遇超时或证书错误，优先检查代理端口是否开启。

### 1.3 工作目录确认

```bash
# 确认在项目根目录
cd d:\02工作\ERP\newjade

# 确认是 git 仓库
git rev-parse --git-dir
```

---

## 2. 七项排查维度

### 维度 1：Commit Message 格式

**检查内容**：提交信息是否符合项目约定的格式。

**本项目约定格式**（Conventional Commits，与 changelog 历史一致）：

| 标签 | 用途 | 示例 |
|------|------|------|
| `feat:` | 功能更新 | `feat: 集成融通金行情数据，支持三种数据源切换` |
| `fix:` | Bug 修复 | `fix: 修复库存扣减负数问题` |
| `test:` | 测试相关 | `test: 新增收银台 E2E 测试` |
| `ci:` | CI/CD / 部署 | `ci: 升级 docker/build-push-action@v6` |
| `refactor:` | 重构 | `refactor: 统一错误处理中间件` |
| `chore:` | 杂项（依赖更新等） | `chore: 更新 Playwright 至 1.59` |

> **⚠️ 注意**：`git commit -m "message"` 在 PowerShell 中直接使用双引号，**不要** 使用 bash heredoc 语法 `$(cat <<'EOF'...EOF)` —— PowerShell 不支持。

**检查命令**：

```bash
# 查看 PR 的所有 commit（以 PR 编号 42 为例）
gh pr view 42 --json commits --jq '.commits[].messageHeadline'

# 检查最近的 commit message 是否符合格式
git log --oneline -5

# 正则检查最近 10 个 commit message
git log --format=%s -10 | Select-String -Pattern '^(feat|fix|test|ci|refactor|chore)(\(.+\))?:\s' -NotMatch
```

**判定标准**：
- 所有 commit message 以 `feat:` `fix:` `test:` `ci:` `refactor:` `chore:` 之一开头（可选 scope `()`） -> ✅ 通过
- 任何一条不符合 -> ❌ 不通过（需修复）

### 维度 2：分支命名规范

**检查内容**：分支名是否符合 `<type>/<description>` 格式。

**项目规范**：

| type | 用途 | 示例 |
|------|------|------|
| `feature/` | 新功能 | `feature/checkout-flow` |
| `bugfix/` | Bug 修复 | `bugfix/inventory-negative` |
| `hotfix/` | 紧急修复 | `hotfix/login-500-error` |
| `refactor/` | 重构 | `refactor/error-handler` |
| `test/` | 测试 | `test/e2e-checkout` |
| `chore/` | 杂项 | `chore/update-deps` |

**检查命令**：

```bash
# 查看当前分支名
git branch --show-current

# 查看 PR 对应的分支
gh pr view 42 --json headRefName --jq '.headRefName'

# 正则匹配分支名
$branch = git branch --show-current
if ($branch -match '^(feature|bugfix|hotfix|refactor|test|chore)/.+') {
  echo "分支名规范 ✅: $branch"
} else {
  echo "分支名不规范 ❌: $branch"
}
```

**判定标准**：
- 匹配 `^(feature|bugfix|hotfix|refactor|test|chore)/` -> ✅ 通过
- 使用 `main`、`master` 或无名分支直接提交 -> ❌ 不通过
- 不符合格式 -> ❌ 不通过

### 维度 3：代码 Lint/Format

**检查内容**：ESLint 是否通过，代码风格是否一致。

**检查命令**：

```bash
# 先暂存当前工作区（避免未提交的修改干扰检查）
git stash push -m "temp-before-lint-check"

# 切换到 PR 分支
gh pr checkout 42

# 运行 Lint 检查
pnpm lint --quiet

# 如果 Lint 失败，查看具体错误
pnpm lint

# 恢复工作区
git stash pop
```

**判定标准**：
- `pnpm lint --quiet` 退出码为 0 -> ✅ 通过
- 有 Lint 错误 -> ❌ 不通过（列出错误数量和关键错误）

### 维度 4：类型检查

**检查内容**：TypeScript 编译是否通过。

**检查命令**：

```bash
# 运行 TypeScript 类型检查（通过构建验证）
pnpm build 2>&1

# 或使用 tsc 直接检查（更快速）
npx tsc --noEmit 2>&1
```

**判定标准**：
- `pnpm build` 成功退出 -> ✅ 通过
- 构建失败 -> ❌ 不通过（提取关键错误类型：类型错误 / 模块找不到 / 语法错误）

### 维度 5：PR 描述完整性

**检查内容**：PR 描述是否填写完整，是否包含必要信息。

**本项目 PR 模板要求**：

```markdown
## 变更说明
<!-- 简述变更内容 -->

## 变更等级
<!-- S1/S2/S3/S4/S5 -->

## 涉及文件
- [ ] 前端文件
- [ ] 后端文件
- [ ] 数据库 Schema

## 回滚方案
- 代码回滚：
- 功能开关：
- 数据恢复：

## 不影响的核心功能
- [ ] 库存管理
- [ ] 销售出库
- [ ] 批次管理
- [ ] 客户管理
- [ ] 系统设置
- [ ] 仪表盘

## 回归验证
- [ ] pnpm lint --quiet 通过
- [ ] pnpm build 通过
- [ ] E2E 全部通过
```

**检查命令**：

```bash
# 获取 PR 描述
gh pr view 42 --json body --jq '.body'

# 检查关键字段是否存在
$body = gh pr view 42 --json body --jq '.body'

# 检查变更说明
if ($body -match '## 变更说明') { echo "变更说明 ✅" } else { echo "变更说明 ❌" }

# 检查变更等级
if ($body -match '## 变更等级') { echo "变更等级 ✅" } else { echo "变更等级 ❌" }

# 检查回滚方案
if ($body -match '## 回滚方案') { echo "回滚方案 ✅" } else { echo "回滚方案 ❌" }

# 检查回归验证
if ($body -match '## 回归验证') { echo "回归验证 ✅" } else { echo "回归验证 ❌" }
```

**判定标准**：
- 包含变更说明、变更等级、回滚方案、回归验证 4 个核心段落 -> ✅ 通过
- 缺失任何核心段落 -> ❌ 不通过
- PR 描述完全为空 -> ❌ 不通过

### 维度 6：CI 流水线状态

**检查内容**：GitHub Actions 各 job 是否全部通过。

**检查命令**：

```bash
# 获取 PR 的 CI 状态
gh pr view 42 --json statusCheckRollup --jq '.statusCheckRollup[] | "\(.conclusion) \(.name)"'

# 汇总 CI 结果
$checks = gh pr view 42 --json statusCheckRollup --jq '.statusCheckRollup[] | .conclusion'
$failed = $checks | Where-Object { $_ -eq 'FAILURE' -or $_ -eq 'CANCELLED' }
$pending = $checks | Where-Object { $_ -eq 'PENDING' -or $_ -eq 'EXPECTED' }

if ($failed) {
  echo "CI 失败 ❌: $($failed.Count) 个 job 失败"
} elseif ($pending) {
  echo "CI 运行中 ⏳: $($pending.Count) 个 job 待完成"
} else {
  echo "CI 全部通过 ✅"
}
```

**判定标准**：
- 所有 statusCheckRollup 的 conclusion 为 `SUCCESS` -> ✅ 通过
- 存在 `FAILURE` 或 `CANCELLED` -> ❌ 不通过
- 存在 `PENDING` 或 `EXPECTED` -> ⏳ 等待（告知用户待检查项）

### 维度 7：敏感信息泄露检查

**检查内容**：提交中是否包含密码、密钥、Token、环境变量等敏感信息。

**检查命令**：

```bash
# 获取 PR 的 diff
gh pr diff 42 > $env:TEMP\pr-diff.txt

# 检查常见敏感信息模式
$patterns = @(
  'password\s*[:=]\s*\S+',
  'secret\s*[:=]\s*\S+',
  'token\s*[:=]\s*\S+',
  'api[_-]?key\s*[:=]\s*\S+',
  'DATABASE_URL\s*[:=]',
  'JWT_SECRET\s*[:=]',
  '-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----',
  'ghp_[A-Za-z0-9]{36}',
  'sk-[A-Za-z0-9]{32,}'
)

$diff = Get-Content $env:TEMP\pr-diff.txt -Raw
$found = @()
foreach ($pattern in $patterns) {
  if ($diff -match $pattern) {
    $found += $pattern
  }
}

if ($found.Count -gt 0) {
  echo "发现敏感信息 ❌: $($found.Count) 个匹配模式"
  # 不输出具体匹配内容（避免二次泄露）
  echo "请人工审查以下模式: $($found -join ', ')"
} else {
  echo "未发现常见敏感信息 ✅"
}

# 清理临时文件
Remove-Item $env:TEMP\pr-diff.txt -Force
```

> **安全说明**：上述命令只在本地临时文件中检查模式匹配，不会将敏感信息发送到外部。匹配到的行不直接输出内容，仅输出匹配模式类型。

**判定标准**：
- 未发现匹配模式 -> ✅ 通过
- 发现匹配模式 -> ❌ 不通过（需人工确认是否误报，再执行清除）

---

## 3. 排查报告模板

执行完所有 7 项排查后，输出结构化报告：

```markdown
## gh-pr-compliance 排查报告

**PR 编号**：#{PR_NUMBER}
**PR 标题**：{PR_TITLE}
**分支**：{HEAD_BRANCH} → {BASE_BRANCH}
**执行时间**：{YYYY-MM-DD HH:mm}
**执行 Agent**：{AGENT_NAME}

### 七项排查结果

| # | 维度 | 结果 | 说明 |
|---|------|:----:|------|
| 1 | Commit Message 格式 | ✅/❌ | 违规数 / 详情 |
| 2 | 分支命名规范 | ✅/❌ | 分支名 / 问题描述 |
| 3 | 代码 Lint/Format | ✅/❌ | 错误数 / 关键错误 |
| 4 | 类型检查 | ✅/❌ | 错误数 / 关键错误 |
| 5 | PR 描述完整性 | ✅/❌ | 缺失段落 |
| 6 | CI 流水线状态 | ✅/❌/⏳ | 失败 job 列表 |
| 7 | 敏感信息泄露 | ✅/❌ | 匹配模式类型 |

### 综合判定

- [ ] **全部通过** — 可进入 Level 2 代码审查
- [ ] **有条件通过** — 非阻塞问题已记录，可并行修复
- [ ] **阻塞** — 必须修复后才能进入下一环节

### 修复建议

{针对每个 ❌ 项给出具体修复命令和步骤}

### SOP 衔接

- [ ] Level 1 通过 → 通知 code-review / TRAE-security-review 执行 Level 2
- [ ] CI 失败 → 通知 gh-fix-ci 修复
- [ ] 敏感信息泄露 → 通知人工介入清除
```

---

## 4. 问题修复指引

### 4.1 Commit Message 修复

```bash
# 修复最近一个 commit message
git commit --amend -m "feat: 正确的提交信息"

# 修复多个 commit（交互式变基）
git rebase -i HEAD~N
# 将需要修改的 commit 前的 pick 改为 reword
# 保存后依次修改每个 commit message

# 修复后强制推送（注意：仅适用于个人 feature 分支）
git push --force-with-lease
```

### 4.2 分支命名修复

```bash
# 在当前分支基础上创建符合规范的新分支
git branch -m feature/checkout-flow

# 推送新分支并关联
git push -u origin feature/checkout-flow

# 关闭旧 PR，在正确分支上创建新 PR
gh pr create --base main --head feature/checkout-flow --title "PR标题" --body "PR描述"
```

### 4.3 Lint/类型错误修复

```bash
# 查看具体 Lint 错误
pnpm lint

# 自动修复可修复的错误
npx next lint --fix

# 类型错误需手动修复，常见情况：
# - 缺失类型定义 → 添加 interface/type
# - 可选链调用 → 添加 ?. 或 ?? 默认值
# - 未使用的变量 → 删除或加 _ 前缀
```

### 4.4 PR 描述补充

```bash
# 编辑 PR 描述
gh pr edit 42 --body "$(cat <<'EOF'
## 变更说明
...
EOF
)"
```

### 4.5 敏感信息清除

```bash
# 如果敏感信息已提交，使用 git filter-branch 或 BFG Repo-Cleaner
# 警告：以下操作会重写 git 历史，影响所有协作者

# 方法 1：使用 git filter-branch
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <包含敏感信息的文件>" \
  --prune-empty --tag-name-filter cat -- --all

# 方法 2：删除文件后重写历史
git rebase -i HEAD~N
# 标记相关 commit 为 edit，然后修改文件并 git add + git commit --amend

# 强制推送
git push --force-with-lease

# 重要：立即在 GitHub 上撤销暴露的密钥/Token
```

---

## 5. SOP 衔接点

### 5.1 与 gh-fix-ci 的衔接

本技能发现 CI 失败时**不处理修复**，仅报告：

```markdown
[CI-FAILURE] PR #{N} CI 检测到 {N} 个 job 失败
→ 通知 gh-fix-ci 技能执行 CI 修复流程
```

`gh-fix-ci` 的触发条件：
- `gh pr view {N} --json statusCheckRollup` 中存在 `FAILURE` 或 `CANCELLED`
- 本技能负责将失败 context 传递给 gh-fix-ci

### 5.2 与 gh-address-comments 的衔接

本技能检查 PR Review 完成度（维度 5），但**不处理评审意见**：

```markdown
[REVIEW-STATUS] PR #{N} Review 完成度：{X/Y 已通过}
→ PR 描述完整后，通知 gh-address-comments 进入 Level 3
```

### 5.3 与 code-review / TRAE-security-review 的衔接

本技能是 **前置门禁**，所有维度通过后方可进入代码审查：

```markdown
[LEVEL1-PASSED] PR #{N} 提交规范检查全部通过
→ 通知 SOLO Coder 调度 code-review 或 TRAE-security-review 执行 Level 2
```

### 5.4 质量标准一览

```
PR 提交
  │
  ├─→ Level 1: gh-pr-compliance（本技能）
  │       7 项维度全部通过?
  │       ├─ ✅ → 进入 Level 2
  │       ├─ ❌ CI 失败 → 通知 gh-fix-ci
  │       └─ ❌ 其他 → 通知开发修复 → 重新检查
  │
  ├─→ Level 2: code-review / TRAE-security-review
  │       代码质量 + 安全审查通过?
  │       ├─ ✅ → 进入 Level 3
  │       └─ ❌ → 通知开发修复
  │
  └─→ Level 3: gh-address-comments
          评审意见全部处理完成?
          ├─ ✅ → 可合并
          └─ ❌ → 逐一处理评论
```

---

## 6. 一键排查命令（快速执行全部 7 项）

以下命令一次性完成所有排查，适合自动化场景：

```powershell
# ============================================
# gh-pr-compliance 一键排查脚本
# ============================================
param([string]$PR_NUMBER)

# 设置代理
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
$env:HTTP_PROXY = "http://127.0.0.1:7897"

$results = @{}
$results["PR"] = $PR_NUMBER

# 维度 1: Commit Message
$commits = gh pr view $PR_NUMBER --json commits --jq '.commits[].messageHeadline'
$badCommits = $commits | Where-Object { $_ -notmatch '^(feat|fix|test|ci|refactor|chore)(\(.+\))?:\s' }
$results["commit_message"] = if ($badCommits.Count -eq 0) { "✅" } else { "❌ $($badCommits.Count) 条不合规" }

# 维度 2: 分支命名
$branch = gh pr view $PR_NUMBER --json headRefName --jq '.headRefName'
$results["branch_name"] = if ($branch -match '^(feature|bugfix|hotfix|refactor|test|chore)/.+') { "✅ $branch" } else { "❌ $branch" }

# 维度 5: PR 描述
$body = gh pr view $PR_NUMBER --json body --jq '.body'
$missing = @()
if ($body -notmatch '## 变更说明') { $missing += "变更说明" }
if ($body -notmatch '## 变更等级') { $missing += "变更等级" }
if ($body -notmatch '## 回滚方案') { $missing += "回滚方案" }
if ($body -notmatch '## 回归验证') { $missing += "回归验证" }
$results["pr_body"] = if ($missing.Count -eq 0) { "✅" } else { "❌ 缺失: $($missing -join ', ')" }

# 维度 6: CI 状态
$checks = gh pr view $PR_NUMBER --json statusCheckRollup --jq '.statusCheckRollup[] | .conclusion'
$failed = $checks | Where-Object { $_ -eq 'FAILURE' -or $_ -eq 'CANCELLED' }
$pending = $checks | Where-Object { $_ -eq 'PENDING' -or $_ -eq 'EXPECTED' }
if ($failed.Count -gt 0) {
  $results["ci_status"] = "❌ $($failed.Count) job 失败"
} elseif ($pending.Count -gt 0) {
  $results["ci_status"] = "⏳ $($pending.Count) job 运行中"
} else {
  $results["ci_status"] = "✅"
}

# 输出结果
$results | ConvertTo-Json
```

---

## 7. 使用场景与触发时机

| 场景 | 触发者 | 操作 |
|------|--------|------|
| PR 创建后自动检查 | SOLO Coder（通过 webhook 或手动） | 执行全部 7 项排查 → 输出报告 |
| Commit 推送后增量检查 | SOLO Coder | 仅检查维度 1/3/4（增量变更） |
| 合入前最终门禁 | SOLO Coder | 全量检查 → 全部通过方可合入 |
| CI 失败时 | SOLO Coder | 仅检查维度 6 → 通知 gh-fix-ci |
| 周期性巡检 | SOLO Coder | 检查所有 Open PR 的规范合规性 |

---

## 8. 跨技能边界矩阵

| 技能 | 本技能做什么 | 对方做什么 | 接力条件 |
|------|------------|-----------|---------|
| gh-fix-ci | 发现 CI 失败 | 修复 CI 失败 | 本技能报告 CI_FAILURE |
| gh-address-comments | 检查 PR Review 完成度 | 逐一处理评审评论 | 本技能确认 PR 描述完整 |
| code-review | 做元检查（格式/规范） | 做内容审查（业务逻辑/安全） | 本技能 7 项全部通过 |
| TRAE-security-review | 做元检查（敏感信息初步筛查） | 做深度安全审查 | 本技能维度 7 通过 |

---

## 9. 注意事项

1. **代理问题**：Windows 环境下 gh CLI 可能不走系统代理，务必在每次排查前设置 `$env:HTTPS_PROXY`
2. **权限要求**：执行 `gh pr diff` 需要对该仓库有读取权限
3. **误报处理**：维度 7 的敏感信息检测基于正则模式匹配，可能产生误报（如代码中包含 `password` 变量名而非真实密码），需人工二次确认
4. **大 PR 性能**：对于变更文件超过 50 个的 PR，维度 3（Lint）和维度 4（类型检查）可能会较慢，建议只检查增量文件
5. **分支保护**：维度 2 检查到 `main` 或 `master` 分支直接修改时，应立即告警并阻止
