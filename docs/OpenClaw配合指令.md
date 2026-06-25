# OpenClaw 配合指令文档

> 版本：v1.0 | 日期：2026-06-19
> 用途：定义 OpenClaw 如何配合 jade ERP 工作，以及 ERP 侧如何为 OpenClaw 提供稳定 API
> 原则：**用户只与 ERP 前端交互，不操作 OpenClaw**

---

## 一、运作机制理解

### 1.1 OpenClaw 是什么

OpenClaw 是开源 AI 代理框架，由 Peter Steinberger 开发，2025年11月发布。核心特性：

- **本地运行**：部署在 NAS 上，数据不出本地
- **多模型支持**：已配置 DeepSeek V4 Flash
- **内置工具**：web_fetch（抓取网页）、memory_store/recall（记忆）、shell（执行命令）、http_request（HTTP调用）
- **skill 扩展**：通过 ClawHub（clawhub.ai）安装社区 skill
- **触发方式**：消息平台（WhatsApp/Telegram）、定时任务（cron）、本地 CLI

### 1.2 关键限制（必须理解）

| 限制 | 说明 | 对接影响 |
|------|------|---------|
| **无标准 HTTP API** | OpenClaw 不能像普通 Web 服务那样接收外部 HTTP 请求 | ERP 不能"调用"OpenClaw，只能 OpenClaw 主动轮询 ERP |
| **默认无沙箱** | 继承运行用户的所有权限 | 必须创建专用用户，限制权限 |
| **400+ CVE** | 安全漏洞较多 | 保持版本更新，限制网络访问 |
| **Token 7天过期** | ERP 会话 Token 7 天失效 | 必须为 OpenClaw 创建长效 API Key |
| **skill 安全风险** | ClawHavoc事件证明社区skill有风险 | 只装官方/高下载量 skill，启用 VirusTotal 审计 |

### 1.3 协作模式（关键）

```
┌─────────────────────────────────────────────────────────────┐
│  用户（运营人员）                                             │
│  ↓ 只与 ERP 前端交互                                          │
│  ↓ 评分选题、审核文案、查看反馈、配置AI                        │
├─────────────────────────────────────────────────────────────┤
│  jade ERP（本对话环境负责开发）                                │
│  ├── 前端：内容推广管理界面（5个Tab）                          │
│  ├── 后端：安全内容API + 推广管理API + OpenClaw回写API         │
│  └── 数据库：6张内容推广表                                     │
├─────────────────────────────────────────────────────────────┤
│  ↑ OpenClaw 主动轮询 ERP API                                  │
│  ↓ OpenClaw 回写数据到 ERP                                    │
├─────────────────────────────────────────────────────────────┤
│  OpenClaw（用户不操作，自动运行）                              │
│  ├── 定时触发（cron）：每日选题采集、文案生成                   │
│  ├── 轮询 ERP：检查是否有待生成的高分选题                       │
│  ├── 调用 skill：baidu-search、web-fetch、xhs-content-ops     │
│  ├── 调用 DeepSeek：生成文案                                  │
│  └── 回写 ERP：通过回写API写入选题/文案/拆解结果                │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：
- ERP 是被动方，提供 API 供 OpenClaw 调用
- OpenClaw 是主动方，定时轮询 ERP，拉取任务，回写结果
- 用户只在 ERP 前端操作，从不直接操作 OpenClaw

---

## 二、OpenClaw 配置指令

### 2.1 环境变量配置

在 OpenClaw 容器中配置以下环境变量（`~/.openclaw/config.yaml` 或环境变量）：

```yaml
# jade ERP 连接配置
env:
  vars:
    # ERP 地址（NAS 内网）
    JADE_ERP_BASE_URL: "http://172.27.0.2:5000"
    # OpenClaw 专用 API Key（长效，非7天会话Token）
    JADE_ERP_API_KEY: "oc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    # 百度AI搜索 API Key
    BAIDU_API_KEY: "baidu_your_api_key_here"
    # DeepSeek 已配置（无需重复）

