# PRD: 内容推广管理模块

> 版本：v0.3 | 日期：2026-06-19 | 状态：需求评审中
> 架构演进：v0.1(ERP全功能) → v0.2(飞书+OpenClaw+ERP) → v0.3(OpenClaw+ERP 两端，内容数据库本地化)

---

## 1. 项目背景

### 1.1 Problem Statement

玉器翡翠零售商需要通过小红书推广商品，目前缺乏系统化的内容运营流水线。希望通过 AI Agent（OpenClaw）自动化选题→拆解→文案→图片→发布全流程，人工审核把关，并在 ERP 中本地化管理内容数据库、推广状态和反馈数据。

### 1.2 两端协作架构

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw（AI Agent 中枢）                  │
│                                                             │
│  Step1 选题采集    baidu-search + Multi Search Engine        │
│                    + hot-trends（热搜/关键词趋势）            │
│  Step2 灵感拆解    web-fetch（公众号/平台链接→提炼观点）      │
│                    → 按小红书图文结构重组                     │
│  Step3 文案生成    小红书内容模板 + prompt优化模块             │
│  Step4 图片生成    封面图AI生成 + 产品图读取(ERP API)          │
│  Step5 资产沉淀    memory + Obsidian（内容资产库）            │
│  Step6 稿件发布    xiaohongshu-skills（自动发布）             │
│                    agent-browser（浏览器操作底座）            │
└────────────────────────┬────────────────────────────────────┘
                         ↕ 安全内容API + 推广管理API + Webhook
┌─────────────────────────────────────────────────────────────┐
│                jade ERP（商品数据 + 内容数据库 + 推广管理）   │
│                                                             │
│  · 安全内容API — 供OpenClaw拉取商品数据（无底价）             │
│  · 内容数据库 — 选题/文案/推广记录本地化管理                  │
│  · 推广管理界面 — 选题评分、文案审核、推广状态、反馈追踪      │
│  · 前端交互 — 评分选题、选题参考生成内容、审核工作流          │
│  · UI入口 — 销售分组 → 内容推广栏目                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 现有基础设施

| 组件 | 状态 | 说明 |
|------|------|------|
| jade ERP | ✅ 运行中 | Next.js 16 全栈，库存/销售/客户管理 |
| OpenClaw（龙虾） | ✅ 运行中 | NAS 部署，DeepSeek V4 Flash 已配 |
| Docker 网络 | ✅ 已桥接 | OpenClaw 可访问 jade API |
| ClawHub | ✅ 可用 | clawhub.ai，13000+ skill 可安装 |
| Obsidian | ✅ 可用 | 本地知识库，内容资产沉淀 |
| 商品图片 | 🔴 缺失 | 5,231 件货品几乎全部 imageCount=0 |
| 安全内容API | 🔴 未开发 | 现有 /api/items 泄露底价 |

---

## 2. 六步内容推广流水线

### Step 1：选题采集系统

**载体**：OpenClaw 搜索 skill → ERP选题数据库

**OpenClaw 搜索 skill 清单**：

| Skill | 作者 | 下载量 | 用途 | 安装命令 |
|-------|------|--------|------|---------|
| `baidu-search` | ide-rea | 53.5K | 百度AI搜索，抓取资讯/关键词 | `clawhub install baidu-search` |
| `Multi Search Engine` | g_pyAng | 71.5K | 17引擎免API Key，多引擎补充 | `clawhub install multi-search-engine` |
| `hot-trends` | embracex1998 | - | 百度/头条/GitHub热搜监控 | `clawhub install hot-trends` |

**baidu-search 配置**：
- 需申请百度AI搜索API Key（cloud.baidu.com → AI搜索控制台）
- 配置：`gateway config.patch '{"env":{"vars":{"BAIDU_API_KEY":"xxx"}}}'`
- 三种检索模式：基础检索、学术检索、百科检索
- 支持时间筛选（24h/7d/30d）和结果数量控制（1-50条）

