# 翡翠进销存管理系统 产品需求文档 (PRD)

| 项目 | 内容 |
|------|------|
| **文档版本** | v1.0 |
| **更新日期** | 2026-04-25 |
| **状态** | 已上线 |
| **产品负责人** | - |
| **技术负责人** | - |

---

## 一、产品概述

### 1.1 产品定位

翡翠进销存管理系统是一款专为翡翠及珠宝玉石行业设计的进销存管理工具，涵盖库存管理、销售记录、批次管理、客户关系、数据分析等核心业务场景。系统支持高货（单件）和通货（批次）两种业务模式，助力企业实现精细化管理和数据驱动决策。

### 1.2 核心价值

- **双轨并行**: 支持高货单件管理和通货批次管理两种模式
- **全程追溯**: 从采购入库到销售退货的完整业务链路追踪
- **智能分摊**: 批次成本自动分摊，支持按重量/价格/数量多种方式
- **数据分析**: 23+ 数据看板图表，支持月度/季度/年/全部时间多维度分析
- **操作审计**: 完整的操作日志记录，支持数据变更追溯

### 1.3 目标用户

> 系统为单人操作设计，仅1个实际操作用户。

| 用户角色 | 使用场景 |
|---------|---------|
| 店主/运营者 | 日常销售、库存查看、客户管理、入库登记、批次管理、数据分析 |

---

## 二、技术架构

### 2.1 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| UI组件库 | shadcn/ui + Tailwind CSS 4 |
| 状态管理 | Zustand |
| 图表库 | Recharts |
| 后端框架 | Next.js API Routes |
| 数据库 | SQLite via Prisma ORM |
| 部署 | Docker Compose |

### 2.2 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (Next.js SPA)                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │Dashboard│ │Inventory│ │ Sales   │ │ Batches │  ...    │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘         │
│       └──────────┬┴──────────┬┴──────────┘               │
│            ┌─────▼──────┐                              │
│            │   Zustand   │                              │
│            └─────┬──────┘                              │
└──────────────────┼──────────────────────────────────────┘
                   │ HTTP/REST
┌──────────────────▼──────────────────────────────────────┐
│                  API Routes (60+)                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │ /items │ │ /sales │ │/batches│ │/dicts  │  ...       │
│  └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘            │
│       └──────────┼──────────┼──────────┘                │
└──────────────────┼──────────┼────────────────────────────┘
                   │          │
              ┌─────▼─────────▼─────┐
              │   Prisma ORM        │
              │   ┌───────────────┐ │
              │   │    SQLite     │ │
              │   │  custom.db    │ │
              │   └───────────────┘ │
              └─────────────────────┘
```

### 2.3 数据库模型 (18张表)

```
┌─────────────────┐     ┌─────────────────┐
│   SysConfig     │     │   DictMaterial  │
│   系统配置       │     │   材质字典       │
└────────┬────────┘     └────────┬────────┘
         │                       │
┌────────▼────────┐     ┌────────▼────────┐
│    User        │     │   DictType      │
│    用户        │     │   器型字典       │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   DictTag       │◄────│  DictTagMaterial│
│   标签字典       │     │  标签材质关联    │
└────────┬────────┘     └─────────────────┘
         │
┌────────▼────────┐
│    ItemTag      │
│   货品标签关联   │
└────────┬────────┘
         │
┌────────▼────────┐     ┌─────────────────┐
│     Item        │◄────│    ItemSpec      │
│     货品        │     │    货品规格      │
└────────┬────────┘     └─────────────────┘
         │             ┌─────────────────┐
┌────────▼────────┐    │   ItemImage     │
│     Batch       │    │    货品图片      │
│     批次        │    └─────────────────┘
└────────┬────────┘
         │
┌────────▼────────┐     ┌─────────────────┐
│   Supplier      │     │    Customer     │
│    供应商        │     │    客户         │
└─────────────────┘     └────────┬────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
┌────────▼────────┐     ┌──────▼──────┐       ┌───────▼──────┐
│  SaleRecord     │     │  BundleSale  │       │  SaleReturn   │
│   销售记录       │     │   套装销售    │       │   退货记录    │
└─────────────────┘     └──────────────┘       └──────────────┘