# 工具权限
tools:
  - web_fetch        # 内置：抓取网页
  - memory_store     # 内置：存储记忆
  - memory_recall    # 内置：检索记忆
  - http_request     # 内置：HTTP调用（调用ERP API）
  - shell            # 内置：执行命令（需限制权限）
  - file_read        # 内置：读取文件
  - file_write       # 内置：写入文件
```

### 2.2 skill 安装指令

在 OpenClaw 容器中执行：

```bash
# 1. 搜索类 skill（选题采集）
openclaw skills install baidu-search          # 百度官方，需API Key
openclaw skills install @gpyangyoujun/multi-search-engine  # 16引擎，免API Key

# 2. 内容类 skill（小红书运营）- 使用官方仓库的 xhs-content-ops
# 注意：不使用 autoclaw-cc/xiaohongshu-skills（该仓库不存在）
# 从 openclaw/skills 仓库安装
curl -o ~/.openclaw/skills/xhs-content-ops/SKILL.md --create-dirs \
  "https://raw.githubusercontent.com/openclaw/skills/main/skills/angiin/xiaohongshu-skills/skills/xhs-content-ops/SKILL.md"

# 3. web-fetch 已内置，无需安装

# 4. memory 已内置，无需安装
```

### 2.3 定时任务配置

在 OpenClaw 容器中配置 cron（`crontab -e`）：

```bash
# 每日 07:00 执行选题采集
0 7 * * * /root/.openclaw/workspace/jade-xhs-daily.sh topic-collection

# 每日 09:00 检查待生成文案的高分选题
0 9 * * * /root/.openclaw/workspace/jade-xhs-daily.sh content-generation

# 每日 18:00 同步推广反馈数据（如已发布）
0 18 * * * /root/.openclaw/workspace/jade-xhs-daily.sh metrics-sync
```

---

## 三、OpenClaw 执行指令（Prompt 模板）

### 3.1 选题采集指令

**触发**：每日 07:00 自动执行
**指令模板**：

```
你是 jade 玉器小红书运营的选题采集 Agent。

任务：采集今日玉器翡翠行业的热门选题

执行步骤：
1. 调用 baidu-search skill，搜索以下关键词：
   - "翡翠 小红书 热门"
   - "玉器 搭配 2026"
   - "冰种翡翠 夏季"
   每个关键词取前10条结果

2. 调用 multi-search-engine skill，补充搜索：
   - "小红书 翡翠 种草"
   取前5条结果

3. 对搜索结果进行去重和筛选：
   - 去除明显广告
   - 保留与玉器/翡翠/珠宝相关的内容
   - 提取标题、来源URL、关键词

4. 将筛选后的选题通过 ERP 回写API 写入：
   POST {JADE_ERP_BASE_URL}/api/content/topics
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}
   Body: {
     "title": "选题标题",
     "description": "选题描述",
     "topicType": "trend",
     "source": "ai",
     "sourceUrl": "来源URL",
     "keywords": ["关键词1", "关键词2"],
     "aiMetadata": { "搜索结果": "..." }
   }

5. 每次最多写入 10 条选题，避免重复（先查询已存在的）

约束：
- 绝不编造选题，必须基于真实搜索结果
- sourceUrl 必须是真实可访问的URL
- 关键词不超过5个
- 遇到 API 错误时记录日志并跳过，不阻塞整体流程
```

### 3.2 内容拆解指令

**触发**：运营人员在 ERP 前端输入公众号/平台链接后，OpenClaw 轮询发现
**指令模板**：

```
你是 jade 玉器小红书运营的内容拆解 Agent。

任务：拆解指定链接的内容，提炼观点

执行步骤：
1. 轮询 ERP API 获取待拆解的选题：
   GET {JADE_ERP_BASE_URL}/api/promotion/topics?status=draft&source=manual&has_source_url=true
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}

2. 对每个待拆解的选题，调用 web_fetch 抓取 sourceUrl 内容：
   - 提取标题、正文、关键观点
   - 识别内容结构（开头/中间/结尾的逻辑）

