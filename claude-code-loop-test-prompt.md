# Claude Code 循环测试提示词 — 翡翠 ERP 全功能清单盘点

> 把这段提示词完整复制粘贴给 Claude Code（在项目根目录 `d:\02工作\ERP\newjade` 下运行）。

---

## 📋 任务定义

你是翡翠进销存 ERP 系统的循环测试工程师。本次任务**不是修 Bug**，而是**全功能盘点**：通过循环遍历系统所有功能，形成完整功能清单，比对 PRD 与记忆文件，验证三维度——**可用 / 业务流无误 / 好用**。

### 三维度定义

| 维度 | 判定标准 |
|------|---------|
| **1. 可用** | 功能能正常打开、加载、响应；无 500/403/控制台红错；无白屏崩溃 |
| **2. 业务流无误** | 端到端流程跑通（如：入库→调价→销售→退货→看板统计）；数据流转正确；状态机正确 |
| **3. 好用** | 交互符合直觉；提示清晰；错误信息友好；无歧义按钮；移动端可用 |

### 输出物

1. **功能清单表**（Markdown 表格，按模块分组）
2. **PRD 比对表**（PRD 列出的功能 vs 实际实现状态）
3. **记忆文件比对表**（handover.md 中记录的功能 vs 实际可用状态）
4. **问题清单**（按严重度分级：阻塞 / 高 / 中 / 低）
5. **测试覆盖率统计**（已测功能数 / 应测功能数）

---

## 🚧 边界约束（强制）

- **❌ 禁止修改任何源代码**（src/、prisma/、scripts/）
- **❌ 禁止修改数据库数据**（只读测试，不创建/编辑/删除真实业务数据；如需测试创建流程，使用明显测试名如"ZZ测试-XXX"并在测试结束后清理）
- **❌ 禁止 git commit / push**
- **✅ 允许启动开发服务器**（`pnpm run dev`，端口 5000）
- **✅ 允许调用 API 探测功能**（curl / Invoke-WebRequest，带 admin token）
- **✅ 允许使用 Playwright MCP / Chrome DevTools MCP 做浏览器测试**
- **✅ 允许读取 PRD.md / .trae/memory/ / .understand-anything/ 等文档**
- **遇到 Bug 只记录不修复**，记录格式：`[FINDING:BLOCKER/HIGH/MEDIUM/LOW] 模块.功能 - 现象 - 复现步骤 - 预期 - 实际`

---

## 🔄 循环测试策略

采用**模块遍历 + 深度优先**循环：

```
Loop:
  For each 模块 in [看板, 库存, 销售, 批次, 客户, 供应商, 贵金属市价, 促销, 盘点, 入货建议, 系统设置, 操作日志, 内容推广, 扫码拍摄, 收银台, 备份恢复, 数据导入导出, 标签打印, 认证权限]:
    1. 进入模块入口（Tab 切换 / 路由跳转）
    2. 遍历该模块所有子功能（按 PRD §3 + handover 记录）
    3. 对每个子功能执行三维度验证
    4. 记录结果到测试报告
    5. 截图存证（关键页面 + 异常页面）
    6. 比对 PRD 与 handover，标记差异
  End For
  汇总统计 → 输出最终报告
```

**循环退出条件**：所有模块的所有子功能都已验证，且无遗漏。

**每轮循环结束**：输出本轮进度（已测 X/Y 模块），等待用户确认继续或停止。

---

## 📚 参考文档（测试前必读）

按以下顺序读取，建立功能基线：

1. `PRD.md` — 产品需求文档（14 个核心模块 + 拓展功能）
2. `.trae/memory/handover.md` — 历次交付记录（最新功能清单）
3. `.trae/memory/architecture.md` — 系统架构（30 张表、60+ API）
4. `.trae/memory/api-contracts.md` — API 接口契约
5. `.trae/memory/current-sprint.md` — 当前 Sprint 状态
6. `.understand-anything/knowledge-graph.json` — 文件依赖图谱

---

## 🎯 测试清单（基于 PRD + handover 汇总）

### 模块 1：利润看板（Dashboard）

**PRD 要求**：8 个核心指标卡片 + 21 个图表 + 时间筛选（月/季/年/全部/自定义）