┌─────────────────┐     ┌─────────────────┐
│   MetalPrice    │     │  OperationLog   │
│   贵金属价格     │     │    操作日志      │
└─────────────────┘     └─────────────────┘
```

---

## 三、功能模块

### 3.1 模块总览

| 模块名称 | 功能描述 | 优先级 |
|---------|---------|--------|
| 利润看板 | Dashboard数据看板，23+图表 | P0 |
| 库存管理 | 货品CRUD、图片、标签管理 | P0 |
| 销售记录 | 销售登记、退货处理 | P0 |
| 批次管理 | 批次入库、成本分摊 | P0 |
| 客户管理 | 客户档案、搜索、手机/微信 | P1 |
| 供应商管理 | 供应商档案 | P1 |
| 贵金属定价 | 金银等贵金属每日定价 | P1 |
| 系统设置 | 字典管理、系统配置 | P1 |
| 操作日志 | 业务操作审计追踪 | P2 |
| 数据导入 | CSV批量导入 | P2 |
| 数据导出 | CSV/Excel导出 | P2 |
| 备份恢复 | 数据库备份下载/恢复 | P2 |
| 条码扫描 | 扫码枪支持 | P3 |
| 标签打印 | 货品标签打印 | P3 |

---

### 3.2 利润看板 (Dashboard)

#### 3.2.1 核心指标卡片

| 指标名称 | 计算方式 | 展示形式 |
|---------|---------|---------|
| 今日利润 | 今日销售额 - 今日成本 | 数值 + 利润率% |
| 平均周转天数 | 30 / 周转率 | 天数 |
| 在库数量 | status=in_stock 的 item 总数 | 数值 |
| 在库价值 | 在库物品 allocatedCost 汇总 | 数值 |
| 本月销售 | 本月 SaleRecord.actualPrice 求和 | 数值 |
| 本月利润 | 本月利润求和 | 数值 |
| 客户总数 | Customer 表总数 | 数值 |
| 批次数量 | Batch 表总数 | 数值 |

#### 3.2.2 图表列表

| 图表名称 | 类型 | 数据维度 |
|---------|------|---------|
| 利润趋势图 | 折线图 | 月度/季度/年 |
| 销售走势图 | 面积图 | 日度 |
| 库存走势图 | 折线图 | 日度 |
| 批次利润柱状图 | 柱状图 | 月度 |
| 类别利润分布 | 饼图 | 材质/器型 |
| 渠道销售分布 | 饼图 | store/wechat |
| 库存周转分析 | 散点图 | 批次维度 |
| 价格区间分布 | 柱状图 | 成本价/售价 |
| 重量分布图 | 柱状图 | 重量区间 |
| 库龄分布图 | 柱状图 | 30/60/90/180/360天 |
| 批次入库进度 | 进度条 | 批次完成度 |
| 月环比数据 | 数值 | 销售额/利润/数量 |
| Turnover分析 | 数值 | 周转率/天数 |
| 热力图 | 颜色矩阵 | 销售渠道x时间 |
| Top销售排行 | 列表 | 前10商品 |
| 客户购买频次 | 直方图 | 频次分布 |
| Top客户排行 | 列表 | 累计消费 |
| 材质库存分布 | 饼图 | 材质维度 |
| 日销售趋势 | 迷你线图 | 近30日 |
| 库龄趋势 | 迷你线图 | 近30日 |
| 库存金额趋势 | 迷你面积图 | 近30日 |

#### 3.2.3 时间筛选

- 月度 (Month)
- 季度 (Quarter)
- 年度 (Year)
- 全部 (All)
- 自定义日期范围

---

### 3.3 库存管理

#### 3.3.1 货品数据模型

```typescript
interface Item {
  id: number;
  skuCode: string;           // 系统生成，如: 0601-0417-001
  name: string;               // 货品名称
  batchCode: string;          // 关联批次编码
  materialId: number;         // 材质ID
  typeId: number;             // 器型ID
  costPrice: number;          // 成本价 (高货必填)
  allocatedCost: number;      // 分摊成本 (通货自动计算)
  sellingPrice: number;       // 建议售价
  floorPrice: number;         // 底价
  origin: string;             // 产地
  counter: number;            // 柜台号
  certNo: string;             // 证书号
  notes: string;              // 备注
  supplierId: number;         // 供应商ID
  status: 'in_stock' | 'sold' | 'returned';  // 状态
  purchaseDate: string;       // 采购日期 YYYY-MM-DD
  // 关联数据
  material?: DictMaterial;
  type?: DictType;
  batch?: Batch;
  supplier?: Supplier;
  spec?: ItemSpec;
  images?: ItemImage[];
  tags?: DictTag[];
  saleRecords?: SaleRecord[];
}
```

#### 3.3.2 货品规格模型

```typescript
interface ItemSpec {
  weight: number;        // 重量 (克)
  metalWeight: number;   // 金属重量 (克)
  size: string;          // 尺寸
  braceletSize: string;  // 手镯圈口
  beadCount: number;     // 珠子数量
  beadDiameter: string;  // 珠子直径
  ringSize: string;     // 戒指圈口
}
```

#### 3.3.3 核心功能

| 功能 | 描述 | 入口 |
|-----|------|-----|
| 货品列表 | 支持多条件筛选、分页、搜索 | Tab页 |
| 创建货品 | 高货模式/通货模式 | 按钮弹窗 |
| 编辑货品 | 修改基本信息、价格、规格 | 操作列 |
| 删除货品 | 软删除 (isDeleted=true) | 操作列 |
| 查看详情 | 弹窗展示完整信息 | 操作列 |
| 图片管理 | 上传/删除/设封面 | 详情弹窗 |
| 标签管理 | 添加/移除标签 | 详情弹窗 |
| 出库销售 | 填写成交价、客户信息 | 操作列 |
| 批量出库 | 批次内批量销售 | Tab页 |
| 导出CSV | 批量导出货品数据 | 按钮 |

#### 3.3.4 筛选条件

| 字段 | 类型 | 说明 |
|-----|------|-----|
| materialCategory | 下拉 | 材质大类 (玉/贵金属/水晶/文玩/其他) |
| materialId | 下拉 | 材质具体 (二级联动) |
| status | 下拉 | 状态 (在库/已售/已退) |
| keyword | 文本 | SKU/名称/证书号 模糊搜索 |
| counter | 下拉 | 柜台号 |
| batchId | 下拉 | 批次 |
| minPrice / maxPrice | 数值 | 价格区间 |
| purchaseStartDate / purchaseEndDate | 日期 | 采购日期区间 |

#### 3.3.5 SKU编码规则

```
格式: {材质ID2位}{类型ID2位}-{月日4位}-{序号3位}
示例: 0601-0417-001