**工作流**：
```
OpenClaw 定时触发（或手动指令）
  → baidu-search 搜索"翡翠 小红书 热门"等关键词
  → hot-trends 抓取当前热搜趋势
  → 结果通过API写入ERP选题数据库（status=draft, source=ai）
  → 运营人员在ERP前端查看、评分、筛选
```

**前端交互**：
- 选题列表展示（标题/来源/关键词/状态/评分）
- 运营人员对选题打分（1-5星）
- 按评分排序，高分选题优先进入文案生成
- 手动创建选题（source=manual）

### Step 2：内容灵感拆解

**载体**：OpenClaw web-fetch → ERP选题数据库

**工作流**：
```
运营人员在ERP前端输入公众号/平台内容链接
  → ERP存储链接到选题记录
  → OpenClaw 读取链接
  → web-fetch 抓取全文内容
  → AI 提炼核心观点（卖点/结构/话术）
  → 按小红书图文结构重组（标题→hook→正文→标签）
  → 结果通过API写回ERP选题数据库（status=analyzed）
```

**小红书图文结构模板**：
```
标题（15-25字，含emoji）
  ↓
Hook（前3行，吸引停留）
  ↓
正文（4段式：初印象→卖点→场景→互动）
  ↓
标签（5-8个精准分类）
```

### Step 3：文案自动生成

**载体**：OpenClaw + 小红书内容模板 + prompt优化模块 → ERP文案数据库

**设计要点**：
1. **稳定的小红书内容模板**：预置玉器行业模板
   - 种草型：初印象→材质详解→佩戴效果→购买建议
   - 科普型：知识引入→专业解析→避坑指南→互动提问
   - 故事型：场景引入→商品出场→情感连接→价值升华
   - 对比型：痛点切入→方案对比→推荐理由→限时引导

2. **prompt优化模块**：优化原始提示词
   - 输入：商品数据 + 选题方向 + 目标模板
   - 优化：自动调整prompt结构，加入风格约束、违禁词规避
   - 输出：优化后的prompt → DeepSeek生成文案

3. **数据来源**：
   - 商品数据：jade ERP 安全内容API
   - 选题方向：ERP选题数据库（高分选题）
   - 参考内容：Step 2 拆解结果

**工作流**：
```
运营人员在ERP前端选择高分选题 + 关联商品
  → 点击"生成文案"
  → ERP调用OpenClaw（或OpenClaw定时拉取待生成选题）
  → OpenClaw调用ERP安全内容API获取商品数据
  → prompt优化模块生成优化提示词
  → DeepSeek生成文案（标题+正文+标签）
  → 结果通过API写入ERP文案数据库（status=draft）
  → 运营人员在ERP前端审核
```

### Step 4：图片自动生成/调用

**载体**：OpenClaw + AI图片生成 + ERP图片API

**两种图片来源**：

| 类型 | 来源 | 方式 |
|------|------|------|
| 封面图 | AI生成 | 调用图片生成API，基于文案+商品描述生成封面 |
| 产品图 | ERP读取 | 调用 `/api/content/images/{filename}` 获取商品图 |

**封面图生成策略**：
- 输入：商品名称 + 材质 + 文案标题 + 风格要求
- 生成：1-3张候选封面图
- 存储：写入ERP文案记录的coverImage字段
- 选择：运营人员在ERP前端选择

**产品图读取**：
- 调用 ERP 安全内容API 获取商品图片URL
- 图片通过 `/api/content/images/{filename}` 直链访问
- 多图按 F(正面)→S(侧面)→D(特写) 排序

### Step 5：内容资产沉淀

**载体**：OpenClaw memory + Obsidian

**目标**：将成功的内容运营经验沉淀为可复用的资产库

**沉淀内容**：
- 高互动文案的结构模式（什么标题/结构/标签效果好）
- 玉器行业的内容规律（什么材质/器型适合什么内容类型）
- 违禁词/敏感词库（持续积累）
- 博主参考数据（谁的内容值得学习）

