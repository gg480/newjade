# OpenClaw v2 — 选题采集指令 & 数据契约

> 版本：v2.0 | 日期：2026-06-23
> 用途：定义 OpenClaw 选题采集 Agent 的完整工作流 + ERP 数据接收契约 + 机器可验证的格式校验
> 更新要点：引入 5-Skill 流水线、标准化 aiMetadata v2、评分信号前置

---

## 一、架构总览

### 1.1 数据流

```
OpenClaw 每日定时 (cron: 0 4 * * *)
  │
  ├─ Phase 1: 并行信号采集 ───────────────── 约 2-3 分钟
  │   ├── Skill A: baidu-search           (固定种子词搜索)
  │   ├── Skill B: hot-trends             (热搜交叉匹配)
  │   ├── Skill C: xiaohongshu-data-insight (小红书搜索)
  │   └── Skill D: multi-search-engine    (跨引擎验证, 仅高潜选题)
  │
  ├─ Phase 2: LLM 聚合推理 ──────────────── 约 30 秒
  │   └── DeepSeek 去重 + 打分 + 类型推断 + 关键词提炼
  │
  └─ Phase 3: 批量回写 ERP ──────────────── 约 5 秒
      └── POST /api/promotion/topics × N 次 (携带完整 aiMetadata v2)
```

### 1.2 两端分工

| 端 | 负责 | 关键产出 |
|:--:|------|---------|
| **OpenClaw** | 采集外部信号 → LLM 聚合 → 提交选题 | 符合 aiMetadata v2 契约的 POST 请求 |
| **ERP 后端** | 接收选题 → 计算内部评分 → 列表排序 | 可验证的 JSON Schema + 测试脚本 |

---

## 二、数据契约：aiMetadata v2 标准格式

### 2.1 JSON Schema（机器可验证）

这是 **OpenClaw 输出 → ERP 接收** 的数据契约。ERP 侧用此 Schema 做入参校验，OpenClaw 侧用它做输出格式验证。

文件位置：`docs/aiMetadata-schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "jade://promotion/aiMetadata/v2",
  "title": "AIMetadataV2",
  "description": "OpenClaw 选题采集 Agent 输出的 aiMetadata 标准格式。version=2.0",
  "type": "object",
  "required": ["version", "generatedBy", "generatedAt", "scoring"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^2\\.",
      "description": "契约版本，当前强制 v2.x"
    },
    "generatedBy": {
      "type": "string",
      "enum": ["openclaw-topic-agent"],
      "description": "生成方标识，固定值"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO8601 生成时间"
    },
    "signals": {
      "type": "object",
      "description": "各 Skill 采集的原始信号聚合",
      "properties": {
        "searchTrends": {
          "type": "object",
          "required": ["source", "seedKeyword", "trendDirection"],
          "properties": {
            "source":    { "type": "string", "enum": ["baidu-search"] },
            "seedKeyword":  { "type": "string", "minLength": 1 },
            "trendDirection": { "type": "string", "enum": ["up", "down", "stable"] },
            "trendChange":   { "type": "string", "pattern": "^[+-]?\\d+%$" },
            "relatedQueries": { "type": "array", "items": { "type": "string" } }
          }
        },
        "hotTrendMatch": {
          "type": "object",
          "required": ["source", "matchedHotTopics", "hotTopicRank", "platform"],
          "properties": {
            "source":   { "type": "string", "enum": ["hot-trends"] },
            "matchedHotTopics": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
            "hotTopicRank": { "type": "integer", "minimum": 1 },
            "platform": { "type": "string", "enum": ["baidu", "toutiao", "github"] }
          }
        },
        "xhsInsight": {
          "type": "object",
          "required": ["source", "relatedNoteCount", "avgInteraction"],
          "properties": {
            "source":   { "type": "string", "enum": ["xiaohongshu-data-insight"] },
            "relatedNoteCount": { "type": "integer", "minimum": 0 },
            "topNoteTitles":    { "type": "array", "items": { "type": "string" }, "maxItems": 5 },
            "avgInteraction":   { "type": "integer", "minimum": 0 }
          }
        },
        "multiEngine": {
          "type": "object",
          "required": ["source", "engineCount", "consensusLevel"],
          "properties": {
            "source":   { "type": "string", "enum": ["multi-search-engine"] },
            "engineCount":   { "type": "integer", "minimum": 1 },
            "consensusLevel": { "type": "string", "enum": ["high", "medium", "low"] }
          }
        },
        "contentSource": {
          "type": "object",
          "required": ["source", "sourceUrls"],
          "properties": {
            "source":     { "type": "string", "enum": ["web-fetch"] },
            "sourceUrls": { "type": "array", "items": { "type": "string", "format": "uri" } }
          }
        }
      },
      "minProperties": 1,
      "description": "至少有一个信号源"
    },
    "scoring": {
      "type": "object",
      "required": ["externalDemand", "externalTrend", "autoKeywords", "topicTypeInferred", "reasoning"],
      "properties": {
        "externalDemand": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "外部市场需求强度。0-1，参考维度：搜索量级 × 互动量级 × 热点匹配度"
        },
        "externalTrend": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "外部趋势成长性。0-1，参考维度：搜索增速 × 热度排名 × 跨平台共识度"
        },
        "autoKeywords": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 3,
          "maxItems": 8
        },
        "topicTypeInferred": {
          "type": "string",
          "enum": ["product", "category", "season", "trend"]
        },
        "reasoning": {
          "type": "string",
          "minLength": 10,
          "maxLength": 200,
          "description": "LLM 推理摘要，说明为什么给出这个打分和类型推断"
        }
      }
    }
  }
}
```

