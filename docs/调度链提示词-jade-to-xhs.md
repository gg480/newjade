# 调度链提示词 — jade → OpenClaw → 小红书运营流水线

> 写给 jade 项目（`D:\02工作\ERP\newjade`）的开发者
> 目标：构建一条安全、可跑的玉器内容运营流水线
> 调度链：jade API（数据层）→ OpenClaw Agent（生成层）→ 输出（发布层）

---

## 一、当前状态

### 已就绪

| 组件 | 位置 | 状态 |
|------|------|------|
| jade-inventory 容器 | NAS `172.27.0.2:5000`, Host `:25888` | ✅ 运行中 |
| OpenClaw 网关 | NAS `172.22.0.2:18789`, Host `:50889` | ✅ 运行中 |
| Docker 网络 | openclaw 已桥接 jade 网络 | ✅ 可互访 |
| DeepSeek V4 Flash | OpenClaw 内置 | ✅ API Key 已配 |
| 内容 Skill | `d:\02工作\llm\.trae\skills\jade-xhs-ops\SKILL.md` | ✅ v0.2 |
| 每日脚本 | OpenClaw 容器 `/root/.openclaw/workspace/jade-xhs-daily.sh` | ✅ 已验证 |
| 文案生成 | DeepSeek API 实测 | ✅ 可用 |

### 阻塞项

| 阻塞项 | 原因 | 需要 jade 项目解决 |
|--------|------|-------------------|
| 🔴 **无图** | jade 库中 5,231 件货品几乎全部 imageCount=0 | 需拍照上传 or 确保现有图片可访问 |
| 🔴 **API 泄露底价** | `/api/items` 返回 `costPrice/allocatedCost/floorPrice` | 需新增安全内容 API |
| 🟡 **Token 手动刷新** | 7 天过期 | 待实现自动刷新 |
| 🟡 **未配置定时任务** | 需在 OpenClaw 设 cron | 配置即可 |

---

## 二、需要 jade 项目开发的：安全内容 API

### 2.1 问题

当前 `GET /api/items` 返回所有字段，包括不应暴露给 AI/外部的**敏感价格**：

```json
// ❌ 当前返回（泄露底价）
{
  "costPrice": 500,        // 成本价 — 绝不外泄
  "allocatedCost": 3572,   // 分摊成本 — 绝不外泄
  "floorPrice": 3750.6,    // 底价 — 绝不外泄
  "batch": {
    "totalCost": 14288,    // 批次总成本 — 绝不外泄
    "quantity": 4
  },
  "estimatedCost": 3572    // 预估成本 — 绝不外泄
}
```

### 2.2 方案：新增 `/api/content/items` 端点

**不会修改原有 `/api/items`**（保持 jade 后台功能不变），只新增一个面向内容运营的安全端点。

```
GET /api/content/items
```

**认证**：继续使用 Bearer Token（与现有认证体系一致）

**请求参数**（与 `/api/items` 兼容，无需改调用方）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | int | 页码，默认 1 |
| `size` | int | 每页条数，默认 20 |
| `status` | string | `in_stock` / `sold` / `returned` |
| `material_id` | int | 材质筛选 |
| `type_id` | int | 器型筛选 |
| `sort_by` | string | `created_at` / `selling_price` / `name` |
| `sort_order` | string | `asc` / `desc` |
| `has_images` | bool | `true` = 仅返回有图货品（运营核心需求） |
| `min_price` | float | 最低售价筛选 |
| `max_price` | float | 最高售价筛选 |

**返回字段（安全版—只给公开信息）**：

```typescript
// ✅ 新 API 返回结构
{
  "code": 0,
  "data": {
    "items": [{
      "id": 13658,
      "skuCode": "0101-0505-001",
      "name": "冰种飘花平安扣",
      "materialName": "翡翠",           // ✅ 材质名
      "materialCategory": "玉",          // ✅ 材质大类
      "typeName": "吊坠",               // ✅ 器型名
      "sellingPrice": 1800,             // ✅ 售价（公开）
      "spec": {                          // ✅ 规格
        "weight": 15.3,
        "braceletSize": "56",
        "beadDiameter": "8",
        "ringSize": null
      },
      "specText": "重15.3g 圈口56mm",   // ✅ 格式化规格文本
      "tags": ["冰种", "飘花", "平安扣"], // ✅ 标签
      "notes": "冰种飘花，水头足",       // ✅ 备注（不含底价暗示）
      "certNo": "N123456",              // ✅ 证书号
      "counter": 11,                     // ✅ 柜台号
      "images": [{                       // ✅ 图片
        "url": "/api/content/images/0610-0616-012_01.jpg",
        "isCover": true,
        "angleCode": "F"                 // F=正面 S=侧面 D=特写
      }],
      "ageDays": 15,                     // ✅ 在库天数
      "createdAt": "2026-06-03T05:17:58Z"
    }],
    "total": 5126,
    "page": 1,
    "size": 20
  }
}
```