**两种沉淀方式**：

| 方式 | 用途 | 说明 |
|------|------|------|
| OpenClaw memory | AI生成时参考 | 下次生成时自动参考历史成功案例 |
| Obsidian | 人工查阅 | 导出为Markdown笔记，本地知识库管理 |

**工作流**：
```
每次内容发布后
  → OpenClaw memory 记录：选题→文案→发布→反馈数据
  → 定期分析：哪类内容互动高、哪类转化好
  → 高价值经验导出到Obsidian（Markdown格式）
  → 形成内容资产库
```

### Step 6：稿件发布

**载体**：OpenClaw + xiaohongshu-skills + agent-browser

**安装的 skill/工具**：

| 工具 | GitHub | Stars | 用途 | 状态 |
|------|--------|-------|------|------|
| xiaohongshu-skills | autoclaw-cc/xiaohongshu-skills | 1,514 | 小红书自动发布（图文/视频/长文） | 活跃，原生支持OpenClaw |
| agent-browser | vercel-labs/agent-browser | 36,379 | AI浏览器自动化底座 | Vercel官方维护 |
| xiaohongshu-downloader | smile7up/xiaohongshu-downloader | 26 | 小红书视频下载 | 已停更，仅参考 |

**xiaohongshu-skills 核心能力**：
- xhs-auth：登录检查、扫码登录、手机验证码登录
- xhs-publish：图文/视频/长文发布、定时发布、分步预览、保存草稿
- xhs-explore：关键词搜索、笔记详情、用户主页、首页推荐
- xhs-interact：评论、回复、点赞、收藏
- xhs-content-ops：竞品分析、热点追踪、批量互动、内容创作

**安装方式**：
```bash
# xiaohongshu-skills
git clone https://github.com/autoclaw-cc/xiaohongshu-skills.git <openclaw-project>/skills/xiaohongshu-skills
cd xiaohongshu-skills && uv sync
# 安装Chrome扩展（chrome://extensions/ → 开发者模式 → 加载 extension/ 目录）

# agent-browser
npm install -g agent-browser
agent-browser install
```

**发布工作流**：
```
运营人员在ERP前端审核通过文案
  → ERP推广记录状态变为 approved
  → OpenClaw读取已审核文案
  → xiaohongshu-skills 保存草稿（save-draft）
  → 运营人员在小红书确认草稿
  → 人工点击发布（或 xhs-publish 自动发布）
  → 发布后回填笔记URL到ERP推广记录
  → 状态变为 published
```

---

## 3. 数据模型设计

### 3.1 ERP 新增表（6张）

内容数据库完全本地化，在ERP内管理：

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│ PromotionTopic  │────→│ PromotionContent │────→│  Promotion   │
│   选题表         │     │   文案表          │     │   推广记录    │
└────────┬────────┘     └────────┬─────────┘     └──────┬───────┘
         │                       │                      │
         ↓              ┌────────┘                      ↓
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   TopicItem     │     │   ContentItem    │     │ PromotionItem│
│ 选题-商品关联    │     │ 文案-商品关联     │     │ 推广-商品关联 │
└─────────────────┘     └──────────────────┘     └──────────────┘
                                                        │
                                                        ↓
                                                ┌──────────────┐
                                                │PromotionMetric│
                                                │  反馈数据(时序) │
                                                └──────────────┘