### 2.2 字段映射总表

```
POST /api/promotion/topics 请求体字段
═════════════════════════════════════════════════════════

title        ← 从搜索摘要/热搜标题/小红书标题中提取的最佳标题
             规则：15-25 字，含关键词，不含 emoji（ERP 端可加）

description  ← 选题概述（来源信号的简要说明）
             格式："{平台}近{N天}「{关键词}」相关笔记{N}条，互动均值{N}+，趋势{方向}{变化}"

topicType    ← LLM 从 signals 推断（product/category/season/trend）
             规则：
             - 关联了具体商品 → product
             - 按材质/器型聚合讨论 → category
             - 含节日/季节/节点信息 → season
             - 纯趋势话题无明确品类 → trend

source       ← 固定值 "ai"

sourceUrl    ← 如 web-fetch 有来源链接则填，否则 null

keywords     ← autoKeywords (scoring.autoKeywords) 的 3-8 个精准词

itemIds      ← 如能关联到 ERP 商品库具体 item 则填，否则 []

aiMetadata   ← 完整的 signals + scoring 对象（必须通过 JSON Schema 校验）

              ┌────────────────────────────────────┐
              │  ⚠️ 错误检查规则：                   │
              │  - externalDemand < 0.3 的选题不应提交 │
              │  - externalTrend 为 0 时必须有 reasoning 说明  │
              │  - signals 必须至少含一个信号源      │
              └────────────────────────────────────┘
```

### 2.3 完整示例（OpenClaw 输出 → ERP 接收）