规则:
- 材质ID: 不足2位前面补0 (如 6 → 06)
- 类型ID: 不足2位前面补0
- 月日: 实际日期 (如 0417 表示4月17日)
- 序号: 当日自增，重启不重置
```

---

### 3.4 销售管理

#### 3.4.1 销售记录模型

```typescript
interface SaleRecord {
  id: number;
  saleNo: string;        // 销售单号
  itemId: number;       // 货品ID
  actualPrice: number;   // 实际成交价
  channel: 'store' | 'wechat';  // 销售渠道
  saleDate: string;     // 销售日期 YYYY-MM-DD
  customerId?: number;  // 客户ID (可选)
  bundleId?: number;    // 套装ID (可选)
  note?: string;        // 备注
  // 关联
  item?: Item;
  customer?: Customer;
  bundle?: BundleSale;
}
```

#### 3.4.2 出库流程

```
1. 选择货品 (库存状态必须为 in_stock)
2. 填写成交价 (actualPrice)
3. 选择销售渠道 (store/wechat)
4. 选择/创建客户 (可选，支持手机/微信搜索)
5. 选择销售日期 (默认当天)
6. 提交 → 货品状态变更为 sold
7. 记录操作日志
```

#### 3.4.3 退货处理

```
1. 选择退货销售记录
2. 填写退款金额
3. 选择退货原因
4. 选择退货日期
5. 提交 → 货品状态变更为 returned
6. 记录操作日志
```

---

### 3.5 批次管理

#### 3.5.1 批次数据模型

```typescript
interface Batch {
  id: number;
  batchCode: string;         // 批次编码，如 BJ0417001
  materialId: number;        // 材质ID
  typeId?: number;           // 器型ID
  quantity: number;          // 数量
  totalCost: number;         // 总成本
  costAllocMethod: 'equal' | 'by_weight' | 'by_price';  // 分摊方式
  supplierId?: number;       // 供应商ID
  purchaseDate?: string;     // 采购日期
  notes?: string;            // 备注
  // 计算字段
  allocatedCost?: number;    // 分摊成本 (totalCost / quantity)
}
```

#### 3.5.2 批次编码规则

```
格式: B{类别码}{月日4位}{序号3位}
类别码: 玉→J, 贵金属→M, 水晶→C, 文玩→A, 其他→O
示例: BJ0417001 → 玉(J)批次4月17日第001个