```

#### 表1：PromotionTopic（选题表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 cuid |
| title | String | 选题标题 |
| description | String? | 选题描述 |
| topicType | String | product/category/season/trend |
| status | String | draft/analyzed/pending/approved/rejected/archived |
| source | String | ai/manual/web_fetch |
| sourceUrl | String? | 内容来源链接（公众号/平台URL） |
| keywords | String[] | 关键词 |
| aiMetadata | Json? | AI生成的元数据（搜索结果/拆解观点） |
| rating | Int? | 运营人员评分（1-5星） |
| ratingNote | String? | 评分备注 |
| ratedBy | String? | 评分人 |
| ratedAt | DateTime? | 评分时间 |
| createdBy | String | 创建人 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### 表2：PromotionContent（文案表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 |
| topicId | String? | 关联选题（可选） |
| title | String | 小红书标题（≤25字） |
| body | Text | 文案正文（≤1000字） |
| tags | String[] | 话题标签 |
| coverImage | String? | 封面图URL |
| images | String[] | 正文图片URL列表 |
| contentMode | String | 种草/科普/故事/对比 |
| version | Int | 版本号 |
| status | String | draft/pending_review/approved/rejected/published |
| reviewNote | String? | 审核意见 |
| reviewerId | String? | 审核人 |
| reviewedAt | DateTime? | 审核时间 |
| aiModel | String? | 生成模型 |
| aiPrompt | Text? | 生成提示词 |
| violationFlags | Json? | 违禁词检测结果 |
| createdBy | String | 创建人 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### 表3：Promotion（推广记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 |
| contentId | String | 关联文案 |
| channel | String | xiaohongshu |
| externalNoteId | String? | 小红书笔记ID |
| externalNoteUrl | String? | 笔记链接 |
| status | String | scheduled/published/offline/archived |
| scheduledAt | DateTime? | 计划发布时间 |
| publishedAt | DateTime? | 实际发布时间 |
| offlineAt | DateTime? | 下线时间 |
| offlineReason | String? | 下线原因 |
| createdBy | String | 创建人 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### 表4：PromotionMetric（反馈数据表，时序）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 |
| promotionId | String | 关联推广 |
| viewCount | Int | 浏览量 |
| likeCount | Int | 点赞数 |
| collectCount | Int | 收藏数 |
| commentCount | Int | 评论数 |
| shareCount | Int | 分享数 |
| syncedAt | DateTime | 同步时间 |
| dataSource | String | browser/manual |

#### 表5-6：关联表

- **TopicItem**：topicId + itemId（多对多）
- **ContentItem**：contentId + itemId（多对多）
- **PromotionItem**：promotionId + itemId（多对多）

### 3.2 设计原则

1. **本地化**：内容数据库完全在ERP内，不依赖外部表格
2. **引用而非复制**：关联表只存itemId，商品数据以现有Item表为单一事实来源
3. **评分驱动**：选题表有rating字段，前端支持评分交互
4. **时序数据分离**：PromotionMetric每次同步新增一条记录
5. **状态机字段**：status统一用字符串枚举
6. **AI元数据用JSON**：aiMetadata/aiPrompt/violationFlags用Json/Text灵活存储
7. **配置复用**：AI配置存SysConfig，不新建表

---

## 4. 功能清单

### P0 — 核心功能（MVP）

| # | 功能 | 描述 | 验收标准 |
|---|------|------|---------|
| P0-1 | 安全内容API | `GET /api/content/items` 返回商品公开信息 | 无Token返回401；有Token不含costPrice/allocatedCost/floorPrice |
| P0-2 | 图片直链API | `GET /api/content/images/{filename}` | 图片存在返回200；不存在返回404占位图 |
| P0-3 | 导航注册 | 销售分组下新增"内容推广"栏目 | 有权限用户可见菜单 |
| P0-4 | 选题中心-列表 | 展示选题列表，含标题/来源/状态/评分/关键词 | 支持按状态/评分/来源筛选 |
| P0-5 | 选题评分 | 运营人员对选题打分（1-5星）+ 备注 | 评分写入数据库，列表按评分排序 |
| P0-6 | 选题手动创建 | 手动创建选题，关联商品 | 生成选题记录(status=draft, source=manual) |
| P0-7 | 文案工坊-列表 | 展示文案列表，含状态徽章 | 支持按状态筛选 |
| P0-8 | 文案审核 | 文案状态流转：draft→pending_review→approved/rejected | 状态变更+记录审核意见 |
| P0-9 | 推广管理-创建 | 创建推广计划，关联文案+渠道 | 生成推广记录(status=scheduled) |
| P0-10 | 推广状态流转 | scheduled→published→offline→archived | 状态变更+回填笔记URL |
| P0-11 | 商品推广历史 | 在商品详情中展示历史推广记录 | 显示推广历史列表 |
| P0-12 | 反馈手动录入 | 手动录入笔记互动数据 | 数据写入PromotionMetric |
| P0-13 | 反馈看板 | 折线图+数值卡片展示趋势 | Recharts渲染趋势图 |
| P0-14 | AI配置管理 | OpenClaw/百度API Key配置 | SysConfig存储，前端可编辑 |

### P1 — 重要功能（Phase 2）

| # | 功能 | 描述 |
|---|------|------|
| P1-1 | 选题AI生成 | OpenClaw调用baidu-search生成选题，通过API写入ERP |
| P1-2 | 内容拆解 | 输入链接→web-fetch抓取→AI提炼观点→写入选题 |
| P1-3 | 文案AI生成 | OpenClaw基于选题+商品数据生成文案，通过API写入ERP |
| P1-4 | 违禁词检测 | 内置广告法违禁词库+小红书敏感词检测 |
| P1-5 | 图片生成 | 封面图AI生成，写入文案记录 |
| P1-6 | OpenClaw Webhook | 接收OpenClaw异步生成的选题/文案 |
| P1-7 | AI调用日志 | 记录所有OpenClaw调用 |
| P1-8 | 推广日历 | 日历视图展示推广计划 |

### P2 — 可选功能（Phase 3）

| # | 功能 | 描述 |
|---|------|------|
| P2-1 | 浏览器自动读取 | agent-browser连接Chrome读取小红书创作中心数据 |
| P2-2 | 内容资产导出 | 高价值经验导出到Obsidian（Markdown） |
| P2-3 | 评论管理 | 拉取评论列表，标记重要评论 |
| P2-4 | 效果排行榜 | 商品推广效果TOP榜 |
| P2-5 | 数据导出 | CSV导出 |
| P2-6 | 多渠道支持 | 抖音/微信视频号 |

---

## 5. UI 设计

### 5.1 入口位置

```
销售
├── 销售记录
├── 客户管理
├── 促销活动
└── 内容推广  ← 新增
```

### 5.2 页面结构

```
┌──────────────────────────────────────────────────────┐
│ 选题中心 │ 文案工坊 │ 推广管理 │ 反馈追踪 │ AI配置    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [当前Tab的内容区]                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.3 各Tab视图

