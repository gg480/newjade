# API 对接规范文档

> 版本：v1.0 | 日期：2026-06-19
> 用途：定义 jade ERP 与 OpenClaw 之间的 API 对接规范
> 范围：安全内容API、推广管理API、OpenClaw回写API的完整规范

---

## 一、架构总览

### 1.1 数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                    用户（运营人员）                                │
│                    ↓ 只与 ERP 前端交互                             │
├─────────────────────────────────────────────────────────────────┤
│                    jade ERP 前端（Next.js）                       │
│                    ↓ 调用推广管理API                               │
├─────────────────────────────────────────────────────────────────┤
│                    jade ERP 后端（API Routes）                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 推广管理API   │  │ 安全内容API   │  │ OpenClaw回写API│          │
│  │ (前端调用)    │  │ (OpenClaw调用)│  │ (OpenClaw调用)│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ↓                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              认证中间件（双Token机制）                    │    │
│  │  用户会话Token（7天）│ OpenClaw API Key（长效）           │    │
│  └────────────────────────────────────────────────────────┘    │
│                           ↓                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Prisma + SQLite 数据库                      │    │
│  │  现有表 + 6张内容推广新表                                 │    │
│  └────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                    ↑ OpenClaw 轮询/回写                           │
├─────────────────────────────────────────────────────────────────┤
│                    OpenClaw（NAS部署）                            │
│  ├── 定时轮询 ERP API（获取任务）                                │
│  ├── 调用 skill 执行任务（baidu-search/web-fetch等）              │
│  ├── 调用 DeepSeek 生成内容                                      │
│  └── 回写结果到 ERP API                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 API 分类

| 分类 | 调用方 | 认证方式 | 用途 |
|------|--------|---------|------|
| 推广管理API | ERP前端 | 用户会话Token | 前端CRUD操作 |
| 安全内容API | OpenClaw | OpenClaw API Key | 读取商品数据（无底价） |
| OpenClaw回写API | OpenClaw | OpenClaw API Key | 写入选题/文案/拆解结果 |
| 健康检查API | OpenClaw | OpenClaw API Key | 检查ERP可用性 |

---

## 二、认证机制规范

### 2.1 双 Token 机制

ERP 认证中间件支持两种 Token：

#### 2.1.1 用户会话 Token（现有）

- **格式**：JWT，7天有效期
- **获取**：`POST /api/auth/login`
- **用途**：ERP 前端用户操作
- **权限**：根据用户角色分配权限

#### 2.1.2 OpenClaw API Key（新增）

- **格式**：`oc_` + 32位随机字符串（例：`oc_a1b2c3d4e5f6...`）
- **有效期**：长效（手动撤销才失效）
- **存储**：SysConfig 表，key = `openclaw_api_key`
- **用途**：OpenClaw 调用内容API
- **权限**：只能调用以下端点：
  - `GET /api/content/items`
  - `GET /api/content/images/{filename}`
  - `GET /api/content/health`
  - `POST /api/content/topics`
  - `POST /api/content/contents`
  - `POST /api/content/analyze`
  - `GET /api/promotion/topics`
  - `GET /api/promotion/promotions`
  - `POST /api/promotion/metrics/{id}`

### 2.2 认证中间件实现规范

```typescript
// src/lib/auth.ts 新增函数

/**
 * 验证请求认证（支持双Token）
 * 优先检查 OpenClaw API Key，其次检查用户会话Token
 */
export async function verifyAuth(req: Request): Promise<{
  authenticated: boolean;
  authType: 'openclaw' | 'user' | 'none';
  userId?: string;
  permissions?: string[];
}> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, authType: 'none' };
  }

  const token = authHeader.substring(7);

  // 1. 检查是否是 OpenClaw API Key
  if (token.startsWith('oc_')) {
    const openclawKey = await SysConfig.get('openclaw_api_key');
    if (token === openclawKey) {
      return {
        authenticated: true,
        authType: 'openclaw',
        permissions: ['content:read', 'content:write', 'promotion:read', 'promotion:metrics:write']
      };
    }
  }

  // 2. 检查用户会话 Token（现有逻辑）
  const session = await verifySessionToken(token);
  if (session) {
    return {
      authenticated: true,
      authType: 'user',
      userId: session.userId,
      permissions: session.permissions
    };
  }

  return { authenticated: false, authType: 'none' };
}

/**
 * OpenClaw API 专用守卫
 * 只允许 OpenClaw API Key 访问
 */
export async function guardOpenClawAPI(req: Request): Promise<Response | null> {
  const auth = await verifyAuth(req);
  if (!auth.authenticated) {
    return Response.json({ code: 401, message: '未授权' }, { status: 401 });
  }
  if (auth.authType !== 'openclaw') {
    return Response.json({ code: 403, message: '此端点仅限OpenClaw访问' }, { status: 403 });
  }
  return null; // 认证通过
}
```