规则:
- 类别码: 根据材质category确定
- 月日: 实际日期
- 序号: 当日自增
```

#### 3.5.3 成本分摊方式

| 方式 | 说明 | 计算公式 |
|-----|------|---------|
| equal | 均分 | totalCost / quantity |
| by_weight | 按重量 | item.weight / sum(weight) * totalCost |
| by_price | 按售价 | item.sellingPrice / sum(sellingPrice) * totalCost |

#### 3.5.4 批次入库流程

```
1. 创建批次 (填写数量、总成本、分摊方式)
2. 关联供应商 (可选)
3. 自动生成批次编码
4. 创建货品时选择所属批次
5. 货品成本自动分摊计算
6. 支持手动触发全部分摊
```

---

### 3.6 客户管理

#### 3.6.1 客户数据模型

```typescript
interface Customer {
  id: number;
  customerCode: string;   // 客户编码 (自动生成)
  name: string;           // 姓名
  phone?: string;         // 手机号
  wechat?: string;        // 微信号
  address?: string;       // 地址
  notes?: string;         // 备注
  tags?: string[];        // JSON数组: ["翡翠收藏家","VIP"]
  isActive: boolean;      // 是否有效
  createdAt: Date;        // 创建时间
}
```

#### 3.6.2 客户搜索

支持以下字段模糊搜索：
- 手机号 (phone)
- 姓名 (name)
- 微信号 (wechat)

---

### 3.7 供应商管理

#### 3.7.1 供应商数据模型

```typescript
interface Supplier {
  id: number;
  name: string;           // 供应商名称
  contact?: string;       // 联系人
  phone?: string;        // 电话
  notes?: string;        // 备注
  isActive: boolean;      // 是否有效
}
```

---

### 3.8 标签系统

#### 3.8.1 标签数据模型

```typescript
interface DictTag {
  id: number;
  name: string;           // 标签名称
  groupName?: string;     // 分组名称
  isActive: boolean;      // 是否启用
  isGlobal: boolean;      // 是否全局标签 (true=所有材质可用)
}
```

#### 3.8.2 标签材质关联

```typescript
interface DictTagMaterial {
  tagId: number;          // 标签ID
  materialId: number;     // 材质ID
}
```

#### 3.8.3 标签校验规则

```
出库时校验:
1. 标签是否存在 (id无效 → 报错)
2. 标签是否启用 (isActive=false → 报错)
3. 标签材质匹配 (非全局标签必须与货品材质匹配 → 报错)
```

---

### 3.9 贵金属定价

#### 3.9.1 贵金属价格模型

```typescript
interface MetalPrice {
  id: number;
  materialId: number;     // 材质ID (如黄金=1)
  pricePerGram: number;   // 每克价格
  effectiveDate: string;   // 生效日期 YYYY-MM-DD
  createdAt: Date;
}
```

#### 3.9.2 支持的贵金属

| 材质ID | 材质名称 | 说明 |
|-------|---------|-----|
| 2 | 黄金 (Gold) | Au999 |
| 3 | 白银 (Silver) | Ag999 |
| ... | 其他 | 可扩展 |

---

### 3.10 系统设置

#### 3.10.1 字典管理

| 字典类型 | 功能 |
|---------|-----|
| 材质字典 | CRUD材质，支持分类(玉/贵金属/水晶/文玩/其他) |
| 器型字典 | CRUD器型，支持自定义规格字段 |
| 标签字典 | CRUD标签，支持分组和材质关联 |

#### 3.10.2 系统配置

以 Key-Value 形式存储系统参数：

| Key | 说明 | 默认值 |
|-----|------|-------|
| admin_password | 管理员密码 | admin123 |
| shop_name | 店铺名称 | 翡翠进销存 |
| ... | ... | ... |

---

### 3.11 操作日志

#### 3.11.1 日志数据模型

```typescript
interface OperationLog {
  id: number;
  action: string;         // 操作类型
  targetType: string;     // 目标类型 (item/batch/sale/customer)
  targetId?: number;      // 目标ID
  detail?: string;        // JSON详情
  operator: string;        // 操作人
  createdAt: Date;
}
```

#### 3.11.2 操作类型

| action | 说明 |
|--------|------|
| create_item | 创建货品 |
| edit_item | 编辑货品 |
| delete_item | 删除货品 |
| sell_item | 销售货品 |
| return_sale | 退货 |
| allocate_batch | 批次分摊 |
| create_batch | 创建批次 |
| create_customer | 创建客户 |
| login | 登录 |

---

### 3.12 数据导入/导出

#### 3.12.1 CSV导入

支持批量导入：
- 货品数据 (items)
- 客户数据 (customers)

#### 3.12.2 CSV导出

支持导出：
- 货品列表
- 销售记录
- 操作日志

---

## 四、业务规则

### 4.1 SKU编码规则

| 规则 | 说明 |
|-----|------|
| 格式 | `{材质ID2位}{类型ID2位}-{月日4位}-{序号3位}` |
| 示例 | `0601-0417-001` |
| 材质ID | 不足2位前面补0 |
| 月日 | 实际日期 (MMdd) |
| 序号 | 当日自增序号 |

### 4.2 批次编码规则

| 规则 | 说明 |
|-----|------|
| 格式 | `B{类别码}{月日4位}{序号3位}` |
| 示例 | `BJ0417001` |
| 类别码 | 玉→J, 贵金属→M, 水晶→C, 文玩→A, 其他→O |

### 4.3 成本价规则

| 模式 | 成本价来源 | 说明 |
|-----|-----------|-----|
| 高货模式 | 必填 costPrice | 单件采购成本 |
| 通货模式 | 自动分摊 | batch.totalCost / batch.quantity |

### 4.4 必填字段

| 业务场景 | 必填字段 |
|---------|---------|
| 创建货品 | 器型(typeId) |
| 高货出库 | 成交价(actualPrice)、销售渠道、销售日期 |
| 通货出库 | 成交价(actualPrice)、销售渠道、销售日期 |

### 4.5 状态流转

```
库存状态:
in_stock → sold → returned → in_stock