```json
{
  "title": "翡翠手镯新中式叠戴搭配",
  "description": "小红书近7天「翡翠手镯叠戴」相关笔记1.2万条，互动均值2500+，百度搜索趋势上升42%，热搜「新中式穿搭」排名第8",
  "topicType": "trend",
  "source": "ai",
  "sourceUrl": null,
  "keywords": ["翡翠手镯", "叠戴", "新中式", "搭配技巧", "穿搭"],
  "itemIds": [103, 207, 315],
  "aiMetadata": {
    "version": "2.0",
    "generatedBy": "openclaw-topic-agent",
    "generatedAt": "2026-06-23T04:05:30Z",
    "signals": {
      "searchTrends": {
        "source": "baidu-search",
        "seedKeyword": "翡翠手镯",
        "trendDirection": "up",
        "trendChange": "+42%",
        "relatedQueries": ["翡翠手镯叠戴", "翡翠手镯搭配金饰", "冰种翡翠手镯推荐"]
      },
      "hotTrendMatch": {
        "source": "hot-trends",
        "matchedHotTopics": ["新中式穿搭"],
        "hotTopicRank": 8,
        "platform": "baidu"
      },
      "xhsInsight": {
        "source": "xiaohongshu-data-insight",
        "relatedNoteCount": 12580,
        "topNoteTitles": ["翡翠手镯叠戴|新中式绝配", "一条翡翠手镯的100种叠法"],
        "avgInteraction": 2540
      },
      "multiEngine": {
        "source": "multi-search-engine",
        "engineCount": 5,
        "consensusLevel": "high"
      }
    },
    "scoring": {
      "externalDemand": 0.85,
      "externalTrend": 0.72,
      "autoKeywords": ["翡翠", "手镯", "叠戴", "搭配", "新中式", "穿搭"],
      "topicTypeInferred": "trend",
      "reasoning": "小红书叠戴话题互动量高+百度搜索上升趋势明显+跨5引擎一致确认，赛道热度正处上升期。建议搭配金饰关联品类做组合推广"
    }
  }
}
```

---

## 三、Phase 1：OpenClaw 5-Skill 并行采集

### 3.1 Skill A：baidu-search — 核心搜索信号

**用途**：对固定种子词搜索，获取趋势方向 + 关联查询

**种子词列表**（每日轮询 6 个，分 4 组轮换）：

| 组 | 种子词 | 覆盖品类 |
|:--:|--------|----------|
| A | 翡翠手镯、翡翠吊坠、翡翠鉴别 | 翡翠核心 |
| B | 和田玉手镯、和田玉籽料、羊脂玉价格 | 和田玉 |
| C | 水晶手链、南红手串、文玩手串搭配 | 水晶/文玩/南红 |
| D | 珠宝送礼、本命年手链、新中式珠宝 | 场景/趋势 |

**执行方式**：OpenClaw Agent 调用 `baidu-search` skill 逐词搜索

**输出结构**（每词一条候选）：

```json
{
  "title": "冰种翡翠手镯价格走势分析",
  "description": "百度搜索「冰种翡翠手镯」趋势上升32%，关联搜索词：翡翠手镯鉴别、手镯圈口怎么选",
  "topicType": "product",
  "source": "ai",
  "keywords": ["冰种翡翠", "手镯", "价格", "趋势"],
  "aiMetadata": {
    "version": "2.0",
    "generatedBy": "openclaw-topic-agent",
    "generatedAt": "...",
    "signals": {
      "searchTrends": {
        "source": "baidu-search",
        "seedKeyword": "冰种翡翠手镯",
        "trendDirection": "up",
        "trendChange": "+32%",
        "relatedQueries": ["翡翠手镯鉴别", "手镯圈口怎么选", "冰种翡翠价格"]
      }
    },
    "scoring": { "_待Phase2填充": true }
  }
}
```

### 3.2 Skill B：hot-trends — 热搜交叉匹配

**用途**：获取实时热搜，匹配珠宝关键词

**过滤关键词池**（OpenClaw Agent 做字符串匹配）：

```
翡翠, 玉, 手镯, 手串, 戒指, 珠宝, 水晶, 玛瑙, 蜜蜡,
南红, 和田玉, 文玩, 项链, 黄金, 珍珠, 宝石, 钻戒,
送礼, 首饰, 搭配, 国风, 新中式, 传统, 手工艺
```

**输出结构**（匹配中一条即产生候选）：