---

## 三、安全内容API 规范

### 3.1 GET /api/content/items（读取商品数据）

**用途**：OpenClaw 读取商品数据用于内容生成
**认证**：OpenClaw API Key
**权限**：content:read

#### 请求参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| page | int | 否 | 1 | 页码 |
| size | int | 否 | 20 | 每页条数（最大50） |
| status | string | 否 | in_stock | 商品状态：in_stock/sold/returned |
| has_images | bool | 否 | false | true=仅返回有图货品 |
| topic_id | string | 否 | - | 关联选题ID，返回该选题关联的商品 |
| material_id | string | 否 | - | 材质筛选 |
| type_id | string | 否 | - | 器型筛选 |
| min_price | float | 否 | - | 最低售价 |
| max_price | float | 否 | - | 最高售价 |
| sort_by | string | 否 | created_at | 排序字段：created_at/selling_price/name |
| sort_order | string | 否 | desc | 排序方向：asc/desc |

#### 响应格式

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "13658",
        "skuCode": "0101-0505-001",
        "name": "冰种飘花平安扣",
        "materialName": "翡翠",
        "materialCategory": "玉",
        "typeName": "吊坠",
        "sellingPrice": 1800,
        "spec": {
          "weight": 15.3,
          "braceletSize": "56",
          "beadDiameter": "8",
          "ringSize": null
        },
        "specText": "重15.3g 圈口56mm",
        "tags": ["冰种", "飘花", "平安扣"],
        "notes": "冰种飘花，水头足",
        "certNo": "N123456",
        "counter": 11,
        "images": [
          {
            "url": "/api/content/images/0610-0616-012_01.jpg",
            "isCover": true,
            "angleCode": "F"
          }
        ],
        "ageDays": 15,
        "createdAt": "2026-06-03T05:17:58Z"
      }
    ],
    "total": 5126,
    "page": 1,
    "size": 20
  }
}
```

#### 实现要点（关键安全规则）

```typescript
// src/app/api/content/items/route.ts

export async function GET(req: Request) {
  // 1. 认证（只允许 OpenClaw API Key）
  const denied = await guardOpenClawAPI(req);
  if (denied) return denied;

  // 2. 解析参数
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = Math.min(parseInt(searchParams.get('size') || '20'), 50);
  const hasImages = searchParams.get('has_images') === 'true';
  const topicId = searchParams.get('topic_id');

  // 3. 查询 Prisma — 关键：select 白名单，绝不选成本相关字段
  const items = await db.item.findMany({
    where: {
      isDeleted: false,
      status: searchParams.get('status') || 'in_stock',
      ...(hasImages ? { images: { some: {} } } : {}),
      ...(topicId ? { topicItems: { some: { topicId } } } : {}),
    },
    select: {
      id: true,
      skuCode: true,
      name: true,
      material: { select: { name: true, category: true } },
      type: { select: { name: true } },
      sellingPrice: true,           // ✅ 只选公开价格
      // ❌ 绝不选：costPrice, allocatedCost, floorPrice, estimatedCost
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
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * size,
    take: size,
  });

  // 4. 格式化返回
  const formattedItems = items.map(item => ({
    ...item,
    materialName: item.material?.name,
    materialCategory: item.material?.category,
    typeName: item.type?.name,
    tags: item.tags.map(t => t.name),
    specText: buildSpecText(item.spec),
    images: item.images.map(img => ({
      url: `/api/content/images/${img.filename}`,
      isCover: img.isCover,
      angleCode: img.angleCode,
    })),
    ageDays: Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000),
  }));

  return Response.json({
    code: 0,
    data: { items: formattedItems, total, page, size }
  });
}
```

### 3.2 GET /api/content/images/{filename}（图片直链）

**用途**：OpenClaw 获取商品图片
**认证**：OpenClaw API Key 或 用户会话Token
**权限**：content:read

#### 响应

- 图片存在：返回图片二进制流（Content-Type: image/jpeg）
- 图片不存在：返回404占位图

```typescript
// src/app/api/content/images/[filename]/route.ts

