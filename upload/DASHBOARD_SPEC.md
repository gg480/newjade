# 看板需求规格（Dashboard Spec）

> 本文档定义全部看板图表需求，阶段3实现。
> 阶段1只需实现数据 API，不做前端图表。
> 放在项目根目录，开发时参照，避免迭代中功能膨胀。

---

## 1. 看板首页（概览卡片）

4张数据卡片，无图表，实时计算：

| 卡片 | 数据源 | 计算 |
|------|--------|------|
| 库存总计 | items WHERE status=in_stock AND is_deleted=false | COUNT(*) |
| 库存货值 | 同上 | SUM(allocated_cost) |
| 年度销量 | sale_records WHERE sale_date 在本年 | COUNT(*) |
| 年度利润 | sale_records JOIN items WHERE sale_date 在本年 | SUM(actual_price - allocated_cost) |

---

## 2. 产品分布分析

### 2.1 按器型分布（4张图表，共用一个筛选器）

筛选器：时间范围（年/季/月/自定义）

| 图表 | 类型 | X轴 | Y轴 | 数据源 |
|------|------|-----|-----|--------|
| 器型-售价分布 | 柱状图 | 器型名称 | SUM(selling_price) | items GROUP BY type_id |
| 器型-成交利润 | 柱状图 | 器型名称 | SUM(actual_price - allocated_cost) | sale_records JOIN items GROUP BY type_id |
| 器型-成交数量 | 柱状图 | 器型名称 | COUNT(*) | sale_records JOIN items GROUP BY type_id |
| 器型-毛利分布 | 柱状图 | 器型名称 | AVG((actual_price - allocated_cost) / actual_price) | sale_records JOIN items GROUP BY type_id |

### 2.2 按材质分布（4张图表，同上结构）

| 图表 | 类型 | X轴 | Y轴 |
|------|------|-----|-----|
| 材质-售价分布 | 柱状图 | 材质名称 | SUM(selling_price) |
| 材质-成交利润 | 柱状图 | 材质名称 | SUM(actual_price - allocated_cost) |
| 材质-成交数量 | 柱状图 | 材质名称 | COUNT(*) |
| 材质-毛利分布 | 柱状图 | 材质名称 | AVG(毛利率) |

---

## 3. 柜台利润分析

| 图表 | 类型 | 说明 |
|------|------|------|
| 柜台利润对比 | 柱状图 | X轴=柜台号，Y轴=SUM(actual_price - allocated_cost) |

筛选器：年/季/月/自定义时间范围

数据源：`sale_records JOIN items GROUP BY items.counter`

---

## 4. 月度销量趋势

| 图表 | 类型 | 说明 |
|------|------|------|
| 月份销量 | 折线图 | X轴=月份（近12个月），Y轴=COUNT(sale_records) |

可叠加：月度销售额折线（Y2轴=SUM(actual_price)）

筛选器：可选 material_id 看单品类趋势

---

## 5. 价格带分析（2张饼图）

### 5.1 成本价格带

按 `allocated_cost` 分段统计**在库货品**件数：

| 价格带 | 条件 |
|--------|------|
| 0-600 | allocated_cost < 600 |
| 600-2000 | 600 ≤ allocated_cost < 2000 |
| 2000-5000 | 2000 ≤ allocated_cost < 5000 |
| 5000-15000 | 5000 ≤ allocated_cost < 15000 |
| 15000-30000 | 15000 ≤ allocated_cost < 30000 |
| 30000-80000 | 30000 ≤ allocated_cost < 80000 |
| 80000+ | allocated_cost ≥ 80000 |

图表类型：饼图（或环形图），显示件数和占比百分比。

### 5.2 售价价格带

按 `selling_price` 分段统计**在库货品**件数，分段规则同上。

图表类型：饼图（或环形图）。

---

## 6. 克重产品分布

| 图表 | 类型 | 说明 |
|------|------|------|
| 有克重产品分布 | 散点图或柱状图 | 仅统计 item_spec.weight IS NOT NULL 的货品 |

两种展示方式（前端选其一）：

**方案A 散点图**：X轴=weight，Y轴=selling_price，点颜色=材质。快速看出哪些克重区间的货品值钱。

**方案B 柱状图**：按克重分段（0-5g / 5-20g / 20-50g / 50-100g / 100g+），Y轴=件数，按材质堆叠。看哪类材质集中在哪个克重段。

---

## 7. 批次回本看板（已在 PRD 中定义，此处补充展示规格）

| 图表 | 类型 | 说明 |
|------|------|------|
| 回本进度总览 | 卡片列表 | 每批次一张卡片：编号/材质/进度条/状态标签 |
| 回本进度分布 | 饼图 | new / selling / paid_back / cleared 各状态的批次数量占比 |

---

## 8. 压货预警（已在 PRD 中定义，补充图表）

| 图表 | 类型 | 说明 |
|------|------|------|
| 压货资金占比 | 饼图 | 按材质 GROUP BY，SUM(allocated_cost) WHERE age_days >= 阈值 |
| 库龄分布 | 柱状图 | X轴=库龄段（0-30/30-60/60-90/90-180/180+天），Y轴=件数 |

---

## 9. API 端点规划

阶段1实现数据接口，阶段3前端消费。

```
# 概览（已有）
GET /api/v1/dashboard/summary

# 批次回本（已有）
GET /api/v1/dashboard/batch-profit

# 产品分布 ★新增
GET /api/v1/dashboard/distribution/by-type(?start_date&end_date)
GET /api/v1/dashboard/distribution/by-material(?start_date&end_date)

# 柜台利润 ★新增
GET /api/v1/dashboard/profit/by-counter(?start_date&end_date)

# 月度趋势（已有，确认含 material_id 筛选）
GET /api/v1/dashboard/trend(?months=12&material_id=)

# 价格带分析 ★新增
GET /api/v1/dashboard/price-range/cost
GET /api/v1/dashboard/price-range/selling

# 克重分布 ★新增
GET /api/v1/dashboard/weight-distribution

# 压货（已有，补充按材质聚合）
GET /api/v1/dashboard/stock-aging(?min_days=90)
GET /api/v1/dashboard/stock-aging/by-material(?min_days=90)

# 库龄分布 ★新增
GET /api/v1/dashboard/age-distribution

# 利润统计（已有）
GET /api/v1/dashboard/profit/by-category
GET /api/v1/dashboard/profit/by-channel
```

---

## 10. 实现节奏

| 阶段 | 范围 | 说明 |
|------|------|------|
| 阶段1（当前） | summary / batch-profit / profit/by-category / profit/by-channel / trend / stock-aging | 已在指令集中 |
| 阶段3 补充 | distribution / by-counter / price-range / weight / age / stock-aging/by-material | 新增7个端点 |
| 阶段3 前端 | 所有图表的前端渲染 | 用 ECharts 或 Chart.js |

**原则**：阶段1只管数据 API 能跑通，图表渲染全部留到阶段3。不提前做前端图表。