允许的流转:
- in_stock → sold (出库销售)
- in_stock → returned (直接退货)
- sold → returned (销售后退货)
- returned → in_stock (退货后重新入库)
```

---

## 五、API接口

### 5.1 接口规范

**请求格式**: RESTful API
**认证方式**: Session + Token
**响应格式**:

```typescript
// 成功
{ code: 0, data: T, message: "ok" }

// 失败
{ code: 400/500, data: null, message: "错误描述" }
```

### 5.2 核心接口列表

| 模块 | 接口 | 方法 | 说明 |
|-----|------|-----|------|
| 货品 | /api/items | GET | 获取货品列表 |
| 货品 | /api/items | POST | 创建货品 |
| 货品 | /api/items/[id] | GET | 获取货品详情 |
| 货品 | /api/items/[id] | PUT | 更新货品 |
| 货品 | /api/items/[id] | DELETE | 删除货品 |
| 销售 | /api/sales | POST | 创建销售记录 |
| 销售 | /api/sales/[id]/return | POST | 退货处理 |
| 批次 | /api/batches | GET | 获取批次列表 |
| 批次 | /api/batches | POST | 创建批次 |
| 批次 | /api/batches/[id]/allocate | POST | 成本分摊 |
| 客户 | /api/customers | GET | 获取客户列表 |
| 客户 | /api/customers | POST | 创建客户 |
| 字典 | /api/dicts/materials | GET | 获取材质字典 |
| 字典 | /api/dicts/types | GET | 获取器型字典 |
| 字典 | /api/dicts/tags | GET | 获取标签字典 |
| 看板 | /api/dashboard/summary | GET | 获取汇总数据 |
| 看板 | /api/dashboard/profit | GET | 获取利润数据 |
| 看板 | /api/dashboard/* | GET | 各类图表数据 |
| 贵金属 | /api/metal-prices | GET | 获取贵金属价格 |
| 贵金属 | /api/metal-prices | POST | 更新贵金属价格 |
| 备份 | /api/backup | GET | 下载备份 |
| 备份 | /api/backup | POST | 上传恢复 |
| 导出 | /api/export/items | GET | 导出货品CSV |
| 导入 | /api/import/items | POST | 导入货品CSV |

---

## 六、非功能需求

### 6.1 性能需求

| 指标 | 要求 |
|-----|------|
| 首屏加载 | < 3s |
| API响应时间 | < 500ms |
| 并发用户 | 10+ |
| 数据量支持 | 10万+ 货品记录 |

### 6.2 数据安全

| 需求 | 说明 |
|-----|------|
| 数据隔离 | SQLite单文件数据存储 |
| 备份 | 支持手动备份和恢复 |

> **说明**: 系统为局域网单人操作场景，前端直接进入工作区，无需登录认证。

### 6.3 兼容性需求

| 平台 | 要求 |
|-----|------|
| 浏览器 | Chrome/Firefox/Safari/Edge 现代版本 |
| 手机端 | 支持响应式布局 |
| 扫码枪 | 支持 HID 模式扫码枪 |
| 打印机 | 支持标签打印机 (需配置) |

### 6.4 运行环境

| 环境 | 配置 |
|-----|------|
| Node.js | >= 18.0 |
| 数据库 | SQLite 3 |
| 端口 | 5000 |
| 数据目录 | ./db/custom.db |

---

## 七、部署架构

### 7.1 Docker 部署

```yaml
# docker-compose.yml 关键配置
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=file:/app/data/db/custom.db
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
```

### 7.2 数据目录结构

```
/app/data/
├── db/
│   └── custom.db          # SQLite数据库
└── logs/
    └── runtime.log         # 运行日志
