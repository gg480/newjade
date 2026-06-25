# PRD v0.3 假设评审报告

> 评审日期：2026-06-19
> 评审对象：`docs/PRD-内容推广管理.md` v0.3
> 评审方法：网络搜索验证 + 技术可行性分析

---

## 一、评审结论摘要

| 类别 | 数量 | 严重程度 |
|------|------|---------|
| ✅ 已验证为真 | 7 项 | - |
| ⚠️ 需要修正 | 6 项 | 中 |
| 🔴 虚假假设 | 2 项 | 高 |
| 🟡 未经验证的产品设计 | 4 项 | 中 |

**总体评价**：PRD v0.3 的核心架构方向正确，但存在 2 个虚假假设（xiaohongshu-skills 仓库、xiaohongshu-downloader 仓库）和 6 个需要修正的数据点。建议修正后进入开发阶段。

---

## 二、已验证为真的假设 ✅

### 1. OpenClaw（龙虾）确实存在

- **验证结果**：✅ 真实存在
- **开发者**：Peter Steinberger
- **发布时间**：2025年11月
- **性质**：开源AI代理框架，本地运行
- **支持模型**：12+ 提供商（Claude、GPT、Kimi、Grok、DeepSeek等）
- **GitHub Stars**：157K+（截至2026年初）
- **来源**：[IMDA案例研究](https://www.imda.gov.sg/)、[aiskill.market](https://aiskill.market/blog/what-is-openclaw-open-source-ai-assistant)

### 2. ClawHub 确实存在

- **验证结果**：✅ 真实存在
- **地址**：clawhub.ai
- **性质**：OpenClaw官方skill注册表（"npm for AI agents"）
- **skill数量**：3,286个（2026年2月ClawHavoc事件清理后）
- **安装方式**：`npx clawhub@latest install <skill-slug>` 或 `openclaw skills install <name>`
- **来源**：[claw-hub.net](https://claw-hub.net/)、[allclaw.org](https://allclaw.org/entry/clawhub)

### 3. agent-browser 确实存在

- **验证结果**：✅ 真实存在
- **开发者**：Vercel Labs
- **GitHub**：github.com/vercel-labs/agent-browser
- **许可证**：Apache-2.0
- **安装方式**：`npm install -g agent-browser` + `agent-browser install`
- **技术栈**：Rust原生二进制 + Node.js回退
- **来源**：[agent-browser.dev](https://agent-browser.dev/installation)

### 4. baidu-search skill 确实存在

- **验证结果**：✅ 真实存在
- **作者**：ide-rea（百度官方）
- **地址**：clawhub.ai/ide-rea/baidu-search
- **需要**：百度AI搜索API Key（BAIDU_API_KEY）
- **能力**：基础检索、学术检索、百科检索，支持时间筛选（pd/pw/pm/py）和结果数量（1-50）
- **来源**：[CSDN百度官方Skills](https://blog.csdn.net/weixin_48493350/article/details/157924009)、[toolify.ai](https://www.toolify.ai/openclaw-skills/test-01-43501)

### 5. Multi Search Engine skill 确实存在

- **验证结果**：✅ 真实存在（但引擎数量需修正）
- **作者**：gpyangyoujun（PRD中写为 g_pyAng，实际是 gpyangyoujun）
- **地址**：hub.openclaw.ai/gpyangyoujun/multi-search-engine
- **免API Key**：✅ 是
- **引擎数量**：⚠️ 实际16引擎（7 CN + 9 Global），PRD中写17引擎
- **来源**：[hub.openclaw.ai](https://hub.openclaw.ai/gpyangyoujun/multi-search-engine)

### 6. web-fetch 是 OpenClaw 内置工具

- **验证结果**：✅ 真实存在
- **性质**：OpenClaw内置工具（built-in tool）
- **能力**：抓取网页内容、提取文本、处理JavaScript渲染页面
- **另有社区版**：`fetch` skill（openclaw/skills仓库，3,880 stars）
- **来源**：[openclawdoc.com](https://www.openclawdoc.com/docs/agents/tools/)、[CSDN内置工具详解](https://blog.csdn.net/sinat_41617212/article/details/159733754)

### 7. memory 是 OpenClaw 内置工具

- **验证结果**：✅ 真实存在
- **性质**：OpenClaw内置工具
- **工具**：`memory_store`（存储）+ `memory_recall`（检索）
- **能力**：长期记忆存储，支持标签分类
- **来源**：[openclawdoc.com](https://www.openclawdoc.com/docs/agents/tools/)

---

## 三、需要修正的假设 ⚠️

### 1. Multi Search Engine 引擎数量

- **PRD声明**：17引擎
- **实际情况**：16引擎（7 CN + 9 Global）
- **修正建议**：将"17引擎"改为"16引擎（7国内+9国际）"

### 2. Multi Search Engine 作者名

- **PRD声明**：g_pyAng
- **实际情况**：gpyangyoujun
- **修正建议**：更新作者名

### 3. ClawHub skill 数量

- **PRD声明**：13000+ skill
- **实际情况**：3,286个（2026年2月ClawHavoc事件清理后）
- **背景**：2026年2月发生ClawHavoc事件，发现341个恶意skill，移除2,419个可疑skill
- **修正建议**：改为"3,286个skill（2026年2月安全清理后）"

### 4. agent-browser Stars 数量

- **PRD声明**：36,379 stars
- **实际情况**：22,500+ stars（2026年3月数据）
- **修正建议**：更新为"22,500+ stars"或移除具体数字

### 5. ClawHub skill 安全风险描述

- **PRD声明**：30%+恶意
- **实际情况**：ClawHavoc事件发现341个恶意skill（占当时总量约5%），移除2,419个可疑skill
- **修正建议**：改为"曾发生ClawHavoc事件（2026年2月），已与VirusTotal合作进行安全扫描"

### 6. OpenClaw 安全控制描述

- **PRD声明**：未充分讨论OpenClaw安全风险
- **实际情况**：
  - OpenClaw有400+ CVE，其中100+高危，10+严重
  - 默认无沙箱，继承用户所有权限
  - 访问控制粒度粗
  - 内存污染风险
- **修正建议**：在风险章节增加OpenClaw安全风险及应对措施

---

## 四、虚假假设 🔴

### 1. xiaohongshu-skills (autoclaw-cc) 1,514 stars

- **PRD声明**：`autoclaw-cc/xiaohongshu-skills` GitHub仓库，1,514 stars，原生支持OpenClaw
- **验证结果**：🔴 **未找到该仓库**
- **实际情况**：搜索结果中没有 `autoclaw-cc/xiaohongshu-skills` 这个仓库
- **实际存在的小红书skill**：
  1. `openclaw/skills` 仓库下的 `xhs-content-ops`（3,891 stars）- 官方仓库
  2. `xiaohongshu-mcp-node-skill`（sipingme，416安装）- MCP协议实现
  3. `rednote-skills`（mrmao007，867安装）- Playwright实现
  4. `xiaohongshu-ops`（xiangyu-cas，51安装）- 全链路运营
- **修正建议**：
  - 删除 `autoclaw-cc/xiaohongshu-skills` 的引用
  - 改用 `openclaw/skills` 仓库下的 `xhs-content-ops`（官方维护，stars最多）
  - 或使用 `xiaohongshu-mcp-node-skill`（MCP协议，更规范）

### 2. xiaohongshu-downloader (smile7up) 26 stars

- **PRD声明**：`smile7up/xiaohongshu-downloader` GitHub仓库，26 stars，已停更
- **验证结果**：🔴 **未找到该仓库**
- **实际情况**：搜索结果中没有 `smile7up/xiaohongshu-downloader`
- **实际存在的下载工具**：
  1. `JoeanAmier/XHS-Downloader` - 活跃项目，支持API/MCP调用
  2. `btch-downloader` (npm包) - 支持多平台包括小红书
- **修正建议**：
  - 删除 `smile7up/xiaohongshu-downloader` 的引用
  - 如需下载能力，改用 `JoeanAmier/XHS-Downloader`

---

## 五、未经验证的产品设计 🟡

### 1. 6步流水线的实际可行性

- **未验证点**：6步流水线（选题→拆解→文案→图片→资产→发布）是否能在OpenClaw中稳定串联
- **风险**：
  - OpenClaw的多Agent调度能力未经实测
  - 各skill之间的数据传递格式未定义
  - 失败重试机制未设计
- **建议**：Phase 2开始前，先做最小可行验证（MVP）测试单条流水线

### 2. ERP调用OpenClaw的触发机制

- **未验证点**：PRD提到"ERP调用OpenClaw（或OpenClaw定时拉取待生成选题）"，但未明确：
  - ERP如何调用OpenClaw？OpenClaw是否有HTTP API接收外部请求？
  - 还是OpenClaw定时轮询ERP的API？
- **实际情况**：根据调研，OpenClaw主要通过消息平台（WhatsApp/Telegram等）或本地CLI触发，**没有标准的HTTP API接收外部请求**
- **建议**：明确采用"OpenClaw定时轮询ERP"模式，而非"ERP调用OpenClaw"

### 3. OpenClaw回写API的认证机制

- **未验证点**：PRD设计了3个OpenClaw回写API，但未说明：
  - OpenClaw如何获取ERP的认证Token？
  - Token过期后如何自动刷新？
- **建议**：
  - 为OpenClaw创建专用服务账号
  - 使用长效API Key（非7天会话Token）
  - 在AI配置Tab中管理此Key

### 4. 图片生成API的接入方式

- **未验证点**：PRD提到"调用图片生成API"生成封面图，但未明确：
  - 使用哪个图片生成服务？（DALL-E/Stable Diffusion/百度文心一格/通义万相？）
  - 如何在OpenClaw中调用？
  - 费用如何控制？
- **建议**：Phase 2实施前，先确定图片生成服务并验证ClawHub是否有对应skill

---

## 六、严重安全风险（PRD未充分讨论）

### 1. ClawHavoc事件影响

- **事件**：2026年2月，研究人员发现341个恶意ClawHub skill
- **影响**：恶意skill可窃取API Key、OAuth Token、会话数据
- **应对**：
  - 只安装高下载量+VirusTotal审计的skill
  - 优先使用官方skill（如百度官方的baidu-search）
  - 在OpenClaw中启用沙箱模式

### 2. OpenClaw CVE风险

- **现状**：400+ CVE，其中100+高危，10+严重
- **风险**：远程代码执行、数据泄露、权限提升
- **应对**：
  - 保持OpenClaw版本更新
  - 限制OpenClaw的文件系统访问范围
  - 不在OpenClaw中存储敏感凭证

### 3. OpenClaw默认权限过大

- **现状**：默认继承用户所有权限，可访问所有文件
- **风险**：一旦被攻破，攻击者获得完整系统权限
- **应对**：
  - 创建专用用户运行OpenClaw
  - 配置最小权限原则
  - 限制网络访问范围

---

## 七、修正建议汇总

### 必须修正（高优先级）

1. **删除** `autoclaw-cc/xiaohongshu-skills` 引用，改用 `openclaw/skills` 的 `xhs-content-ops`
2. **删除** `smile7up/xiaohongshu-downloader` 引用，改用 `JoeanAmier/XHS-Downloader` 或直接移除
3. **修正** Multi Search Engine 引擎数量：17→16
4. **修正** ClawHub skill数量：13000+→3,286（2026年2月清理后）
5. **明确** OpenClaw触发机制：采用"OpenClaw定时轮询ERP"模式
6. **设计** OpenClaw回写API的专用服务账号认证

### 建议修正（中优先级）

7. **更新** agent-browser stars数量：36,379→22,500+
8. **更新** Multi Search Engine 作者名：g_pyAng→gpyangyoujun
9. **增加** OpenClaw安全风险章节（CVE、ClawHavoc、权限过大）
10. **明确** 图片生成API的具体服务
11. **增加** 6步流水线的失败重试机制设计

### 可选优化（低优先级）

12. **增加** OpenClaw沙箱配置说明
13. **增加** skill安全审计流程
14. **增加** OpenClaw版本更新策略

---

## 八、下一步行动

1. **修正PRD v0.3** → 生成 v0.4（修正上述问题）
2. **编写OpenClaw配合指令文档**（`docs/OpenClaw配合指令.md`）
3. **细化API对接规范**（`docs/API对接规范.md`）
4. **Phase 2前做最小可行验证**：测试单条选题→文案生成流水线

---

## 参考来源

- [IMDA OpenClaw案例研究](https://www.imda.gov.sg/-/media/imda/files/about/emerging-tech-and-research/artificial-intelligence/openclaw-case-study.pdf)
- [ClawHub官方指南](https://claw-hub.net/what-is-clawhub.html)
- [OpenClaw内置工具文档](https://www.openclawdoc.com/docs/agents/tools/)
- [agent-browser安装指南](https://agent-browser.dev/installation)
- [百度官方Skills上架ClawHub](https://blog.csdn.net/weixin_48493350/article/details/157924009)
- [Multi Search Engine skill](https://hub.openclaw.ai/gpyangyoujun/multi-search-engine)
- [xhs-content-ops skill](https://aiagentivo.com/skills/openclaw-skills-xhs-content-ops)
- [XHS-Downloader项目](https://github.com/JoeanAmier/XHS-Downloader)