**子功能清单**：
- [ ] 8 个指标卡片加载（今日利润/平均周转天数/在库数量/在库价值/本月销售/本月利润/客户总数/批次数量）
- [ ] 数据概览卡片（handover 2026-06-10 新增：货品/销售/客户/批次/DB大小）
- [ ] 23 个图表 API 加载（/api/dashboard/*）
- [ ] 时间筛选切换（月度/季度/年度/全部/自定义）
- [ ] 材质筛选
- [ ] data-testid 存在性（dashboard-card-total-items 等 6 个）
- [ ] 移动端响应式

### 模块 2：库存管理

**PRD 要求**：货品 CRUD + 图片 + 标签 + 筛选 + 批量操作

**子功能清单**：
- [ ] 货品列表加载（分页/排序）
- [ ] 多条件筛选（材质大类/材质/状态/关键词/柜台/批次/价格区间/采购日期）
- [ ] 创建货品 — 高货模式（手动填成本价）
- [ ] 创建货品 — 通货模式（关联批次，自动分摊）
- [ ] 编辑货品（含材质/器型修改，handover 2026-06-08）
- [ ] 删除货品（软删除）
- [ ] 查看详情弹窗
- [ ] 图片管理（上传/删除/设封面/多角度）
- [ ] 标签管理（添加/移除）
- [ ] 出库销售（单件）
- [ ] 批量出库
- [ ] 批量恢复库存
- [ ] 批量删除
- [ ] 批量修改柜台号
- [ ] 导出标签数据（CSV，handover 2026-06-05）
- [ ] 完整导出（fetch + token，handover 2026-06-17 修复）
- [ ] 扫码枪 HID 模式（handover 2026-06-19）
- [ ] 摄像头扫码（Code-128，handover 2026-06-19）
- [ ] 批量补图入口（handover 2026-06-05）
- [ ] 扫码拍摄模式（handover 2026-06-16）
- [ ] 临时拍照模式（先拍后录）
- [ ] 移动端卡片视图

### 模块 3：销售管理

**PRD 要求**：销售登记 + 退货处理 + 套装销售

**子功能清单**：
- [ ] 销售列表加载
- [ ] 单件销售流程（选货品→填价→选渠道→选客户→选日期→提交）
- [ ] 底价校验（actualPrice < floorPrice 拒绝，handover 2026-06-09 修复）
- [ ] 销售渠道（store/wechat）
- [ ] 客户异步搜索（手机/姓名/微信）
- [ ] 退货流程（货品状态 sold→returned）
- [ ] 套装销售（BundleSale，多件分摊）
- [ ] 收银台模式（feature_checkout_enabled，3 步流程，handover 2026-06-02）
  - [ ] Step 1 选客户（最近 6 个客户）
  - [ ] Step 2 选货品（扫码/搜索/手动）
  - [ ] Step 3 收款确认（5 种支付方式/抹零/打折）
- [ ] Tab 切换退出收银台（handover 2026-06-09）

### 模块 4：批次管理

**PRD 要求**：批次创建 + 成本分摊（equal/by_weight/by_price）

**子功能清单**：
- [ ] 批次列表加载
- [ ] 创建批次（快速模式/完整模式）
- [ ] 批次编码自动生成（B{类别码}{月日}{序号}）
- [ ] 供应商关联
- [ ] 成本分摊 — equal（均分）
- [ ] 成本分摊 — by_weight（按重量）
- [ ] 成本分摊 — by_price（按售价）
- [ ] allocate 自动补建货品（handover 2026-06-09 修复）
- [ ] 批次详情弹窗
- [ ] 批次内货品列表

### 模块 5：客户管理

**PRD 要求**：客户档案 + 搜索（手机/姓名/微信）

**子功能清单**：
- [ ] 客户列表加载
- [ ] 创建客户
- [ ] 编辑客户
- [ ] 删除客户
- [ ] 搜索（手机/姓名/微信）
- [ ] 客户标签（JSON 数组）
- [ ] 最近客户 API（sort=lastPurchaseAt，handover 2026-06-02）

### 模块 6：供应商管理

**子功能清单**：
- [ ] 供应商列表（设置 Tab 内）
- [ ] 创建/编辑/删除供应商
- [ ] 入库弹窗内嵌快速新增（handover Sprint-002）
- [ ] Dialog 内聚到 suppliers-panel（handover 2026-06-10）

### 模块 7：贵金属市价管理

**handover 2026-06-24 完整模块**（PRD 之外拓展）

**子功能清单**：
- [ ] 行情自动加载（5 分钟定时 + 9/12/18 点窗口）
- [ ] 新鲜度指示（🟢5分钟 / 🟡30分钟 / ⚫过时）
- [ ] 日变动指示（↑↓箭头 + 差额，红涨绿跌）
- [ ] 上次调价显示 + 偏离≥2% 预警
- [ ] 一键同步（批量同步 costPerGram 为行情价）
- [ ] 每日分享（3 张海报：本日报价/价格优势/行情走势）
- [ ] 行情走势图（黄金/白银/铂金三线，7/30/90/1年）
- [ ] 价格历史（涨跌列 + 删除 + 分页）
- [ ] 预览调价（无行情价时 disabled）
- [ ] 竞品对比（个体排名 + 复制图表）
- [ ] 融通金行情面板（gzjn168.com）
- [ ] 行情源切换（自动/融通金/探数API）
- [ ] 强制刷新（POST /api/metal-prices/refresh）
- [ ] 删除价格记录（DELETE /api/metal-prices）
- [ ] 多材质日期范围查询（history API）

### 模块 8：促销管理

**PRD §10.1.2** + handover 2026-06-09

**子功能清单**：
- [ ] 促销列表加载
- [ ] 创建促销（discount/满减/赠品/套餐）
- [ ] 促销商品筛选辅助（历史销量/库存/周转率）
- [ ] 促销效果预测
- [ ] 促销状态管理（draft/active/paused/ended）

### 模块 9：盘点管理

**PRD §10.2.1**

**子功能清单**：
- [ ] 创建盘点计划（regular/random）
- [ ] 盘点明细录入
- [ ] 盘点报告生成

### 模块 10：入货建议

**PRD §10.2.1 智能入货算法**

**子功能清单**：
- [ ] 入货建议列表加载
- [ ] 多维度筛选（价格带/器型/材质/库龄/周转率/销售热度）
- [ ] 建议展示（推荐商品/数量/金额/预期周期）

### 模块 11：系统设置

**PRD §3.10** + handover 多次重构

**子功能清单**：
- [ ] 字典管理 — 材质（含三级级联：大类→子类→材质）
- [ ] 字典管理 — 器型（按材质过滤）
- [ ] 字典管理 — 标签（含分组/材质关联）
- [ ] 材质即时重复检测（handover 2026-06-05）
- [ ] 贵金属材质锁定（Lock 图标，handover 2026-06-05）
- [ ] 克重定价合并到材质编辑（handover 2026-06-10）
- [ ] 系统配置（Key-Value，含搜索框）
- [ ] 密码修改面板（独立，含强度指示器）
- [ ] 首次登录强制改密弹窗（mustChangePwd）
- [ ] 数据导入（CSV + 标准导入合并）
- [ ] 用户管理（含速率限制）
- [ ] 角色管理（RBAC，30+ 权限 key）
- [ ] 数据库备份下载
- [ ] 数据库恢复上传

### 模块 12：操作日志

**子功能清单**：
- [ ] 日志列表加载
- [ ] 按 action 筛选
- [ ] 按 targetType 筛选
- [ ] 登录审计日志（login_success/login_failed，handover 2026-06-08）
- [ ] 配置变更审计日志（update_config，含脱敏）
- [ ] 密码变更审计日志（change_password/reset_password）

### 模块 13：内容推广（OpenClaw 选题）

**handover 2026-06-23 新模块**

**子功能清单**：
- [ ] 选题列表加载
- [ ] 选题状态管理（analyzed 等）
- [ ] aiMetadata v2 字段展示
- [ ] 库存摘要 API（GET /api/content/items/summary）

### 模块 14：认证与权限

**handover Sprint-011 + Sprint-015**

**子功能清单**：
- [ ] 登录页面
- [ ] 登录成功（admin/admin123）
- [ ] 登录失败 — 用户不存在
- [ ] 登录失败 — 密码错误
- [ ] 登录失败 — 用户禁用
- [ ] 7 天会话有效期
- [ ] 退出登录
- [ ] 全局限流（100/min/IP）
- [ ] 创建用户限流（5次/30分钟）
- [ ] 重置密码限流（5次/30分钟）
- [ ] 密码复杂度校验（8位+大小写+数字+特殊字符）
- [ ] RBAC 权限守卫（guardPermission）
- [ ] 中间件安全头（X-Content-Type-Options/X-Frame-Options/Referrer-Policy）
- [ ] 请求体大小限制（10KB for auth/users）

### 模块 15：数据导入导出

**子功能清单**：
- [ ] CSV 导入货品
- [ ] CSV 导入客户
- [ ] 导出货品 CSV
- [ ] 导出销售记录
- [ ] 导出操作日志
- [ ] 导出标签数据 CSV（微打 App 用）
- [ ] 标签打印 API（GET /api/print/labels）

### 模块 16：备份恢复

**子功能清单**：
- [ ] 下载数据库备份（GET /api/backup）
- [ ] 上传恢复（POST /api/backup）
- [ ] 权限校验（action:user_manage）

---

## 🛠️ 执行步骤

### Step 0：环境准备

```powershell
# 1. 确认在项目根目录
pwd  # 应为 d:\02工作\ERP\newjade

# 2. 启动开发服务器（后台运行）
pnpm run dev
# 等待 "Ready in xxx ms" 输出

# 3. 验证服务器可用
Invoke-WebRequest -Uri http://localhost:5000 -UseBasicParsing
```

### Step 1：建立功能基线

读取以下文档，提取完整功能清单：
- `PRD.md`
- `.trae/memory/handover.md`
- `.trae/memory/architecture.md`

输出：`测试报告/00-功能基线.md`（含 PRD 列出的功能 + handover 记录的拓展功能）

### Step 2：API 探测（无 UI）

用 curl/Invoke-WebRequest 探测所有 API 端点可用性：

```powershell
# 登录获取 token
$resp = Invoke-WebRequest -Uri http://localhost:5000/api/auth/login -Method POST -Body '{"username":"admin","password":"admin123"}' -ContentType "application/json"
$token = ($resp.Content | ConvertFrom-Json).data.token

# 探测关键 API
$headers = @{ Authorization = "Bearer $token" }
Invoke-WebRequest -Uri http://localhost:5000/api/dashboard/summary -Headers $headers
# ... 遍历所有 API
```

输出：`测试报告/01-API探测结果.md`

### Step 3：UI 循环测试（使用 Playwright MCP 或浏览器）

按"测试清单"逐模块验证，每模块输出：
- `测试报告/02-模块N-{模块名}.md`

每份模块报告包含：
```markdown
## 模块 N：XXX

### 子功能测试结果

| # | 子功能 | 可用 | 业务流 | 好用 | 备注 |
|---|--------|:----:|:------:|:----:|------|
| 1 | XXX | ✅/❌ | ✅/❌ | ✅/❌ | ... |

### 截图
- 正常页面：screenshots/module-N-normal.png
- 异常页面：screenshots/module-N-error.png

### 发现的问题
- [FINDING:LEVEL] 模块.功能 - 现象 - 复现步骤 - 预期 - 实际

### PRD/handover 比对
- PRD 要求：XXX
- 实际实现：XXX
- 差异：无 / 描述差异
```

### Step 4：业务流端到端验证

挑选 5 条核心业务流跑通：

1. **高货全生命周期**：创建高货→上传图→贴标签→调价→销售→退货→看板统计
2. **通货批次流**：创建批次→关联供应商→创建货品→分摊成本→销售→看板
3. **贵金属流**：获取行情→一键同步→预览调价→确认→历史记录→每日分享
4. **客户流**：创建客户→搜索→销售关联→退货→看板客户排行
5. **权限流**：admin 登录→创建 manager 用户→分配权限→manager 登录→验证权限边界

输出：`测试报告/03-业务流验证.md`

### Step 5：汇总报告

输出：`测试报告/99-最终报告.md`，包含：

1. **功能清单总表**（所有模块的所有子功能）
2. **三维度统计**：
   - 可用率：X/Y (Z%)
   - 业务流正确率：X/Y (Z%)
   - 好用率：X/Y (Z%)
3. **PRD 比对表**：
   - PRD 列出功能数：N
   - 已实现：M
   - 未实现：N-M
   - 超出 PRD 的拓展功能：K（来自 handover）
4. **问题清单**（按严重度排序）
5. **测试覆盖率**：已测功能数 / 应测功能数
6. **建议**（不修代码，只提建议）

---

## 📊 报告格式约定

### 问题等级

| 等级 | 含义 | 示例 |
|------|------|------|
| BLOCKER | 阻塞使用，无法继续 | 白屏、500 错误、登录失败 |
| HIGH | 严重影响业务 | 数据丢失、流程断裂、权限绕过 |
| MEDIUM | 影响体验但可绕过 | 按钮 disabled 异常、提示不清 |
| LOW | 小瑕疵 | 文案错别字、对齐问题 |

### 截图命名

`screenshots/{模块编号}-{子功能}-{状态}.png`
- 状态：normal / error / mobile / desktop

---

## ⏸️ 循环控制

- **每完成 1 个模块**：暂停，输出"模块 N 完成，进度 X/Y，是否继续？"
- **遇到 BLOCKER**：立即停止当前模块，记录后跳到下一模块
- **遇到需要用户决策**：暂停询问
- **全部完成**：输出最终报告，等待用户确认

---

## 🎯 启动指令

现在开始执行：
1. 先读取 PRD.md 和 .trae/memory/handover.md 建立功能基线
2. 启动开发服务器（如未启动）
3. 从模块 1（利润看板）开始循环测试
4. 每完成一模块暂停汇报

**记住**：你是测试工程师不是开发，**只测不修**。发现问题记录到报告即可。

---

## 附录：常用命令速查

```powershell
# 启动开发服务器
pnpm run dev

# 检查端口
netstat -ano | findstr :5000

# 登录获取 token
$body = '{"username":"admin","password":"admin123"}'
$resp = Invoke-WebRequest -Uri http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json"
$token = ($resp.Content | ConvertFrom-Json).data.token

# 带 token 调用 API
$headers = @{ Authorization = "Bearer $token" }
Invoke-WebRequest -Uri http://localhost:5000/api/dashboard/summary -Headers $headers

# 停止开发服务器（如需）
# 找到 node 进程 PID 后 Stop-Process -Id <PID>
```