| Tab | 布局 | 核心元素 |
|-----|------|---------|
| 选题中心 | 左侧筛选+右侧列表 | 选题卡片（标题/来源/状态/**星级评分**/关键词/关联商品缩略图）+ "手动创建"按钮 + "AI生成"按钮 |
| 文案工坊 | 左侧列表+右侧详情 | 文案列表（状态徽章）+ 详情面板（标题/正文/标签/图片预览/审核操作） |
| 推广管理 | 统计卡片+列表 | 状态统计 + 推广列表（商品/渠道/状态/发布时间）+ "创建推广"按钮 |
| 反馈追踪 | 图表+数据表 | 折线图（趋势）+ 数值卡片（点赞/浏览/评论/收藏）+ "同步数据"按钮 |
| AI配置 | 表单 | OpenClaw地址/Key、百度API Key、小红书Cookie |

### 5.4 选题中心交互细节

```
选题卡片
┌─────────────────────────────────────────────┐
│ ★★★★☆ (4星)  [AI来源]  [待审核]             │
│ 标题：冰种翡翠手镯夏季搭配指南                │
│ 关键词：翡翠 手镯 夏季 搭配                   │
│ 关联商品：0101-0505-001 冰种飘花平安扣       │
│ 来源URL：https://mp.weixin.qq.com/...        │
│                                              │
│ [评分] [通过] [拒绝] [生成文案] [查看详情]    │
└─────────────────────────────────────────────┘
```