3. 按小红书图文结构重组：
   标题（15-25字，含emoji）
   ↓
   Hook（前3行，吸引停留）
   ↓
   正文（4段式：初印象→卖点→场景→互动）
   ↓
   标签（5-8个精准分类）

4. 将拆解结果回写到 ERP：
   PATCH {JADE_ERP_BASE_URL}/api/content/analyze
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}
   Body: {
     "topicId": "选题ID",
     "aiMetadata": {
       "originalTitle": "原标题",
       "keyPoints": ["观点1", "观点2"],
       "restructuredContent": {
         "title": "重组标题",
         "hook": "Hook内容",
         "body": "正文内容",
         "tags": ["标签1", "标签2"]
       }
     }
   }

5. 更新选题状态为 analyzed：
   PATCH {JADE_ERP_BASE_URL}/api/promotion/topics/{topicId}
   Body: { "status": "analyzed" }

约束：
- 只抓取公开可访问的URL
- 不编造原文中没有的观点
- 遇到抓取失败时记录日志，选题状态保持 draft
```

### 3.3 文案生成指令

**触发**：每日 09:00 检查高分选题（rating >= 4）+ 运营人员手动触发
**指令模板**：

```
你是 jade 玉器小红书运营的文案生成 Agent。

任务：为高分选题生成小红书文案

执行步骤：
1. 轮询 ERP API 获取待生成文案的高分选题：
   GET {JADE_ERP_BASE_URL}/api/promotion/topics?status=approved&min_rating=4
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}

2. 对每个选题，获取关联的商品数据：
   GET {JADE_ERP_BASE_URL}/api/content/items?topic_id={topicId}&has_images=true
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}
   注意：此API返回的是安全版数据，不含成本价/底价

3. 根据选题的 topicType 选择文案模板：
   - product（产品型）：种草型模板
   - category（品类型）：科普型模板
   - season（季节型）：故事型模板
   - trend（趋势型）：对比型模板

4. 构造 prompt 调用 DeepSeek 生成文案：
   系统提示词：
   "你是专业的玉器珠宝小红书运营。
   风格：第一人称店主视角，亲切真实，像朋友推荐。
   每次生成必须遵守：
   - 标题 15-25 字，含 emoji
   - 正文 4 段式（初印象→卖点→场景→互动）
   - 标签 5-8 个精准分类
   - 绝不编造货品信息（没有的数据不说）
   - 输出 JSON 格式：{"title":"...","hook":"...","content":"...","tags":[...]}"

   用户输入：
   - 选题方向：{选题标题和描述}
   - 商品数据：{安全版商品JSON}
   - 参考内容：{Step2拆解结果，如有}

5. 将生成的文案回写到 ERP：
   POST {JADE_ERP_BASE_URL}/api/content/contents
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}
   Body: {
     "topicId": "选题ID",
     "title": "生成的标题",
     "body": "生成的正文",
     "tags": ["标签1", "标签2"],
     "contentMode": "种草/科普/故事/对比",
     "status": "draft",
     "aiModel": "deepseek-v4-flash",
     "aiPrompt": "使用的提示词",
     "images": ["商品图片URL列表"]
   }

6. 记录到 memory：
   memory_store: {
     "key": "content_generation_{date}_{topicId}",
     "value": "生成摘要",
     "tags": ["content", "generation", "jade"]
   }

约束：
- 绝不使用成本价/底价信息（API不返回，也不要推测）
- 商品数据必须来自安全内容API，不编造
- 每个选题最多生成1篇文案
- 遇到 API 错误时记录日志并跳过
```

### 3.4 反馈数据同步指令

**触发**：每日 18:00 执行（Phase 3，需安装 xhs-content-ops）
**指令模板**：

```
你是 jade 玉器小红书运营的数据同步 Agent。

任务：同步已发布笔记的反馈数据

执行步骤：
1. 轮询 ERP API 获取已发布的推广记录：
   GET {JADE_ERP_BASE_URL}/api/promotion/promotions?status=published
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}

2. 对每个推广记录，使用 xhs-content-ops skill 获取笔记数据：
   - 通过 externalNoteUrl 访问笔记
   - 提取：浏览量、点赞数、收藏数、评论数、分享数