```json
{
  "title": "「新中式穿搭」热搜第8名 — 翡翠手串搭配建议",
  "description": "百度热搜「新中式穿搭」排名第8，可关联文玩手串、翡翠手串等品类做内容",
  "topicType": "trend",
  "source": "ai",
  "keywords": ["新中式", "穿搭", "手串", "翡翠"],
  "aiMetadata": {
    "version": "2.0",
    "generatedBy": "openclaw-topic-agent",
    "generatedAt": "...",
    "signals": {
      "hotTrendMatch": {
        "source": "hot-trends",
        "matchedHotTopics": ["新中式穿搭"],
        "hotTopicRank": 8,
        "platform": "baidu"
      }
    },
    "scoring": { "_待Phase2填充": true }
  }
}
```

### 3.3 Skill C：xiaohongshu-data-insight — 小红书信号

**安装**：`openclaw skills install xiaohongshu-data-insight`
**环境变量**：`GUAIKEI_API_TOKEN=<token>`

**执行方式**：

```bash
# 对每个种子词，搜索按点赞排序取 Top 10
node src/xiaohongshu/search-cli.js "<种子词>" --sort 2 --limit 10

# 同时获取热榜
node src/xiaohongshu/search-cli.js "珠宝" --sort 1 --limit 20
```

**提取字段**：

| 字段 | 来源 |
|------|------|
| `relatedNoteCount` | 搜索结果总数 |
| `topNoteTitles` | 前5条笔记标题（提取高频词模式） |
| `avgInteraction` | 前10条平均互动数 (点赞+收藏+评论+分享)/4 |

**输出结构**：

```json
{
  "title": "从 Top 笔记标题提炼的选题",
  "description": "小红书搜索「翡翠手镯」相关笔记1.2万条，Top笔记互动均值2500+",
  "topicType": "trend",
  "source": "ai",
  "keywords": ["翡翠手镯", "叠戴", "搭配"],
  "aiMetadata": {
    "version": "2.0",
    "generatedBy": "openclaw-topic-agent",
    "generatedAt": "...",
    "signals": {
      "xhsInsight": {
        "source": "xiaohongshu-data-insight",
        "relatedNoteCount": 12580,
        "topNoteTitles": ["翡翠手镯叠戴|新中式绝配", "一条翡翠手镯的100种叠法"],
        "avgInteraction": 2540
      }
    },
    "scoring": { "_待Phase2填充": true }
  }
}
```

### 3.4 Skill D：multi-search-engine — 跨引擎交叉验证（选做）

**用途**：仅对 `externalDemand > 0.6` 的高潜选题做补搜，验证趋势不是单一引擎噪声

**安装**：`clawhub install multi-search-engine`

**输出**：`aiMetadata.signals.multiEngine = { engineCount, consensusLevel }`

### 3.5 Phase 1 输出汇总

所有 Skill 的原始输出统一暂存为临时文件：

```
/root/.openclaw/workspace/jade-topics/raw-{date}.json
```

格式为 JSON 数组，每条含 `{ title, description, topicType, keywords, aiMetadata: { version, signals } }`，**scoring 暂缺**，由 Phase 2 填充。

---

## 四、Phase 2：DeepSeek LLM 聚合推理

### 4.1 完整 Prompt

将 Phase 1 输出的 `raw-{date}.json` 全文拼入以下 Prompt，调用 DeepSeek。