**关键：绝不返回的字段**：

- ❌ `costPrice` — 成本价
- ❌ `allocatedCost` — 分摊成本  
- ❌ `floorPrice` — 底价
- ❌ `batch.totalCost` — 批次总成本
- ❌ `estimatedCost` — 估算成本
- ❌ `supplierId` / `supplier` — 供应商信息

### 2.3 实现位置

**新建文件**：

```
src/app/api/content/
├── items/
│   └── route.ts          # GET /api/content/items — 主端点
└── images/
    └── [filename]/
        └── route.ts      # GET /api/content/images/{filename} — 图片直链
```

**新建 Service**（可选，如果逻辑简单也可直接写在 route 中）：

```
src/services/content.service.ts
```

### 2.4 实现要点

```typescript
// src/app/api/content/items/route.ts 核心思路

export async function GET(req: Request) {
  // 1. 认证（复用现有 guardPermission）
  const denied = await guardPermission(req, 'action:item_view');
  if (denied) return denied;

  // 2. 解析参数，增加 has_images 过滤
  const { searchParams } = new URL(req.url);
  const hasImages = searchParams.get('has_images') === 'true';

  // 3. 查询 Prisma — 关键：select 白名单，不选 costPrice 等
  const items = await db.item.findMany({
    where: {
      isDeleted: false,
      status: 'in_stock',
      ...(hasImages ? { images: { some: {} } } : {}),
    },
    select: {
      id: true,
      skuCode: true,
      name: true,
      // materialName 通过 relation 取
      material: { select: { name: true, category: true } },
      type: { select: { name: true } },
      sellingPrice: true,           // ✅ 只选公开价格
      // ❌ costPrice — 不选
      // ❌ allocatedCost — 不选
      // ❌ floorPrice — 不选
      spec: true,
      tags: { select: { name: true } },
      notes: true,
      certNo: true,
      counter: true,
      images: {
        select: { filename: true, isCover: true, angleCode: true },
        orderBy: { sortOrder: 'asc' },
      },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * size,
    take: size,
  });

  // 4. 格式化返回，计算 specText、ageDays 等
  const items = rawItems.map(item => ({
    ...item,
    materialName: item.material?.name,
    materialCategory: item.material?.category,
    typeName: item.type?.name,
    tags: item.tags.map(t => t.name),
    specText: buildSpecText(item.spec),  // "重15.3g 圈口56mm"
    images: item.images.map(img => ({
      url: `/api/content/images/${img.filename}`,
      isCover: img.isCover,
      angleCode: img.angleCode,
    })),
  }));
}
```

### 2.5 图片端点

```
GET /api/content/images/{filename}
```

从 `public/images/` 或数据库记录的路径返回图片二进制流。
需要处理文件不存在的情况（当前大量货品无图，返回占位图或 404）。

---

## 三、调度链 — OpenClaw 多 Agent 工作流

### 3.1 架构

```
用户指令（自然语言 / 定时任务）
      │
      ▼
┌─────────────────────────────────────────────┐
│  Director Agent（OpenClaw 网关调度）          │
│  "帮我做今天的玉器小红书内容"                   │
├─────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │选题Agent │  │写作Agent │  │设计Agent │  │
│  │jade API  │  │DeepSeek  │  │HTML→截图 │  │
│  │选品策略  │  │生成文案  │  │封面制作  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │        │
│       └──────────────┼──────────────┘        │
│                      ▼                       │
│              ┌──────────────┐                │
│              │ 审核 Agent   │                │
│              │ 汇总→文件    │                │
│              │ 人工审核关卡 │                │
│              └──────────────┘                │
└─────────────────────────────────────────────┘
      │
      ▼
人工在小红书 APP 发布（当前方案）
或 xiaohongshu-mcp 自动发布（后续）
```

### 3.2 各 Agent 职责

#### Director Agent — 调度中枢

**输入**：自然语言指令 或 定时触发
**职责**：
1. 解析意图 → 决定今天做什么类型的选题
2. 派发子任务给各 Agent
3. 汇总结果，输出日报

**提示词框架**：
```
你是玉器小红书运营的 Director Agent。
你的工作是每天 07:00 自动执行以下流程：

1. 调用选题 Agent：从 jade API 拉取在库货品，按利润率 + 新鲜度 + 图片质量选 Top 3
2. 调用写作 Agent：对每件选中的货品生成小红书文案
3. 调用设计 Agent：为每篇文案匹配封面图
4. 汇总所有内容到 /root/.openclaw/workspace/xhs-daily/report-{date}.md
5. 输出审核清单，等待人工确认

约束：
- 绝不暴露成本价/底价/供应商信息
- 生成的内容必须先写入文件，人工审核后再发布
- 遇到 API 错误时记录日志并跳过该货品，不阻塞整体流程
```