**交互流程**：
1. 运营人员查看选题列表
2. 对选题打分（1-5星）
3. 高分选题点击"通过"→ status=approved
4. 点击"生成文案"→ 触发OpenClaw生成文案
5. 低分选题点击"拒绝"→ status=rejected

---

## 6. API 设计

### 6.1 安全内容API（供OpenClaw调用）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/content/items` | GET | 安全版商品列表（无底价/成本/供应商） |
| `/api/content/images/{filename}` | GET | 图片直链 |
| `/api/content/health` | GET | 健康检查 |

**返回字段（安全版）**：
```typescript
{
  id, skuCode, name,
  materialName, materialCategory,
  typeName,
  sellingPrice,
  spec: { weight, braceletSize, beadDiameter, ringSize },
  specText,
  tags: ["冰种", "飘花"],
  notes,
  certNo,
  counter,
  images: [{ url, isCover, angleCode }],
  ageDays,
  createdAt
}
```

**绝不返回**：costPrice、allocatedCost、floorPrice、estimatedCost、batch.totalCost、supplierId

### 6.2 推广管理API（供前端+OpenClaw调用）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/promotion/topics` | GET/POST | 选题列表/创建 |
| `/api/promotion/topics/{id}` | GET/PATCH | 选题详情/更新 |
| `/api/promotion/topics/{id}/rating` | PATCH | 选题评分 |
| `/api/promotion/topics/{id}/review` | PATCH | 选题审核（通过/拒绝） |
| `/api/promotion/contents` | GET/POST | 文案列表/创建 |
| `/api/promotion/contents/{id}` | GET/PATCH | 文案详情/更新 |
| `/api/promotion/contents/{id}/review` | PATCH | 文案审核 |
| `/api/promotion/contents/{id}/check` | POST | 违禁词检测 |
| `/api/promotion/promotions` | GET/POST | 推广列表/创建 |
| `/api/promotion/promotions/{id}/status` | PATCH | 推广状态变更 |
| `/api/promotion/items/{itemId}/history` | GET | 商品推广历史 |
| `/api/promotion/metrics/{promotionId}` | GET/POST | 反馈数据查询/录入 |
| `/api/promotion/metrics/sync` | POST | 触发数据同步 |
| `/api/promotion/config` | GET/PUT | AI配置管理 |

### 6.3 OpenClaw 回写API（供OpenClaw写入数据）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/content/topics` | POST | OpenClaw回写AI生成的选题 |
| `/api/content/contents` | POST | OpenClaw回写AI生成的文案 |
| `/api/content/analyze` | POST | OpenClaw回写内容拆解结果 |

---

## 7. OpenClaw Skill 安装清单

### 7.1 搜索类（Step 1 选题采集）

| Skill | 安装命令 | API Key | 说明 |
|-------|---------|---------|------|
| baidu-search | `clawhub install baidu-search` | 百度AI搜索Key | 国内首选，53.5K下载 |
| Multi Search Engine | `clawhub install multi-search-engine` | 免 | 17引擎，71.5K下载 |
| hot-trends | `clawhub install hot-trends` | 免 | 百度/头条热搜 |

### 7.2 内容类（Step 2-3 拆解+生成）

| Skill/能力 | 来源 | 说明 |
|-----------|------|------|
| web-fetch | OpenClaw内置 | 抓取公众号/平台链接内容 |
| prompt优化 | 需开发自定义skill | 优化小红书文案提示词 |
| 小红书内容模板 | 需开发自定义skill | 玉器行业4种模板 |

### 7.3 图片类（Step 4）

| Skill/能力 | 来源 | 说明 |
|-----------|------|------|
| AI图片生成 | 需接入图片生成API | 封面图生成 |
| ERP图片读取 | jade ERP API | `/api/content/images/{filename}` |

### 7.4 资产类（Step 5）