3. 将反馈数据回写到 ERP：
   POST {JADE_ERP_BASE_URL}/api/promotion/metrics/{promotionId}
   Headers: Authorization: Bearer {JADE_ERP_API_KEY}
   Body: {
     "viewCount": 1234,
     "likeCount": 56,
     "collectCount": 12,
     "commentCount": 3,
     "shareCount": 2,
     "dataSource": "browser"
   }

4. 控制频率：每次请求间隔 >= 2秒，避免风控

约束：
- 只读取自己账号发布的笔记数据
- 不爬取他人笔记
- 频率控制 >= 2秒/次
- 遇到风控限制时停止同步，记录日志
```

---

## 四、ERP 侧 API 对接规范

### 4.1 认证机制（关键设计）

**问题**：ERP 现有认证是 7 天会话 Token，OpenClaw 长期运行会过期
**解决方案**：为 OpenClaw 创建专用长效 API Key

```
ERP 侧需新增：
1. SysConfig 配置项：openclaw_api_key（长效API Key，格式：oc_ + 32位随机字符串）
2. 认证中间件支持两种 Token：
   - 用户会话 Token（7天有效期，现有）
   - OpenClaw API Key（长效，新增）
3. OpenClaw API Key 只能调用以下端点：
   - GET /api/content/items（读取商品数据）
   - GET /api/content/images/{filename}（读取图片）
   - POST /api/content/topics（回写选题）
   - POST /api/content/contents（回写文案）
   - POST /api/content/analyze（回写拆解结果）
   - GET /api/promotion/topics（查询选题）
   - GET /api/promotion/promotions（查询推广）
   - POST /api/promotion/metrics/{id}（回写反馈）
4. OpenClaw API Key 不能调用：用户管理、销售、库存等敏感API
```

### 4.2 API 端点规范

#### 4.2.1 安全内容API（OpenClaw 读取商品数据）

```
GET /api/content/items
```

**请求参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码，默认1 |
| size | int | 每页条数，默认20，最大50 |
| status | string | in_stock/sold/returned |
| has_images | bool | true=仅返回有图货品 |
| topic_id | string | 关联选题ID（返回该选题关联的商品） |
| min_price | float | 最低售价 |
| max_price | float | 最高售价 |

**响应**（安全版，绝不包含成本价）：
```json
{
  "code": 0,
  "data": {
    "items": [{
      "id": "13658",
      "skuCode": "0101-0505-001",
      "name": "冰种飘花平安扣",
      "materialName": "翡翠",
      "materialCategory": "玉",
      "typeName": "吊坠",
      "sellingPrice": 1800,
      "spec": { "weight": 15.3, "braceletSize": "56" },
      "specText": "重15.3g 圈口56mm",
      "tags": ["冰种", "飘花"],
      "notes": "冰种飘花，水头足",
      "certNo": "N123456",
      "counter": 11,
      "images": [{ "url": "/api/content/images/xxx.jpg", "isCover": true, "angleCode": "F" }],
      "ageDays": 15,
      "createdAt": "2026-06-03T05:17:58Z"
    }],
    "total": 5126,
    "page": 1,
    "size": 20
  }
}
```

**绝不返回**：costPrice、allocatedCost、floorPrice、estimatedCost、batch.totalCost、supplierId

#### 4.2.2 OpenClaw 回写API

```
POST /api/content/topics
```
**用途**：OpenClaw 回写 AI 生成的选题
**认证**：OpenClaw API Key
**请求体**：
```json
{
  "title": "冰种翡翠手镯夏季搭配指南",
  "description": "夏季翡翠搭配趋势",
  "topicType": "trend",
  "source": "ai",
  "sourceUrl": "https://...",
  "keywords": ["翡翠", "手镯", "夏季"],
  "aiMetadata": { "searchResults": "..." }
}
```

```
POST /api/content/contents
```
**用途**：OpenClaw 回写 AI 生成的文案
**认证**：OpenClaw API Key
**请求体**：
```json
{
  "topicId": "topic_xxx",
  "title": "夏日翡翠💚冰种手镯搭配指南",
  "body": "文案正文...",
  "tags": ["翡翠", "冰种", "手镯"],
  "contentMode": "种草",
  "status": "draft",
  "aiModel": "deepseek-v4-flash",
  "aiPrompt": "使用的提示词",
  "images": ["/api/content/images/xxx.jpg"]
}
```

```
POST /api/content/analyze
```
**用途**：OpenClaw 回写内容拆解结果
**认证**：OpenClaw API Key
**请求体**：
```json
{
  "topicId": "topic_xxx",
  "aiMetadata": {
    "originalTitle": "原标题",
    "keyPoints": ["观点1", "观点2"],
    "restructuredContent": {
      "title": "重组标题",
      "hook": "Hook",
      "body": "正文",
      "tags": ["标签"]
    }
  }
}
```

### 4.3 错误处理规范

ERP API 统一错误响应格式：
```json
{
  "code": 400,
  "message": "错误描述",
  "details": { "field": "具体字段错误" }
}
```

| HTTP 状态码 | 说明 | OpenClaw 处理方式 |
|------------|------|------------------|
| 401 | API Key 无效 | 停止执行，记录日志，通知管理员 |
| 403 | 权限不足 | 跳过该操作，记录日志 |
| 404 | 资源不存在 | 跳过，记录日志 |
| 429 | 频率限制 | 等待60秒后重试，最多3次 |
| 500 | 服务器错误 | 等待30秒后重试，最多3次 |

---

## 五、工作流程稳定性保障

### 5.1 失败重试机制

OpenClaw 执行脚本（`jade-xhs-daily.sh`）必须包含重试逻辑：

```bash
#!/bin/bash
# jade-xhs-daily.sh