export async function GET(
  req: Request,
  { params }: { params: { filename: string } }
) {
  const denied = await guardPermission(req, 'content:read');
  if (denied) return denied;

  const imagePath = path.join(process.cwd(), 'public', 'images', params.filename);

  if (!fs.existsSync(imagePath)) {
    // 返回占位图
    const placeholder = path.join(process.cwd(), 'public', 'placeholder.png');
    const data = await fs.readFile(placeholder);
    return new Response(data, {
      headers: { 'Content-Type': 'image/png' }
    });
  }

  const data = await fs.readFile(imagePath);
  return new Response(data, {
    headers: { 'Content-Type': 'image/jpeg' }
  });
}
```

### 3.3 GET /api/content/health（健康检查）

**用途**：OpenClaw 执行前检查 ERP 可用性
**认证**：OpenClaw API Key

#### 响应

```json
{
  "status": "ok",
  "timestamp": "2026-06-19T07:00:00Z",
  "database": "ok",
  "openclaw_api_key_valid": true
}
```

---

## 四、OpenClaw 回写API 规范

### 4.1 POST /api/content/topics（回写选题）

**用途**：OpenClaw 回写 AI 生成的选题
**认证**：OpenClaw API Key
**权限**：content:write

#### 请求体

```json
{
  "title": "冰种翡翠手镯夏季搭配指南",
  "description": "夏季翡翠搭配趋势分析",
  "topicType": "trend",
  "source": "ai",
  "sourceUrl": "https://example.com/article",
  "keywords": ["翡翠", "手镯", "夏季"],
  "aiMetadata": {
    "searchEngine": "baidu",
    "searchQuery": "翡翠 小红书 热门",
    "searchResults": "..."
  }
}
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "id": "topic_cuid_xxx",
    "title": "冰种翡翠手镯夏季搭配指南",
    "status": "draft",
    "createdAt": "2026-06-19T07:00:00Z"
  }
}
```

#### 幂等性规则

- 根据 `sourceUrl` 去重：相同 URL 不重复写入
- 如已存在相同 sourceUrl 的选题，返回已有选题ID，不创建新记录

### 4.2 POST /api/content/contents（回写文案）

**用途**：OpenClaw 回写 AI 生成的文案
**认证**：OpenClaw API Key
**权限**：content:write

#### 请求体

```json
{
  "topicId": "topic_cuid_xxx",
  "title": "夏日翡翠💚冰种手镯搭配指南",
  "body": "初印象：这只冰种手镯水头十足...",
  "tags": ["翡翠", "冰种", "手镯", "夏季搭配"],
  "contentMode": "种草",
  "status": "draft",
  "aiModel": "deepseek-v4-flash",
  "aiPrompt": "你是专业的玉器珠宝小红书运营...",
  "images": ["/api/content/images/xxx.jpg"]
}
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "id": "content_cuid_xxx",
    "topicId": "topic_cuid_xxx",
    "title": "夏日翡翠💚冰种手镯搭配指南",
    "status": "draft",
    "version": 1,
    "createdAt": "2026-06-19T09:00:00Z"
  }
}
```

#### 幂等性规则

- 根据 `topicId` 检查是否已生成文案
- 如已存在且 status=draft，更新现有记录（version+1）
- 如已存在且 status!=draft（已审核），创建新版本记录

### 4.3 POST /api/content/analyze（回写拆解结果）

**用途**：OpenClaw 回写内容拆解结果
**认证**：OpenClaw API Key
**权限**：content:write

#### 请求体

```json
{
  "topicId": "topic_cuid_xxx",
  "aiMetadata": {
    "originalTitle": "原标题",
    "originalUrl": "https://mp.weixin.qq.com/...",
    "keyPoints": ["观点1", "观点2", "观点3"],
    "restructuredContent": {
      "title": "重组标题",
      "hook": "Hook内容",
      "body": "正文内容",
      "tags": ["标签1", "标签2"]
    }
  }
}
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "topicId": "topic_cuid_xxx",
    "status": "analyzed",
    "updatedAt": "2026-06-19T08:00:00Z"
  }
}
```

---

## 五、推广管理API 规范（前端调用）

### 5.1 选题管理

#### GET /api/promotion/topics（选题列表）

**认证**：用户会话Token
**权限**：tab:content-promotion

**查询参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 |
| size | int | 每页条数 |
| status | string | 状态筛选 |
| source | string | 来源筛选 |
| min_rating | int | 最低评分 |
| sort_by | string | 排序字段 |

**响应**：
```json
{
  "code": 0,
  "data": {
    "topics": [...],
    "total": 100,
    "page": 1,
    "size": 20
  }
}
```

#### POST /api/promotion/topics（创建选题）

**认证**：用户会话Token
**请求体**：
```json
{
  "title": "手动创建的选题",
  "description": "描述",
  "topicType": "product",
  "source": "manual",
  "sourceUrl": "https://...",
  "keywords": ["关键词"],
  "itemIds": ["item_id_1", "item_id_2"]
}
```

#### PATCH /api/promotion/topics/{id}/rating（评分）

**认证**：用户会话Token
**请求体**：
```json
{
  "rating": 5,
  "ratingNote": "很好的选题"
}
```

#### PATCH /api/promotion/topics/{id}/review（审核）

**认证**：用户会话Token
**请求体**：
```json
{
  "action": "approve",
  "note": "审核通过"
}
```

### 5.2 文案管理

#### GET /api/promotion/contents（文案列表）
#### POST /api/promotion/contents（创建文案）
#### GET /api/promotion/contents/{id}（文案详情）
#### PATCH /api/promotion/contents/{id}（更新文案）
#### PATCH /api/promotion/contents/{id}/review（文案审核）
#### POST /api/promotion/contents/{id}/check（违禁词检测）

### 5.3 推广管理

#### GET /api/promotion/promotions（推广列表）
#### POST /api/promotion/promotions（创建推广）
#### PATCH /api/promotion/promotions/{id}/status（状态变更）
#### GET /api/promotion/items/{itemId}/history（商品推广历史）

### 5.4 反馈数据

#### GET /api/promotion/metrics/{promotionId}（反馈查询）
#### POST /api/promotion/metrics/{promotionId}（反馈录入）

**认证**：OpenClaw API Key 或 用户会话Token
**请求体**：
```json
{
  "viewCount": 1234,
  "likeCount": 56,
  "collectCount": 12,
  "commentCount": 3,
  "shareCount": 2,
  "dataSource": "browser"
}
```

### 5.5 AI 配置

#### GET /api/promotion/config（获取配置）
#### PUT /api/promotion/config（更新配置）

**可配置项**：
- `openclaw_api_key`：OpenClaw API Key
- `baidu_api_key`：百度AI搜索API Key
- `openclaw_base_url`：OpenClaw 地址（用于显示状态）
- `openclaw_last_run`：最近执行时间（只读，由回写API更新）

---

## 六、统一响应格式

### 6.1 成功响应

```json
{
  "code": 0,
  "data": { ... },
  "message": "操作成功"
}
```

### 6.2 错误响应

```json
{
  "code": 400,
  "message": "错误描述",
  "details": {
    "field": "具体字段错误"
  }
}
```

### 6.3 HTTP 状态码规范

| 状态码 | 说明 | 使用场景 |
|--------|------|---------|
| 200 | 成功 | GET/PUT/PATCH 成功 |
| 201 | 创建成功 | POST 创建成功 |
| 400 | 请求错误 | 参数验证失败 |
| 401 | 未授权 | Token 无效或缺失 |
| 403 | 禁止访问 | 权限不足 |
| 404 | 资源不存在 | ID 不存在 |
| 409 | 冲突 | 重复创建 |
| 429 | 频率限制 | 请求过于频繁 |
| 500 | 服务器错误 | 内部异常 |

---

## 七、OpenClaw 调用示例

### 7.1 读取商品数据（curl）

```bash
curl -X GET \
  "http://172.27.0.2:5000/api/content/items?has_images=true&size=10" \
  -H "Authorization: Bearer oc_a1b2c3d4e5f6..."
