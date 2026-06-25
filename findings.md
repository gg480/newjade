# 发现与决策

## 需求
- 对贵金属市价功能进行完整功能验证和端到端测试
- 对内容推广功能进行完整功能验证和端到端测试
- 确保现有功能无回归，补充必要的测试覆盖

## 研究发现

### 贵金属市价 — 功能范围
| 模块 | API 端点（11 个） | UI 组件（5 个） | 数据模型 |
|------|------------------|----------------|---------|
| 当前价格列表 | GET /api/metal-prices | SettingsMetalPanel 行情面板 | MetalPrice, DictMaterial |
| 行情历史 | GET /api/metal-prices/history | 历史趋势图（Recharts LineChart） | MetalPrice |
| 行情刷新 | POST /api/metal-prices/refresh | — | 外部 API 缓存 |
| 市场行情 | GET /api/metal-prices/market | — | 外部数据 (gzjn168/Tanshu) |
| 同行比价 | GET /api/metal-prices/competitors | CompetitorCompareDialog | 外部数据 (Tanshu StoreGold2) |
| 本地参考 | GET /api/metal-prices/local-reference | LocalReferencePanel | 外部数据 (gzjn168) |
| 工费设置 | PUT /api/metal-prices/labor-cost | SettingsMetalPanel 工费输入 | DictMaterial.laborCostPerGram |
| 重新计价预览 | POST /api/metal-prices/reprice | Reprice 预览弹窗 | Item.sellingPrice 计算 |
| 重新计价确认 | POST /api/metal-prices/reprice/confirm | Reprice 确认弹窗 | MetalPrice + Item 批量更新 |
| 删除行情 | DELETE /api/metal-prices | 历史列表删除按钮 | MetalPrice |
| 新增行情 | POST /api/metal-prices | — | MetalPrice |
| 调试页面 | GET /api/metal-prices/debug-gzjn | — | 仅开发环境 |

**已有 E2E 测试：** `tests/e2e/critical/settings/metal-price.spec.ts`（11 步，登录→设置→验证行情显示→工费编辑→趋势图→历史→比价→日分享→同步→本地参考）
**盲区：** 重新计价流程、行情刷新、多材料场景、权限校验、错误状态

### 内容推广 — 功能范围
| 阶段 | API 端点 | UI 组件 | 数据模型 |
|------|---------|---------|---------|
| AI 配置 | GET/PUT /api/promotion/config | AIConfigTab | SysConfig (content group) |
| 选品评分 | GET /api/promotion/selection | SelectionTab | ProductScore 引擎 |
| 节庆日历 | GET /api/promotion/festivals | SelectionTab 节日面板 | FestivalCalendar 服务 |
| 选题管理 | GET/POST /api/promotion/topics | TopicsTab | ContentTopic |
| 选题评分 | PATCH /api/promotion/topics/:id/rating | TopicsTab 评分弹窗 | ContentTopic |
| 选题审核 | PATCH /api/promotion/topics/:id/review | TopicsTab 审核操作 | ContentTopic |
| 文案管理 | GET/POST /api/promotion/contents | ContentsTab | ContentDraft |
| 文案审核 | PATCH /api/promotion/contents/:id/review | ContentsTab 审核操作 | ContentDraft |
| 违禁词检测 | POST /api/promotion/contents/:id/check | ContentsTab 检测按钮 | 内置词库 |
| 推广记录 | GET/POST /api/promotion/promotions | PromotionsTab | ContentPromotion |
| 推广状态变更 | PATCH /api/promotion/promotions/:id/status | PromotionsTab 操作按钮 | ContentPromotion |
| 反馈数据 | GET/POST /api/promotion/metrics/:id | MetricsTab | ContentMetric |
| 反馈汇总 | GET /api/promotion/metrics/:id/summary | MetricsTab 趋势图 | ContentMetric |
| 商品推广历史 | GET /api/promotion/items/:id/history | ItemPromotionHistory | ContentPromotion + Metric |
| OpenClaw 回写 | 4 个 /api/content/* 端点 | — | ContentTopic/Draft/AiMetadata |

**已有 E2E 测试：**
- `tests/e2e/critical/promotion/content-promotion.spec.ts`（126 行，选品→选题→文案→反馈）
- `tests/e2e/full/selection-content-promotion.spec.ts`（255 行，选品 API + UI 全量）
- `tests/e2e/smoke/smoke-content-promotion.spec.ts`（294 行，6 步完整 Happy Path）
- `tests/api/promotion-content-api.ts`（267 行，API 集成测试脚本）

**盲区：** 异常场景（非法状态流转、重复创建、空数据）、OpenClaw 外部 API 验证、权限校验

### 外部依赖
- **Tanshu API**（`api2.tanshuapi.com`）：需在 SysConfig 配置 `tanshu_api_key`，测试环境可能无法访问
- **gzjn168.com**：公开可访问的 CSV API，无需密钥
- **OpenClaw**：需在 SysConfig 配置 `openclaw_api_key` 和 `baidu_api_key`，测试环境可能无法访问

## 技术决策
| 决策 | 理由 |
|------|------|
| 后端 API 优先验证，再走 UI 交互 | 后端是基础，后端通 UI 才能通 |
| 异常场景手动触发优于 Mock | Mock 增加了维护成本，手动触发更接近真实 |
| 验证顺序：业务流程 → 异常处理 → 边界条件 | 保证核心流程畅通后再覆盖边缘 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| Tanshu/OpenClaw 外部 API 测试环境可能不可用 | 标记为"需外部依赖"降级验证，不影响内部功能测试 |

## 资源
- E2E 测试框架：Playwright（已配置，见 playwright.config.ts）
- 测试种子数据：`prisma/seed.ts`
- 项目现有 E2E 测试目录：`tests/e2e/`

## 视觉/浏览器发现
<!-- 关键：每执行2次查看/浏览器操作后必须更新此部分 -->
<!-- 多模态内容必须立即以文本形式记录 -->
-

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*