```
你是一个翡翠/文玩珠宝行业的内容营销专家，精通小红书内容策略。

## 任务

下面是从多个渠道采集的今日原始选题信号，请你：

1. **去重合并**：同一个话题方向只保留一条最佳选题
   - 去重规则：标题相似度 > 80%（Levenshtein 或语义相似）则合并
   - 合并时保留最完整的 signals

2. **为每条选题填充 scoring**：
   - externalDemand (0-1)：市场需求强度
     参考：浏览量级>1万=0.7+，Top笔记互动均值>1000=0.6+，热搜匹配=0.3+
   - externalTrend (0-1)：趋势成长性
     参考：搜索趋势up+20%以上=0.7+，多引擎 consensus=high=0.8+，小红书笔记增速快=0.6+
   - autoKeywords：3-8个精准关键词（去掉太泛的如"珠宝""价格"）
   - topicTypeInferred：product / category / season / trend 之一
   - reasoning：50-100字的推理说明

3. **排序**：按 externalDemand × 0.6 + externalTrend × 0.4 降序

4. **截断**：只保留 top 15 条

## 信号数据

{ Phase 1 原始 JSON 数组全文 }

## 输出要求

只输出纯 JSON 数组，不要加任何解释或 markdown 代码块标记。

[
  {
    "title": "...",
    "description": "...",
    "topicType": "product|category|season|trend",
    "source": "ai",
    "keywords": ["..."],
    "itemIds": [],
    "aiMetadata": {
      "version": "2.0",
      "generatedBy": "openclaw-topic-agent",
      "generatedAt": "2026-06-23T04:05:30Z",
      "signals": { /* 合并后的 signals */ },
      "scoring": { externalDemand, externalTrend, autoKeywords, topicTypeInferred, reasoning }
    }
  }
]
```

### 4.2 验证规则（机器可执行的断言）

Phase 2 输出必须通过以下检查，任一失败则**不提交 ERP**：

```
✅ 检查 1：输出是合法 JSON
   python -c "import json; json.load(open('/tmp/phase2.json'))"

✅ 检查 2：每条都有 title 且非空
   python -c "
import json; data=json.load(open('/tmp/phase2.json'))
assert all(t.get('title','').strip() for t in data), '有空标题！'
print(f'OK: {len(data)}条选题, 全部有标题')
   "

✅ 检查 3：每条 aiMetadata.version 以 "2." 开头
   python -c "
import json; data=json.load(open('/tmp/phase2.json'))
assert all(t['aiMetadata']['version'].startswith('2.') for t in data), 'version 非 v2！'
print('OK: 全部 version=2.x')
   "

✅ 检查 4：每条 externalDemand >= 0.3
   python -c "
import json; data=json.load(open('/tmp/phase2.json'))
low = [t['title'] for t in data if t['aiMetadata']['scoring']['externalDemand'] < 0.3]
assert not low, f'以下选题 demand<0.3: {low}'
print('OK: 全部 demand>=0.3')
   "

✅ 检查 5：每条 reasoning 长度 10-200
   python -c "
import json; data=json.load(open('/tmp/phase2.json'))
short = [t['title'] for t in data if not (10 <= len(t['aiMetadata']['scoring']['reasoning']) <= 200)]
assert not short, f'以下选题 reasoning 长度不合规: {short}'
print('OK: 全部 reasoning 长度合规')
   "

✅ 检查 6：至少包含一个 signals 来源
   python -c "
import json; data=json.load(open('/tmp/phase2.json'))
for t in data:
    signals = t['aiMetadata'].get('signals', {})
    assert len(signals) >= 1, f'{t[\"title\"]} 没有 signals!'
print('OK: 全部有 signals')
   "
```

---

## 五、Phase 3：批量回写 ERP

### 5.1 调用规范

```http
POST /api/promotion/topics
Content-Type: application/json
Authorization: Bearer oc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
x-user-id: openclaw-agent

Body: (一条选题 JSON，完整 aiMetadata v2)
```

**ERP 侧处理**：
```
createTopic() 入库 (status="draft")
  → 自动触发 calculateTopicScore()
     ├─ 从 aiMetadata.scoring 提取 externalDemand / externalTrend
     ├─ 计算 stockRelevance / salesPotential / seasonMatch（内部信号）
     └─ 写入 totalScore
  → 返回选题 ID
```

### 5.2 回写脚本（OpenClaw 容器内执行）