```

---

## 八、成功指标

### 8.1 业务指标

| 指标 | 目标 |
|-----|------|
| 日均销售笔数 | 10+ 笔/天 |
| 库存周转率 | > 30% /月 |
| 客户复购率 | > 20% |
| 退货率 | < 5% |

### 8.2 系统指标

| 指标 | 目标 |
|-----|------|
| 系统可用性 | > 99% |
| API成功率 | > 99.5% |
| 数据备份成功率 | 100% |
| 操作日志覆盖率 | 100% |

---

## 九、版本历史

| 版本 | 日期 | 更新内容 |
|-----|------|---------|
| v1.0 | 2026-04-25 | 初始版本，包含18张表完整功能 |
| v1.1 | 2026-04-25 | 拓展功能：定价调价系统、促销管理、智能入货建议、主数据框架 |

---

## 十、拓展功能需求规格

### 10.1 销售管理模块拓展

#### 10.1.1 定价与调价功能

> **设计原则**: 系统仅有1个实际操作用户，调价不需要审批流程，所有定价操作即时生效。

| 功能点 | 需求描述 | 优先级 |
|--------|---------|--------|
| 批量定价调价 | 系统内批量选择商品，按百分比或固定金额调整售价 | P0 |
| 调价记录系统 | 记录时间、操作人员、原价格、新价格、调价幅度及原因 | P0 |

**调价记录数据模型**:
```typescript
interface PriceChangeLog {
  id: number;
  itemId: number;
  oldPrice: number;
  newPrice: number;
  changeAmount: number;      // 调价幅度
  changePercent: number;     // 调价百分比
  reason: string;            // 调价原因
  operator: string;          // 操作人员
  createdAt: Date;
}
```

#### 10.1.2 促销管理功能

| 功能点 | 需求描述 | 优先级 |
|--------|---------|--------|
| 单次促销 | 设置促销商品范围、时间、方式（折扣/满减/赠品） | P0 |
| 周期促销 | 按日/周/月/季度设置重复促销 | P1 |
| 促销商品筛选辅助 | 展示历史销量、库存水平、库存周转率等指标 | P0 |
| 促销效果预测 | 基于历史数据预估销量增长及利润变化 | P2 |

**促销数据模型**:
```typescript
interface Promotion {
  id: number;
  name: string;
  type: 'discount' | '满减' | '赠品' | '套餐';
  discountValue?: number;     // 折扣值或金额
  condition?: number;          // 满减条件
  startDate: string;
  endDate: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  targetItems?: number[];      // 适用商品ID列表
  targetMaterials?: number[];  // 适用材质
  status: 'draft' | 'active' | 'paused' | 'ended';
  createdAt: Date;
}