```

### 7.2 回写选题（curl）

```bash
curl -X POST \
  "http://172.27.0.2:5000/api/content/topics" \
  -H "Authorization: Bearer oc_a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "冰种翡翠手镯夏季搭配指南",
    "topicType": "trend",
    "source": "ai",
    "keywords": ["翡翠", "手镯", "夏季"]
  }'
```

### 7.3 健康检查（curl）

```bash
curl -X GET \
  "http://172.27.0.2:5000/api/content/health" \
  -H "Authorization: Bearer oc_a1b2c3d4e5f6..."
```

### 7.4 OpenClaw 脚本中的调用（Python）

```python
import requests
import os

JADE_ERP_BASE_URL = os.environ.get('JADE_ERP_BASE_URL', 'http://172.27.0.2:5000')
JADE_ERP_API_KEY = os.environ.get('JADE_ERP_API_KEY', '')

headers = {
    'Authorization': f'Bearer {JADE_ERP_API_KEY}',
    'Content-Type': 'application/json'
}

# 1. 健康检查
health = requests.get(f'{JADE_ERP_BASE_URL}/api/content/health', headers=headers)
if health.json()['status'] != 'ok':
    print('ERP 不可用，退出')
    exit(1)

# 2. 读取高分选题
topics = requests.get(
    f'{JADE_ERP_BASE_URL}/api/promotion/topics?status=approved&min_rating=4',
    headers=headers
).json()