MAX_RETRIES=3
RETRY_DELAY=30

call_erp_api() {
  local method=$1
  local endpoint=$2
  local body=$3
  local retry=0

  while [ $retry -lt $MAX_RETRIES ]; do
    response=$(curl -s -w "%{http_code}" \
      -X $method \
      "${JADE_ERP_BASE_URL}${endpoint}" \
      -H "Authorization: Bearer ${JADE_ERP_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$body")

    http_code="${response: -3}"
    body="${response%???}"

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
      echo "$body"
      return 0
    elif [ "$http_code" -eq 429 ]; then
      sleep 60
    elif [ "$http_code" -ge 500 ]; then
      sleep $RETRY_DELAY
    else
      echo "API error: $http_code" >&2
      return 1
    fi
    ((retry++))
  done

  echo "Max retries reached" >&2
  return 1
}
```

### 5.2 日志记录

OpenClaw 每次执行必须记录日志到：
```
/root/.openclaw/workspace/jade-xhs-logs/{date}.log
```

日志格式：
```
[2026-06-19 07:00:01] [INFO] 选题采集开始
[2026-06-19 07:00:05] [INFO] baidu-search 搜索完成，获取30条结果
[2026-06-19 07:00:10] [INFO] 筛选后保留8条选题
[2026-06-19 07:00:12] [INFO] 回写ERP成功，写入8条选题
[2026-06-19 07:00:13] [INFO] 选题采集完成
```

### 5.3 健康检查

ERP 提供 health check 端点供 OpenClaw 检测：

```
GET /api/content/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2026-06-19T07:00:00Z",
  "database": "ok",
  "openclaw_api_key_valid": true
}
```

OpenClaw 每次执行前先调用 health check，失败则跳过本次执行。

### 5.4 幂等性设计

- 选题回写：根据 sourceUrl 去重，相同 URL 不重复写入
- 文案回写：根据 topicId 检查是否已生成，避免重复
- 反馈数据：每次同步新增一条记录（时序数据），不覆盖

---

## 六、用户交互边界（关键）

### 6.1 用户只与 ERP 前端交互

```
用户操作（ERP前端）          OpenClaw 自动执行（用户不操作）
─────────────────────         ──────────────────────────
✅ 查看选题列表                ❌ 不操作 OpenClaw
✅ 对选题评分（1-5星）          ❌ 不查看 OpenClaw 日志
✅ 审核文案（通过/拒绝）        ❌ 不配置 OpenClaw skill
✅ 创建推广计划                ❌ 不执行 OpenClaw 指令
✅ 查看反馈数据                ❌ 不直接调用 OpenClaw API
✅ 配置AI参数（API Key等）      ❌ 不登录 OpenClaw 容器
✅ 手动创建选题
✅ 输入内容链接（触发拆解）
```

### 6.2 ERP 前端触发 OpenClaw 的方式

由于 OpenClaw 无标准 HTTP API 接收外部请求，ERP 前端"触发"OpenClaw 的方式：

1. **定时轮询**（主要方式）：
   - OpenClaw 每日定时轮询 ERP API
   - 检查是否有待处理的任务（高分选题、待拆解链接等）
   - 自动执行

2. **状态标记**（辅助方式）：
   - 用户在 ERP 前端操作后，更新数据状态（如选题 status=approved）
   - OpenClaw 轮询时发现状态变化，触发对应流程
   - 例如：用户评分选题为5星 → status变为approved → OpenClaw 下次轮询时生成文案

3. **手动触发**（Phase 2 可选）：
   - ERP 前端提供"立即生成"按钮
   - 点击后在 ERP 数据库中创建一个"生成任务"记录
   - OpenClaw 轮询发现任务记录后立即执行
   - 执行完成后删除任务记录

### 6.3 AI 配置 Tab 的作用

ERP 前端的"AI 配置"Tab 让用户管理：
- OpenClaw API Key（ERP 侧生成，配置给 OpenClaw）
- 百度 API Key（配置给 OpenClaw 的 baidu-search skill）
- OpenClaw 运行状态显示（最近一次执行时间、成功/失败）
- 手动触发按钮（创建生成任务记录）

**用户不直接配置 OpenClaw**，只在 ERP 前端管理这些参数，OpenClaw 轮询时读取。

---

## 七、实施检查清单

### ERP 侧开发检查清单（本对话环境负责）

- [ ] 新增 `openclaw_api_key` SysConfig 配置项
- [ ] 认证中间件支持 OpenClaw API Key（长效）
- [ ] 开发 `GET /api/content/items` 安全内容API
- [ ] 开发 `GET /api/content/images/{filename}` 图片直链API
- [ ] 开发 `GET /api/content/health` 健康检查API
- [ ] 开发 `POST /api/content/topics` 选题回写API
- [ ] 开发 `POST /api/content/contents` 文案回写API
- [ ] 开发 `POST /api/content/analyze` 拆解回写API
- [ ] 开发 6 张内容推广数据表 + Prisma Migration
- [ ] 开发 5 个 Tab 的前端界面
- [ ] AI 配置 Tab 支持 API Key 管理
- [ ] OpenClaw API Key 权限隔离（只能调用内容API）

### OpenClaw 侧配置检查清单（用户/运维负责，非本对话环境）

- [ ] 配置环境变量（JADE_ERP_BASE_URL、JADE_ERP_API_KEY、BAIDU_API_KEY）
- [ ] 安装 baidu-search skill
- [ ] 安装 multi-search-engine skill
- [ ] 安装 xhs-content-ops skill（从 openclaw/skills 仓库）
- [ ] 配置 cron 定时任务
- [ ] 部署 jade-xhs-daily.sh 脚本
- [ ] 配置日志目录
- [ ] 测试与 ERP API 的连通性
- [ ] 启用沙箱模式（推荐）

---

## 八、相关文档索引

| 文档 | 路径 |
|------|------|
| PRD v0.3 | `docs/PRD-内容推广管理.md` |
| 假设评审报告 | `docs/PRD-v0.3-假设评审报告.md` |
| API对接规范 | `docs/API对接规范.md`（待编写） |
| 原始调度链提示词 | `docs/调度链提示词-jade-to-xhs.md` |
| OpenClaw内置工具文档 | https://www.openclawdoc.com/docs/agents/tools/ |
| ClawHub官方 | https://clawhub.ai/ |