interface PromotionEffect {
  id: number;
  promotionId: number;
  predictedSalesGrowth: number;  // 预估销量增长%
  predictedProfitChange: number; // 预估利润变化
  confidence: number;            // 预测置信度
  calculatedAt: Date;
}
```

---

### 10.2 库存管理模块拓展

#### 10.2.1 智能入货建议系统

| 功能点 | 需求描述 | 优先级 |
|--------|---------|--------|
| 库存盘点 | 支持定期盘点与不定期抽查，生成盘点报告 | P0 |
| 多维度筛选 | 价格带/器型/材质/库龄/周转率/销售热度组合筛选 | P0 |
| 智能入货算法 | 综合库存缺口、销售数据、预算、季节性等因素 | P1 |
| 入货建议展示 | 图表展示推荐商品、数量、金额、预期周期 | P1 |

**盘点数据模型**:
```typescript
interface Stocktaking {
  id: number;
  type: 'regular' | 'random';
  startDate: string;
  endDate?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Date;
}

interface StocktakingDetail {
  id: number;
  stocktakingId: number;
  itemId: number;
  systemQty: number;   // 系统数量
  actualQty: number;   // 实际盘点数量
  variance: number;    // 差异
  notes?: string;
}
```

**多维度筛选维度**:
| 筛选维度 | 选项 |
|---------|------|
| 价格带 | 低价位(<1000)/中价位(1000-5000)/高价位(>5000) |
| 库龄 | 0-30天/31-90天/91-180天/180天以上 |
| 库存周转率 | 高周转/中周转/低周转 |
| 销售热度 | 畅销/平销/滞销 |

**智能入货建议算法输入**:
```typescript
interface RestockRecommendation {
  itemId: number;
  currentStock: number;
  safetyStock: number;        // 安全库存
  recentSalesVelocity: number; // 近7/30/90天销量
  salesRank: number;           // 销量排名
  growthRate: number;          // 增长率
  seasonalFactor: number;      // 季节性系数
  recommendedQty: number;      // 建议采购数量
  estimatedCost: number;       // 预估采购金额
  estimatedSalesCycle: number;  // 预期销售周期(天)
  confidence: number;           // 推荐置信度
}
```

---

### 10.3 字典管理与主数据系统拓展

#### 10.3.1 主数据框架建设

| 功能点 | 需求描述 | 优先级 |
|--------|---------|--------|
| 商品主数据管理 | 建立统一的数据标准 | P0 |
| 商品属性字典 | 器型/材质/价格带/商品分类字典 | P0 |
| 标签关联管理 | 为商品关联主数据标签 | P0 |

**新增数据模型**:
```typescript
// 价格带字典
interface PriceRange {
  id: number;
  name: string;           // 如: 低价位/中价位/高价位
  minPrice: number;
  maxPrice: number;
  sortOrder: number;
  isActive: boolean;
}

