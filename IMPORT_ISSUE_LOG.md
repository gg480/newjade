# 导入功能问题记录

## 问题标题
导入数据时报错：`Unique constraint failed on the fields: (sku_code)`

## 现象
- 报错位置（编译后文件）：`.next/dev/server/chunks/[root-of-the-server]__0ubmw34._.js` 第 511 行附近
- 报错上下文：`await db.item.create(...)`
- 错误信息：`Invalid db.item.create() invocation ... Unique constraint failed on the fields: (sku_code)`

## 业务影响
- 导入过程中部分记录插入失败
- 同一批导入可能出现“部分成功、部分失败”的结果

## 初步定位
- `Item.skuCode` 在 Prisma 中定义为唯一字段（`@unique`）
- 导入接口中会在循环里先生成 SKU 再创建记录：
  - `src/app/api/import/items-csv/route.ts`
  - `src/app/api/import/items/route.ts`

## 可能根因
1. 并发请求竞争：多个请求同时生成到相同的下一个 SKU，导致后写入失败。
2. 字符串排序边界：按字符串倒序取最大 SKU，在序号位数变化（如 999 -> 1000）时可能判断错误，重复生成已存在 SKU。

## 建议修复方向
1. 生成 SKU + 创建记录放入事务，并对唯一冲突做有限重试。
2. SKU 序号改为稳定数值比较（避免纯字符串排序导致边界错误）。
3. 增加导入幂等策略（例如基于业务键去重）并补充失败明细反馈。

## 记录时间
2026-04-20