```bash
#!/bin/bash
# /root/.openclaw/workspace/jade-topic-writeback.sh
# 用途：将 Phase 2 验证通过的选题批量回写 ERP
# 依赖：JADE_ERP_BASE_URL, JADE_ERP_API_KEY 环境变量

set -euo pipefail

PHASE2_FILE="${1:-/tmp/phase2.json}"
LOG_FILE="/root/.openclaw/workspace/jade-xhs-logs/$(date +%Y-%m-%d).log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# === Step 1: 验证输入 ===
if [ ! -f "$PHASE2_FILE" ]; then
    log "[ERROR] Phase 2 输出文件不存在: $PHASE2_FILE"
    exit 1
fi

# === Step 1.5: 机器验证 ===
log "[INFO] 开始 6 项格式验证..."
python3 -c "
import json
data = json.load(open('$PHASE2_FILE'))
assert isinstance(data, list), '不是 JSON 数组'
for i, t in enumerate(data):
    meta = t['aiMetadata']
    assert meta['version'].startswith('2.'), f'#{i} version 非 v2'
    sc = meta['scoring']
    assert 0 <= sc['externalDemand'] <= 1, f'#{i} demand 溢出'
    assert 0 <= sc['externalTrend'] <= 1, f'#{i} trend 溢出'
    assert 3 <= len(sc['autoKeywords']) <= 8, f'#{i} 关键词数量'
    assert sc['externalDemand'] >= 0.3, f'#{i} demand<0.3'
    assert 10 <= len(sc['reasoning']) <= 200, f'#{i} reasoning 长度'
    assert len(meta.get('signals', {})) >= 1, f'#{i} 无 signals'
print(f'OK: {len(data)} 条全部通过验证')
" 2>&1 | tee -a "$LOG_FILE"

WRITE_BACK_LOG="/root/.openclaw/workspace/jade-xhs-logs/$(date +%Y-%m-%d)-writeback.jsonl"

# === Step 2: 逐条回写 ===
jq -c '.[]' "$PHASE2_FILE" | while read -r topic; do
    title=$(echo "$topic" | jq -r '.title')
    log "[INFO] 回写选题: $title"

    # 等幂控制：检查是否已存在（按 title 去重）
    EXISTING=$(curl -s "${JADE_ERP_BASE_URL}/api/promotion/topics?keyword=$(echo "$title" | jq -sRr @uri)&limit=1" \
        -H "Authorization: Bearer ${JADE_ERP_API_KEY}" | jq -r '.data.items[0].id // ""')

    if [ -n "$EXISTING" ]; then
        log "[WARN] 选题已存在 (id=$EXISTING)，跳过"
        echo "{\"action\":\"skip\",\"title\":\"$title\",\"reason\":\"duplicate\",\"id\":\"$EXISTING\"}" >> "$WRITE_BACK_LOG"
        continue
    fi

    # 调用 POST
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST "${JADE_ERP_BASE_URL}/api/promotion/topics" \
        -H "Authorization: Bearer ${JADE_ERP_API_KEY}" \
        -H "Content-Type: application/json" \
        -H "x-user-id: openclaw-agent" \
        -d "$topic")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        ID=$(echo "$BODY" | jq -r '.data.id // "unknown"')
        log "[OK] 回写成功 (id=$ID, http=$HTTP_CODE)"
        echo "{\"action\":\"created\",\"title\":\"$title\",\"id\":\"$ID\",\"http\":$HTTP_CODE}" >> "$WRITE_BACK_LOG"
    elif [ "$HTTP_CODE" -eq 409 ]; then
        log "[WARN] 冲突 (title已存在)，跳过"
        echo "{\"action\":\"conflict\",\"title\":\"$title\",\"http\":409}" >> "$WRITE_BACK_LOG"
    else
        log "[ERROR] 回写失败 (http=$HTTP_CODE): $BODY"
        echo "{\"action\":\"failed\",\"title\":\"$title\",\"http\":$HTTP_CODE,\"body\":\"$BODY\"}" >> "$WRITE_BACK_LOG"
    fi

    # 间隔 1 秒，避免 ERP 压力
    sleep 1
done

# === Step 3: 汇总报告 ===
PASS=$(grep -c '"created"' "$WRITE_BACK_LOG" 2>/dev/null || echo 0)
SKIP=$(grep -c '"skip\|conflict"' "$WRITE_BACK_LOG" 2>/dev/null || echo 0)
FAIL=$(grep -c '"failed"' "$WRITE_BACK_LOG" 2>/dev/null || echo 0)
log "[SUMMARY] 总计=$(jq -c '.[]' "$PHASE2_FILE" | wc -l) 成功=$PASS 跳过=$SKIP 失败=$FAIL"
```