| Skill/能力 | 来源 | 说明 |
|-----------|------|------|
| memory | OpenClaw内置/agentmemory | 内容资产库沉淀 |
| Obsidian导出 | 需开发导出功能 | 高价值经验导出为Markdown |

### 7.5 发布类（Step 6）

| 工具 | GitHub | 安装方式 | 说明 |
|------|--------|---------|------|
| xiaohongshu-skills | autoclaw-cc/xiaohongshu-skills | `git clone` + `uv sync` + Chrome扩展 | 1.5K stars，原生支持OpenClaw |
| agent-browser | vercel-labs/agent-browser | `npm install -g agent-browser && agent-browser install` | 36K stars，Vercel官方 |
| xiaohongshu-downloader | smile7up/xiaohongshu-downloader | 仅参考，不建议集成 | 26 stars，已停更 |

---

## 8. 非功能需求

### 8.1 安全

| 需求 | 实现方式 |
|------|---------|
| 底价不泄露 | 安全内容API用Prisma select白名单 |
| 认证必须 | 复用guardPermission |
| 供应商隔离 | 安全API不包含supplier关联 |
| 浏览器读取合规 | 仅读自己账号数据，频率≥2秒/次 |
| AI内容标注 | 生成内容标记AI生成，发布提醒勾选 |

### 8.2 性能

| 指标 | 要求 |
|------|------|
| 安全内容API响应 | ≤500ms（20条/页） |
| 选题/文案列表加载 | ≤1s |
| 反馈数据同步 | 单次≤30s |

---

## 9. 约束条件

| 约束 | 说明 |
|------|------|
| 技术栈 | Next.js 16 + Prisma 6 + SQLite + shadcn/ui + Recharts |
| AI Agent | OpenClaw（已部署），通过HTTP API交互 |
| 内容数据库 | ERP本地（Prisma + SQLite），不依赖外部表格 |
| 资产沉淀 | OpenClaw memory + Obsidian（本地知识库） |
| 数据库变更 | 必须走Prisma Migration |
| 权限 | 新增 `tab:content-promotion` 权限项 |
| 不修改现有API | /api/items 保持不变 |
| 发布方式 | xiaohongshu-skills保存草稿→人工确认发布 |

---

## 10. 不做的事项（Non-Goals）

- ❌ 不用飞书多维表格（内容数据库本地化）
- ❌ 不做AI自动发布（保存草稿→人工确认）
- ❌ 不做小红书官方API对接（用agent-browser/xiaohongshu-skills代替）
- ❌ 不做多渠道（MVP只支持小红书）
- ❌ 不爬取他人笔记（合规风险）
- ❌ 不修改现有 /api/items
- ❌ 不在ERP内建AI生成能力（生成在OpenClaw侧，ERP只存结果）

---

## 11. 实施计划

### Phase 1：ERP MVP — 本地内容数据库 + 推广管理

**目标**：ERP能管理选题/文案/推广/反馈全流程（手动闭环）

- [ ] 数据模型：新增6张表 + Prisma Migration
- [ ] 安全内容API：`/api/content/items` + `/api/content/images/{filename}`
- [ ] UI：销售分组下新增"内容推广"栏目 + 5个Tab
- [ ] 选题中心：列表 + 手动创建 + **评分交互** + 状态流转
- [ ] 文案工坊：列表 + 手动录入 + 审核工作流
- [ ] 推广管理：创建推广 + 状态流转 + 商品推广历史
- [ ] 反馈追踪：手动录入 + 基础看板（Recharts）
- [ ] AI配置管理（SysConfig）
- [ ] 权限：`tab:content-promotion`

### Phase 2：OpenClaw 集成 — 6步流水线打通

**目标**：AI自动生成选题和文案

- [ ] 安装搜索skill：baidu-search + Multi Search Engine + hot-trends
- [ ] 选题AI生成（OpenClaw→ERP API回写）
- [ ] web-fetch内容拆解
- [ ] 小红书内容模板 + prompt优化skill开发
- [ ] 文案AI生成（OpenClaw→ERP API回写）
- [ ] 图片生成接入
- [ ] memory内容资产沉淀
- [ ] 违禁词检测
- [ ] OpenClaw Webhook回调
- [ ] AI调用日志