#### 选题 Agent

**数据源**：`GET /api/content/items?status=in_stock&has_images=true&size=20&sort_by=created_at&sort_order=desc`

**选品策略**（优先级排序）：
1. **有图且高利润** — 售价/成本比高（但不说具体成本，只排序）
2. **新入库** — created_at 近 7 天
3. **有故事** — notes 非空 or certNo 非空 or tags 含"收藏级""高冰"等
4. **应季** — 根据运营日历匹配（如 6 月推冰种翡翠、手链）

#### 写作 Agent

**模型**：`deepseek/deepseek-v4-flash`

**系统提示词**：
```
你是专业的玉器珠宝小红书运营。
风格：第一人称店主视角，亲切真实，像朋友推荐。

每次生成必须遵守：
- 标题 15-25 字，含 emoji
- 正文 4 段式（初印象→卖点→场景→互动）
- 标签 5-8 个精准分类
- 绝不编造货品信息（没有的数据不说）
- 输出 JSON 格式：{"title":"...","hook":"...","content":"...","tags":[...]}
```

#### 设计 Agent（当前简化版）

由于 OpenClaw 容器暂无 Playwright，当前方案：
- 不生成合成封面图
- 直接用货品原图的第一张（isCover=true 或第一张）作为封面
- 多图货品按 F→S→D 排序输出

后续升级：安装 Playwright 后用 Design-as-Code 方案（HTML+CSS→截图）

### 3.3 调度链数据流

```
Step 1 — 选题 Agent
  curl "http://172.27.0.2:5000/api/content/items?status=in_stock&size=10&has_images=true"
  → 返回安全版货品数据（无底价）
  → 按策略排序，选 Top 3

Step 2 — 写作 Agent（对 Top 3 逐一执行）
  货品 JSON → 填入 Prompt 模板 → DeepSeek API
  → 返回 {"title":"...","content":"...","tags":[...],"hook":"..."}

Step 3 — 设计 Agent
  货品图片 URL → 筛选封面图
  → 下载到 workspace（可选）

Step 4 — 审核 Agent
  汇总 Step 1-3 的结果 → Markdown 报告
  → 写入 /root/.openclaw/workspace/xhs-daily/report-{date}.md
  → 日志通知：今日内容已生成，请审核后发布
```

---

## 四、安全规则

### 4.1 数据安全

| 规则 | 实现方式 |
|------|---------|
| API 只返回公开信息 | 新 `/api/content/items` 用 `select` 白名单，不选 costPrice/allocatedCost/floorPrice |
| 认证必须 | 复用 `guardPermission`，无 Token 拒绝访问 |
| Token 定期轮换 | 后续加 refresh 脚本 |
| 不暴露供应商 | `select` 不包含 supplier 关联 |

### 4.2 内容安全

| 规则 | 说明 |
|------|------|
| 不自动发布 | AI 生成内容写入文件，必须人工审核后再发布到小红书 |
| 不编造数据 | Prompt 约束：没有的数据不写（如货品无重量就不要写"重XXg"） |
| 价格只显示售价 | ¥标价是公开售价，不含成本信息 |

---

## 五、验证 CheckList

在 jade 项目完成开发后，逐项验证：

- [ ] `GET /api/content/items?has_images=true` 返回数据中**不包含** costPrice/allocatedCost/floorPrice/estimatedCost
- [ ] 返回数据中**包含** images 数组（url/isCover/angleCode）
- [ ] `GET /api/content/images/{filename}` 能正确返回图片
- [ ] 无 Token 访问时返回 401
- [ ] 从 OpenClaw 容器中能访问 `http://172.27.0.2:5000/api/content/items`
- [ ] 在 OpenClaw 对话中能触发选题→写作→输出全流程
- [ ] 生成的 report.md 中包含标题/正文/标签，不含成本信息

---

## 六、相关文件索引

| 文件 | 路径 |
|------|------|
| SKILL.md（运营方法论） | `d:\02工作\llm\.trae\skills\jade-xhs-ops\SKILL.md` |
| 配置缺失项文档 | `d:\02工作\llm\.trae\skills\jade-xhs-ops\配置缺失项.md` |
| 每日运行脚本 | OpenClaw 容器内 `/root/.openclaw/workspace/jade-xhs-daily.sh` |
| jade API 示例 | `D:\02工作\ERP\newjade\src\app\api\items\route.ts` |
| jade 数据模型 | `D:\02工作\ERP\newjade\prisma\schema.prisma` |
| jade PRD | `D:\02工作\ERP\newjade\PRD.md` |
| DeepSeek 已生成样本 | 冰种飘花平安扣 → 见上文测试结果 |