### 5.3 等幂性控制

| 场景 | ERP 处理方式 |
|------|-------------|
| 相同 title 的选题已存在 | 跳过，返回已有记录 ID（HTTP 200） |
| 相同 sourceUrl 的选题已存在 | 跳过（PostgreSQL 可加唯一索引） |
| OpenClaw 重复提交同一条 | 幂等，不创建重复记录 |
| 网络中断后的重试 | safe，不会产生脏数据 |

---

## 六、OpenClaw Agent 完整指令（可粘贴执行）

将以下内容粘贴到 OpenClaw 的 CLI 或配置为定时任务。

### 每日定时任务完整 Prompt

```
你是 jade 玉器小红书运营的选题采集 Agent。
今天是 {当前日期}。
你的任务是通过 5 个 Skill 采集信号并提交选题到 ERP。

===== Phase 1: 并行采集 =====

1. baidu-search — 搜索以下种子词（组D）：
   [珠宝送礼, 本命年手链, 新中式珠宝]
   每个词取前10条结果，提取标题+趋势方向+关联词

2. hot-trends — 获取百度热搜 Top 50：
   过滤关键词：[翡翠,玉,手镯,手串,珠宝,水晶,玛瑙,国风,新中式,送礼]
   匹配到的热搜词生成候选选题

3. xiaohongshu-data-insight — 搜索种子词：
   搜索词：[翡翠手镯, 手串搭配, 新中式珠宝]
   按最多点赞排序，取Top10，提取relatedNoteCount + topNoteTitles + avgInteraction

4. multi-search-engine（选做）：
   对 externalDemand 预计 > 0.6 的候选做交叉验证

===== Phase 2: LLM 聚合 =====

5. 调用 DeepSeek，prompt 见上文 4.1 节
   输入：Phase 1 全部原始输出
   输出：去重+排序后的 Top 15 选题 JSON

6. 运行 6 项机器验证（4.2 节的 6 个 python 断言）
   任一失败 → 自动重试 Phase 2（调整 DeepSeek 参数）

===== Phase 3: 回写 ERP =====

7. 运行 /root/.openclaw/workspace/jade-topic-writeback.sh
   ERP 端点：{JADE_ERP_BASE_URL}/api/promotion/topics
   API Key：{JADE_ERP_API_KEY}

8. 生成汇总日志并记录到 memory：
   memory_store: {
     "key": "topic_collection_{日期}",
     "value": "采集N条/成功N条/失败N条",
     "tags": ["jade", "topic", "collection"]
   }

===== 约束 =====
- 绝不编造数据：所有 title/keywords 必须有信号来源
- externalDemand < 0.3 的选题绝不提交
- 每个日期只执行一轮（晚于 12:00 的再次触发跳过）
- 遇到 API 错误记录日志，不阻塞整体流程
- token 过期时停止执行，记录报警
```

---

## 七、工作安排：两端并行开发计划

### 7.1 两端并行时间线