// 商品分类字典 (多级)
interface ProductCategory {
  id: number;
  name: string;
  parentId?: number;      // 上级分类
  level: number;          // 层级(1/2/3)
  path: string;           // 完整路径: "玉石/翡翠/观音"
  sortOrder: number;
  isActive: boolean;
}

// 客户分类
interface CustomerSegment {
  id: number;
  name: string;           // 如: VIP/普通/潜在
  discountRate?: number;  // 享受折扣率
  description?: string;
  isActive: boolean;
}
```

#### 10.3.2 经验数据沉淀与应用

| 功能点 | 需求描述 | 优先级 |
|--------|---------|--------|
| 销售经验采集 | 记录季节/促销/价格对销量影响系数 | P1 |
| 数据分析模型 | 应用于定价/促销/入货/库存优化 | P1 |
| 数据可视化仪表盘 | 关键指标趋势展示辅助决策 | P1 |

**经验数据模型**:
```typescript
// 季节性销售系数
interface SeasonalFactor {
  id: number;
  materialId: number;
  month: number;          // 1-12
  factor: number;         // 销售系数 (1.0=基准)
  computedAt: Date;
}

// 价格弹性系数
interface PriceElasticity {
  id: number;
  materialId: number;
  elasticityCoeff: number; // 价格弹性系数
  sampleSize: number;     // 样本量
  computedAt: Date;
}

// 客户购买偏好
interface CustomerPreference {
  id: number;
  customerId: number;
  materialId?: number;
  typeId?: number;
  priceRangeId?: number;
  purchaseFrequency: number;
  avgTransactionValue: number;
  lastPurchaseDate?: Date;
}

// 库存销售转化率
interface InventoryConversion {
  id: number;
  materialId: number;
  stockLevel: number;         // 库存水平(低/中/高)
  conversionRate: number;     // 转化率
  computedAt: Date;
}
```

---

### 10.4 拓展功能优先级规划

| 阶段 | 功能 | 目标版本 |
|------|------|---------|
| **Phase 1** | 批量调价记录系统 | v1.2 |
| **Phase 2** | 单次促销管理、促销商品辅助指标 | v1.3 |
| **Phase 3** | 库存盘点、多维度筛选 | v1.4 |
| **Phase 4** | 智能入货建议算法 | v1.5 |
| **Phase 5** | 周期促销 | v1.6 |
| **Phase 6** | 主数据框架、价格带字典 | v1.7 |
| **Phase 7** | 经验数据采集与分析模型 | v1.8 |
| **Phase 8** | 数据可视化仪表盘、促销效果预测 | v1.9 |

---

### 10.5 拓展功能数据库变更

**新增表清单**:

| 表名 | 说明 |
|-----|------|
| price_change_logs | 调价记录表 |
| promotions | 促销活动表 |
| promotion_effects | 促销效果预测表 |
| stocktaking | 盘点记录表 |
| stocktaking_details | 盘点明细表 |
| price_ranges | 价格带字典表 |
| product_categories | 商品分类字典表 |
| customer_segments | 客户分类表 |
| seasonal_factors | 季节性系数表 |
| price_elasticities | 价格弹性系数表 |
| customer_preferences | 客户购买偏好表 |
| inventory_conversions | 库存销售转化率表 |
| restock_recommendations | 入货建议表 |

---

## 十一、附录

### 10.1 术语表

| 术语 | 说明 |
|-----|------|
| SKU | 库存量单位 (Stock Keeping Unit) |
| 高货 | 高端翡翠/珠宝，单件管理 |
| 通货 | 普通翡翠/珠宝，批次管理 |
| 分摊 | 将批次总成本分配到每个货品 |
| 底价 | 货品最低可售价格 |
| 库龄 | 货品在库天数 |

### 10.2 参考文档

- [AGENTS.md](./AGENTS.md) - 开发团队技术规范
- [DEPLOY.md](./DEPLOY.md) - 部署详细文档
- [CHANGELOG.md](./CHANGELOG.md) - 版本变更日志