# 3. 对每个选题生成文案
for topic in topics['data']['topics']:
    # 获取关联商品
    items = requests.get(
        f'{JADE_ERP_BASE_URL}/api/content/items?topic_id={topic["id"]}&has_images=true',
        headers=headers
    ).json()

    # 调用 DeepSeek 生成文案（此处省略）
    generated_content = generate_content(topic, items)

    # 回写文案
    requests.post(
        f'{JADE_ERP_BASE_URL}/api/content/contents',
        headers=headers,
        json=generated_content
    )
```

---

## 八、开发优先级

### Phase 1（ERP MVP，本对话环境负责）

**必须开发**：
1. 认证中间件支持双Token（用户Token + OpenClaw API Key）
2. `GET /api/content/items` 安全内容API
3. `GET /api/content/images/{filename}` 图片直链API
4. `GET /api/content/health` 健康检查API
5. 推广管理API（14个端点，前端CRUD）
6. 6张内容推广数据表 + Prisma Migration
7. 5个Tab前端界面

**可选开发**（Phase 2前完成）：
8. `POST /api/content/topics` 选题回写API
9. `POST /api/content/contents` 文案回写API
10. `POST /api/content/analyze` 拆解回写API

### Phase 2（OpenClaw 集成，用户/运维负责）

**OpenClaw 侧配置**：
1. 配置环境变量
2. 安装 skill
3. 配置 cron 定时任务
4. 部署执行脚本

### Phase 3（发布与数据自动化）

1. 安装 xhs-content-ops skill
2. 实现发布草稿功能
3. 实现反馈数据自动同步

---

## 九、相关文档

| 文档 | 路径 |
|------|------|
| PRD v0.3 | `docs/PRD-内容推广管理.md` |
| 假设评审报告 | `docs/PRD-v0.3-假设评审报告.md` |
| OpenClaw配合指令 | `docs/OpenClaw配合指令.md` |
| 原始调度链提示词 | `docs/调度链提示词-jade-to-xhs.md` |
