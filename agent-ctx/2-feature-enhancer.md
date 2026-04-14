# Task ID: 2 — Agent: feature-enhancer
## Task: 标签分类优化 + 手机端摄像头扫码出库

### 完成状态: ✅ 全部完成

### 完成内容

#### 任务1: 标签分类优化
1. **入库/编辑弹窗标签按分组展示**
   - `item-create-dialog.tsx` — 高货入库和通货入库两个模式的标签区域改为按 groupName 分组
   - `item-edit-dialog.tsx` — 同样按 groupName 分组展示
   - 只有"未分组"一组时不显示分组标题

2. **设置页标签管理增强**
   - 分组筛选下拉（多个分组时显示）
   - 标签点击编辑（名称+分组）
   - 标签悬停停用/启用按钮
   - 新增/编辑标签对话框中分组字段支持下拉选择

#### 任务2: 手机端摄像头扫码出库
1. 安装 `html5-qrcode@2.3.8`
2. 创建 `barcode-scanner.tsx` 组件（摄像头扫码+手动输入双模式）
3. 集成到 `inventory-tab.tsx`（移动端大按钮+桌面端图标按钮）

### 验证
- ESLint: 0 errors, 0 warnings
- Dev server: 正常运行

### 关键文件变更
- `src/components/inventory/item-create-dialog.tsx`
- `src/components/inventory/item-edit-dialog.tsx`
- `src/components/inventory/settings-tab.tsx`
- `src/components/inventory/barcode-scanner.tsx` (新建)
- `src/components/inventory/inventory-tab.tsx`