### Phase 3：发布与数据自动化

**目标**：自动发布草稿 + 自动同步反馈数据

- [ ] 安装 xiaohongshu-skills + agent-browser
- [ ] xiaohongshu-skills保存草稿
- [ ] agent-browser连接Chrome读取小红书创作中心数据
- [ ] Obsidian导出（内容资产）
- [ ] 评论管理
- [ ] 数据导出CSV
- [ ] 效果排行榜

---

## 12. 风险与应对

| 风险 | 等级 | 应对 |
|------|------|------|
| 商品无图片（5231件imageCount=0） | 🔴高 | Phase 1先支持无图货品；同步推进拍照 |
| ClawHub skill安全风险（30%+恶意） | 🟡中 | 只装高下载量+VirusTotal审计的skill |
| xiaohongshu-skills与agent-browser架构冲突 | 🟡中 | 评估是否二选一，或分场景使用 |
| 小红书反爬/风控 | 🟡中 | 控制频率≥2秒/次，仅操作自己账号 |
| 百度API Key申请 | 🟡低 | 需实名认证，提前准备 |

---

## 13. 验收标准（Given-When-Then）

### 13.1 安全内容API

```
Given 调用 /api/content/items
When 无Token
Then 返回401

Given 调用 /api/content/items?has_images=true
When 有Token
Then 返回数据不含 costPrice/allocatedCost/floorPrice/estimatedCost
And 返回数据含 images 数组
```

### 13.2 选题中心

```
Given 选题列表有数据
When 运营人员查看选题中心
Then 显示选题卡片（含评分星级）

Given 选题为draft状态
When 运营人员打4星 + 点击"通过"
Then 评分写入数据库
And 状态变为approved

Given 选题已approved + 关联商品
When 点击"生成文案"
Then 触发文案生成流程
```

### 13.3 文案工坊

```
Given 文案为draft状态
When 审核员点击"通过"
Then 状态变为approved + 记录审核意见

Given 文案含违禁词
When 保存
Then 标记违禁词位置
```

### 13.4 推广管理

```
Given 文案已approved
When 创建推广
Then 生成推广记录(status=scheduled)

Given 推广为scheduled
When 标记已发布+填入笔记URL
Then 状态变为published
```

### 13.5 OpenClaw流水线（Phase 2）

```
Given baidu-search已安装+API Key已配
When OpenClaw执行搜索
Then 选题通过API写入ERP数据库

Given 选题已approved
When OpenClaw生成文案
Then 调用ERP安全API获取商品数据
And 文案通过API写入ERP数据库
```

---

## 14. 相关文件索引

| 文件 | 路径 |
|------|------|
| 调度链提示词 | `docs/调度链提示词-jade-to-xhs.md` |
| 内容运营Skill | `d:\02工作\llm\.trae\skills\jade-xhs-ops\SKILL.md` |
| 现有API示例 | `src/app/api/items/route.ts` |
| 数据模型 | `prisma/schema.prisma` |
| 导航定义 | `src/components/inventory/navigation.tsx` |
| Tab渲染 | `src/app/page.tsx` |
| TabId类型 | `src/lib/store.ts` |
| 入货建议参考 | `src/components/inventory/restock-tab.tsx` |

### 外部资源

| 资源 | 地址 |
|------|------|
| ClawHub（skill市场） | https://clawhub.ai/ |
| baidu-search | `clawhub install baidu-search` |
| xiaohongshu-skills | https://github.com/autoclaw-cc/xiaohongshu-skills |
| agent-browser | https://github.com/vercel-labs/agent-browser |
| xiaohongshu-downloader | https://github.com/smile7up/xiaohongshu-downloader |
| 百度AI搜索控制台 | https://console.bce.baidu.com/ai-search/ |
