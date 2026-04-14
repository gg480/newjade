# Task ID: 1 - Agent: schema-upgrade
## Task: Schema升级 + 材质级联下拉 + 器型必填参数 + 柜台号必填 + 字段中文化

### 完成状态: ✅ 全部完成

### 变更摘要

1. **Prisma Schema 升级** - DictMaterial 新增 category 字段，DictType specFields 升级为对象格式
2. **材质 API 更新** - POST 支持 category 参数
3. **settings-tab.tsx 重构** - 材质大类选择、器型勾选式UI、中文标签、导出辅助函数
4. **item-create-dialog.tsx** - 材质级联下拉、必填校验、柜台号必填、中文化
5. **item-edit-dialog.tsx** - 必填校验、柜台号必填、中文化
6. **inventory-tab.tsx** - 材质大类+材质级联筛选
7. **种子数据更新** - 36种材质添加大类、9种器型新specFields格式

### 验证
- ESLint: 0 errors, 0 warnings
- Dev server: 正常运行
- 数据库: 同步成功