```
Day 1-2              Day 3-4              Day 5-6                Day 7
OpenClaw 侧          ERP 侧               OpenClaw 侧            联调验证
─────────────────────────────────────────────────────────────────────────
安装 4 个 Skill      新增 aiMetadata       DeepSeek Prompt 打磨    端到端联调
配置环境变量           JSON Schema 校验     Phase 2 聚合逻辑测试    日志检查
Phase 1 采集测试      回写 API 增强         6 项验证脚本调试       回写正确性验证
```

### 7.2 OpenClaw 侧工作清单

| # | 任务 | 验收标准 |
|:--:|------|---------|
| 1 | 安装 xiaohongshu-data-insight Skill | `openclaw skills install xiaohongshu-data-insight` 成功 |
| 2 | 安装 hot-trends Skill | `clawhub install hot-trends` 成功 |
| 3 | 配置环境变量 `GUAIKEI_API_TOKEN` | 搜索调用返回 200 |
| 4 | 配置 `JADE_ERP_BASE_URL` + `JADE_ERP_API_KEY` | `curl /api/content/health` 返回 ok |
| 5 | 部署 `jade-topic-writeback.sh` 脚本 | 脚本可执行，含验证逻辑 |
| 6 | 创建日志目录 `/root/.openclaw/workspace/jade-xhs-logs/` | 目录存在 |
| 7 | Phase 1 采集测试 → 输出 `raw-{date}.json` | 文件中含 signals 结构 |
| 8 | Phase 2 聚合测试 → 输出 `phase2.json` | 通过 6 项机器验证 |
| 9 | Phase 3 回写测试 → 检查 ERP 选题列表 | 选题出现在 ERP 前端 |

### 7.3 ERP 侧工作清单

| # | 任务 | 验收标准 |
|:--:|------|---------|
| 1 | 新增 aiMetadata v2 JSON Schema 校验中间件 | POST 请求字段不符合 Schema 时返回 400 |
| 2 | `createTopic()` 自动触发 `calculateTopicScore()` | 入库后 totalScore > 0 |
| 3 | `listTopics()` 支持 `sort_by=totalScore` | 前端传参 `sort_by=totalScore` 按综合评分排序 |
| 4 | `calculateStockRelevance()` 可选实现 | 可单独调用，不阻塞选题入库 |
| 5 | `calculateSalesPotential()` 可选实现 | 同上 |
| 6 | `calculateSeasonMatch()` 可选实现 | 同上 |

### 7.4 联调通过标准

```
✅ OpenClaw 端：Phase 1-3 完整跑通
✅ ERP 端：POST /api/promotion/topics 接收完整 aiMetadata v2，返回 201
✅ 机器验证：6 项断言全部通过
✅ 数据验证：ERP 前端选题列表能看到新提交的选题，排序正确
✅ 回放验证：同一批数据重复提交，不产生重复记录（幂等）
```

---

## 八、相关文件索引

| 文件 | 路径 | 说明 |
|------|------|------|
| aiMetadata v2 JSON Schema | `docs/aiMetadata-schema.json` | 机器可读的数据契约 |
| 回写脚本 | 见上文 5.2 节 | OpenClaw 容器内部署 |
| 验证脚本 | 见上文 4.2 节 | 6 项机器可执行断言 |
| ERP 选题服务 | `src/services/content-topic.service.ts` | `calculateTopicScore()` 实现位置 |
| ERP 选题类型 | `src/types/promotion.ts` | `ContentTopic` + `CreateTopicRequest` 类型 |
| ERP 数据模型 | `prisma/schema.prisma` (L669-696) | `model ContentTopic` |
| 现有 OpenClaw 文档 | `docs/OpenClaw配合指令.md` | v1.0（历史参考，本文件 v2.0 替代） |
| 现有调度链文档 | `docs/调度链提示词-jade-to-xhs.md` | 历史参考 |
| 现有 API 规范 | `docs/API对接规范.md` | 认证等规范仍有效 |
