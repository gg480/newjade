// api.types.ts — 类型安全的 API 客户端类型定义
// 从 route handler 和 Prisma schema 推导
// 所有者：@Frontend

// ========== 通用类型 ==========

export interface ApiResponse<T> {
  code: number;
  data: T | null;
  message: string;
}

export interface PaginationInfo {
  page: number;
  size: number;
  total: number;
  pages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationInfo;
}

// ========== 字典（Dicts） ==========

export interface DictMaterial {
  id: number;
  name: string;
  category: string | null;
  subType: string | null;
  origin: string | null;
  costPerGram: number | null;
  laborCostPerGram: number | null;
  sortOrder: number;
  isActive: boolean;
  marketRatio: number | null;
}

export interface DictType {
  id: number;
  name: string;
  specFields: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface DictTag {
  id: number;
  name: string;
  groupName: string | null;
  isActive: boolean;
  isGlobal: boolean;
}

// ========== 价格带/客户分组/商品分类 ==========

export interface PriceRange {
  id: number;
  name: string;
  minValue: number | null;
  maxValue: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CustomerSegment {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductCategory {
  id: number;
  name: string;
  parentId: number | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  children?: ProductCategory[];
}

// ========== 系统配置 ==========

export interface SysConfig {
  id: number;
  key: string;
  value: string;
  description: string | null;
  valueType: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  groupName: string | null;
}

// ========== 供应商 ==========

export interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface SupplierStats {
  total: {
    totalAmount: number;
    totalCount: number;
    avgPrice: number;
  };
  items: Array<{
    supplierId: number;
    supplierName: string;
    totalAmount: number;
    batchCount: number;
    avgPrice: number;
    lastPurchaseDate: string | null;
  }>;
}

export interface SupplierPurchase {
  id: number;
  batchCode: string;
  materialName: string;
  typeName: string;
  quantity: number;
  totalCost: number;
  purchaseDate: string | null;
  createdAt: string;
}

// ========== 客户 ==========

export interface Customer {
  id: number;
  customerCode: string;
  name: string;
  phone: string | null;
  wechat: string | null;
  address: string | null;
  notes: string | null;
  tags: string | null; // JSON string
  isActive: boolean;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  saleRecords: SaleRecordSummary[];
  bundleSales: BundleSaleSummary[];
}

export interface SaleRecordSummary {
  id: number;
  saleNo: string;
  itemId: number;
  actualPrice: number;
  channel: string;
  saleDate: string;
  customerId: number | null;
  bundleId: number | null;
  note: string | null;
  createdAt: string;
  item?: {
    name: string | null;
    skuCode: string;
    material?: { name: string | null };
    type?: { name: string | null };
  } | null;
  customer?: { name: string } | null;
}

export interface BundleSaleSummary {
  id: number;
  bundleNo: string;
  totalPrice: number;
  allocMethod: string;
  saleDate: string;
  channel: string;
  customerId: number | null;
  note: string | null;
  createdAt: string;
}

// ========== 批次 ==========

export interface Batch {
  id: number;
  batchCode: string;
  materialId: number;
  typeId: number | null;
  quantity: number;
  totalCost: number;
  costAllocMethod: string;
  supplierId: number | null;
  purchaseDate: string | null;
  notes: string | null;
  createdAt: string;
  itemsCount?: number;
  // API 返回的计算/虚拟字段
  materialName?: string | null;
  soldCount?: number;
  revenue?: number;
  paybackRate?: number;
  status?: string;
  material?: DictMaterial;
  type?: DictType;
  supplier?: Supplier;
  items?: ItemSummary[];
}

// ========== 货品（Items） ==========

export interface ItemSpec {
  id: number;
  itemId: number;
  weight: number | null;
  metalWeight: number | null;
  size: string | null;
  braceletSize: string | null;
  beadCount: number | null;
  beadDiameter: string | null;
  ringSize: string | null;
}

export interface ItemImage {
  id: number;
  itemId: number;
  filename: string;
  thumbnailPath: string | null;
  url?: string;
  isCover: boolean;
  createdAt: string;
}

export interface ItemSummary {
  id: number;
  skuCode: string;
  name: string | null;
  batchCode: string | null;
  batchId: number | null;
  materialId: number;
  typeId: number | null;
  costPrice: number | null;
  allocatedCost: number | null;
  sellingPrice: number;
  floorPrice: number | null;
  origin: string | null;
  counter: number | null;
  certNo: string | null;
  notes: string | null;
  supplierId: number | null;
  status: string;
  purchaseDate: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  // API 返回的计算/虚拟字段
  materialName?: string | null;
  typeName?: string | null;
  specFields?: Record<string, unknown>;
  ageDays?: number;
  estimatedCost?: number | null;
  coverImage?: string | null;
  // Relations
  material?: DictMaterial;
  type?: DictType;
  batch?: Batch;
  supplier?: Supplier;
  spec?: ItemSpec | null;
  images?: ItemImage[];
  tags?: DictTag[];
  // ADR-020: 货品类型与材质组件
  compositeType?: string; // single / inlay / composite
  materialComponents?: ItemMaterialComponent[];
  // ADR-020: 材质显示名（三类材质用 + 连接，如"翡翠+18K金+钻石"），用于详情页/标签
  materialDisplayName?: string | null;
  // ADR-020: 镶嵌型动态售价明细（用于标签拆分显示）
  inlayPriceBreakdown?: {
    settingMaterialPrice: number;
    settingMaterialWeight: number | null;
    settingMaterialName: string | null;
  } | null;
}

/** 货品材质组件（ADR-020 镶嵌型/组合型） */
export interface ItemMaterialComponent {
  id: number;
  itemId: number;
  materialId: number;
  role: string; // main_stone / setting_material / companion_stone / component
  weight: number | null;
  costPrice: number | null;
  sellingPrice: number | null;
  sortOrder: number;
  notes: string | null;
  material?: DictMaterial;
}

/** 镶嵌型售价拆分（用于标签显示） */
export interface InlayPriceBreakdown {
  settingMaterialPrice: number;
  settingMaterialWeight: number | null;
  settingMaterialName: string | null;
}

/** 货品材质组件输入（表单提交用） */
export interface MaterialComponentInput {
  materialId: number;
  role: string;
  weight?: number | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  sortOrder?: number;
  notes?: string | null;
}

export interface SkuLookupResult {
  id: number;
  skuCode: string;
  name: string | null;
  materialName: string | null;
  typeName: string | null;
  costPrice: number | null;
  allocatedCost: number | null;
  sellingPrice: number;
  floorPrice: number | null;
  status: string;
  counter: number | null;
  weight: number | null;
}

// ========== 销售记录 ==========

export interface SaleRecord {
  id: number;
  saleNo: string;
  itemId: number;
  actualPrice: number;
  channel: string;
  saleDate: string;
  customerId: number | null;
  bundleId: number | null;
  note: string | null;
  createdAt: string;
  item?: ItemSummary;
  customer?: Customer | null;
}

// ========== 仪表盘（Dashboard） ==========

export interface DashboardSummary {
  totalItems: number;
  totalStockValue: number;
  monthRevenue: number;
  monthProfit: number;
  monthSoldCount: number;
  statusCounts?: Record<string, number>;
  todayRevenue?: number;
  todayProfit?: number;
}

export interface BatchProfitItem {
  batchCode: string;
  materialName: string | null;
  totalCost: number;
  quantity: number;
  soldCount: number;
  revenue: number;
  profit: number;
  paybackRate: number;
  status: string;
  itemsCount?: number;
}

export interface StockAgingItem {
  itemId: number;
  skuCode: string;
  name: string | null;
  batchCode: string | null;
  materialName: string | null;
  typeName: string | null;
  costPrice: number | null;
  allocatedCost: number | null;
  sellingPrice: number;
  purchaseDate: string | null;
  ageDays: number;
  counter: number | null;
}

export interface StockAging {
  items: StockAgingItem[];
  totalItems: number;
  totalValue: number;
}

export interface TopSellerItem {
  itemId: number;
  name: string;
  skuCode: string;
  materialName: string;
  typeName: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  salesCount: number;
  margin: number;
}

export interface MonthlyComparisonValue {
  revenue: number;
  soldCount: number;
  profit: number;
  newItems: number;
}

export interface MonthlyComparisonChanges {
  revenue: number;
  soldCount: number;
  profit: number;
  newItems: number;
}

export interface MonthlyComparison {
  thisMonth: MonthlyComparisonValue;
  lastMonth: MonthlyComparisonValue;
  changes: MonthlyComparisonChanges;
}

export interface TrendDataPoint {
  yearMonth: string;
  revenue: number;
  profit: number;
  salesCount: number;
}

export interface SalesByChannelItem {
  channel: string;
  label: string;
  count: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface ProfitByCategoryItem {
  materialName: string;
  revenue: number;
  cost: number;
  salesCount: number;
  profit: number;
  profitMargin: number;
}

export interface ProfitByChannelItem {
  channel: string;
  channelLabel: string;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
  salesCount: number;
}

export interface ProfitByCounterItem {
  counter: number;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
  salesCount: number;
}

export interface PriceRangeItem {
  rangeName: string;
  count: number;
  totalValue: number;
}

export interface WeightDistributionScatter {
  weight: number;
  sellingPrice: number;
  materialName: string;
}

export interface WeightDistributionStacked {
  range: string;
  label: string;
  materials: Record<string, number>;
}

export interface WeightDistribution {
  scatter: WeightDistributionScatter[];
  stacked: WeightDistributionStacked[];
  materials: string[];
}

export interface AgeDistributionItem {
  range: string;
  minDays: number;
  maxDays: number;
  count: number;
  percentage: number;
}

export interface DistributionByType {
  priceDistribution: Array<{ typeName: string; totalSellingPrice: number }>;
  profitByType: Array<{ typeName: string; profit: number }>;
  countByType: Array<{ typeName: string; count: number }>;
  marginByType: Array<{ typeName: string; margin: number }>;
  profitDistribution?: Array<{ typeName: string; profit: number }>;
  countDistribution?: Array<{ typeName: string; count: number }>;
  marginDistribution?: Array<{ typeName: string; margin: number }>;
}

export interface DistributionByMaterial {
  priceDistribution: Array<{ materialName: string; totalSellingPrice: number }>;
  profitByMaterial: Array<{ materialName: string; profit: number }>;
  countByMaterial: Array<{ materialName: string; count: number }>;
  marginByMaterial: Array<{ materialName: string; margin: number }>;
  profitDistribution?: Array<{ materialName: string; profit: number }>;
  countDistribution?: Array<{ materialName: string; count: number }>;
  marginDistribution?: Array<{ materialName: string; margin: number }>;
}

export interface TurnoverDataPoint {
  month: string;
  sellCount: number;
  revenue: number;
  avgSellingDays: number;
  turnoverRate?: number;
}

export interface HeatmapData {
  days: string[];
  channels: string[];
  data: number[][];
  maxRevenue?: number;
}

export interface CustomerFrequency {
  distribution: Array<{ label: string; count: number }>;
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
}

export interface TopCustomerItem {
  id: number;
  name: string;
  customerCode: string;
  totalSpending: number;
  orderCount: number;
  lastPurchaseDate: string | null;
  vipLevel: string;
}

export interface InventoryValueByCategoryItem {
  category: string;
  totalValue: number;
  count: number;
}

export interface DashboardAggregate {
  summary: DashboardAggregateSummary;
  batchProfit: BatchProfitItem[];
  stockAging: StockAging;
  topSellers: TopSellerItem[];
  momData: MonthlyComparison;
}

export interface DashboardAggregateSummary extends DashboardSummary {
  statusCounts: {
    inStock: number;
    sold: number;
    returned: number;
  };
}

export interface RecentSaleItem {
  id: number;
  item: {
    name: string;
    skuCode: string;
    materialName: string | null;
  } | null;
  customerName: string;
  actualPrice: number;
  channel: string;
  saleDate: string;
}

// ========== 贵金属价格 ==========

/** 行情价条目（GET /api/metal-prices/market，含材质折算参考价 + 最终克价） */
export interface MarketPriceItem {
  code: string;              // 行情码: Au9999, Ag(T+D), Pt9995
  price: number;             // 元/克
  unit: string;
  updatedAt: string;
  materialId: number | null;
  materialName: string | null;
  marketRatio: number | null;
  refPrice: number | null;   // 参考价 = 行情价 * marketRatio
  laborCostPerGram: number | null; // 工费单价（元/克）
  finalPrice: number | null;       // 最终克价 = refPrice + 工费单价
}

/** 行情价含材质折算参考价（GET /api/metal-prices/market） */
export type MarketPriceWithRef = MarketPriceItem;

/** 竞品金价（GET /api/metal-prices/competitors） */
export interface CompetitorPrice {
  name: string;             // 品牌名，如 周大福
  gold: number;             // 黄金金价（元/克）
  platinum: string | null;  // 铂金价格
  goldbar: string | null;   // 金条价格
  unit: string;             // 单位
  date: string;             // 发布日期
}

/** 更新工费请求体（PUT /api/metal-prices/labor-cost） */
export interface UpdateLaborCostBody {
  materialId: number;
  laborCostPerGram: number;
}

/** 本地参考行情（gzjn168.com 融通金） */
export interface LocalReferencePriceItem {
  name: string;       // 商品名
  buyPrice: number;   // 回购价
  sellPrice: number;  // 销售价
  updatedAt: string;  // 更新时间
}

export interface LocalReferenceResponse {
  available: boolean;
  items: LocalReferencePriceItem[];
  message?: string;
  fetchedAt: string;
}

export interface MetalPrice {
  id: number;
  materialId: number;
  pricePerGram: number;
  effectiveDate: string;
  createdAt: string;
  updatedBy?: string;
  material?: DictMaterial;
}

export interface RepricePreviewItem {
  itemId: number;
  skuCode: string;
  name: string | null;
  oldPrice: number;
  newPrice: number;
}

export interface RepricePreview {
  affectedItems: RepricePreviewItem[];
}

// ========== 定价 ==========

export interface PricingResult {
  totalCost: number;
  recommendedPrice: number;
  breakdown: Record<string, number>;
}

// ========== 操作日志 ==========

export interface OperationLog {
  id: number;
  action: string;
  targetType: string;
  targetId: number | null;
  detail: string | null;
  operator: string;
  createdAt: string;
}

// ========== 通知 ==========

export interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

// ========== 导入 ==========

export interface ImportResult {
  success: number;
  successCount?: number;
  failed: number;
  failCount?: number;
  skipped?: number;
  duplicated?: number;
  errors: string[];
  items?: ItemSummary[];
  autoCreated?: { materials: string[]; types: string[] };
  inferred?: { row: number; field: string; value: string }[];
}

// ========== 导出URL ==========

export interface ExportUrl {
  url: string;
}

// ========== 批量调价 ==========

export interface BatchPriceAdjustResult {
  success: number;
  total: number;
  errors: string[];
}

// ========== 批量补全 ==========

export interface BatchCompleteBody {
  ids: number[];
  materialId?: number;
  typeId?: number;
  name?: string;
  tagIds?: number[];
  counter?: number;
  floorPrice?: number;
  origin?: string;
  weight?: number;
}

export interface BatchCompleteResult {
  success: number;
  failed: number;
}

// ========== 认证 ==========

export interface AuthToken {
  token: string;
  expiresIn: number;
}

export interface AuthSession {
  authenticated: boolean;
  user: string;
}

// ========== 用户与角色 ==========

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  roleName: string;
  permissions: string[];
  mustChangePwd: boolean;
}

export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  roleId: number;
  roleName: string;
  isActive: boolean;
  mustChangePwd: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleInfo {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

// ========== 备份 ==========

export interface BackupResult {
  filename: string;
  size: number;
  message: string;
  preRestoreBackupFilename?: string;
}

// ========== 图像上传结果 ==========

export interface ImageUploadResult {
  id: number;
  itemId: number;
  filename: string;
  isCover: boolean;
}

/** 独立照片上传（POST /api/images/upload）响应 */
export interface ImageUploadResponse {
  id: number;
  url: string;
  thumbnailUrl: string | null;
}

// ========== 查询参数类型 ==========

export interface PaginationQueryParams {
  page?: number;
  size?: number;
}

export interface ItemsQueryParams extends PaginationQueryParams {
  material_id?: string;
  type_id?: string;
  tag_id?: string;
  status?: string;
  batch_id?: string;
  counter?: string;
  keyword?: string;
  search_field?: string;
  has_tags?: string;  // 'true'=有标签 'false'=无标签
  sort_by?: string;
  sort_order?: string;
}

/** 批量补全结果 */
export interface BatchCompleteResult {
  success: number;
  failed: number;
}

export interface SalesQueryParams extends PaginationQueryParams {
  channel?: string;
  start_date?: string;
  end_date?: string;
  customer_id?: string;
  unlinked_only?: string;
  keyword?: string;
  item_keyword?: string;
  itemId?: number;
  min_amount?: string;
  max_amount?: string;
  include_returned?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface BatchesQueryParams extends PaginationQueryParams {
  material_id?: string;
}

export interface CustomersQueryParams extends PaginationQueryParams {
  keyword?: string;
  tag?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface SuppliersQueryParams {
  keyword?: string;
}

export interface LogsQueryParams extends PaginationQueryParams {
  action?: string;
  target_type?: string;
  start_date?: string;
  end_date?: string;
}

export interface NotificationsQueryParams extends PaginationQueryParams {
  type?: string;
}

export interface DashboardQueryParams {
  start_date?: string;
  end_date?: string;
  months?: number;
  aging_days?: number;
  limit?: number;
  min_days?: number;
}

export interface MetalPriceHistoryParams extends PaginationQueryParams {
  material_id?: string;
  material_ids?: string;
  start_date?: string;
  end_date?: string;
  pageSize?: number;
}

export interface PaginatedMetalPrice {
  items: MetalPrice[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierStatsParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

// ========== 创建/更新请求体 ==========

export interface CreateDictMaterialBody {
  name: string;
  category?: string;
  subType?: string;
  origin?: string;
  costPerGram?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateDictTypeBody {
  name: string;
  specFields?: string;
  sortOrder?: number;
}

export interface CreateDictTagBody {
  name: string;
  groupName?: string;
  isActive?: boolean;
}

export interface CreateCustomerBody {
  name: string;
  phone?: string;
  wechat?: string;
  address?: string;
  notes?: string;
  tags?: string;
}

export type UpdateCustomerBody = Partial<CreateCustomerBody>;

export interface CreateSupplierBody {
  name: string;
  contact?: string;
  phone?: string;
  notes?: string;
}

export type UpdateSupplierBody = Partial<CreateSupplierBody>;

export interface CreateBatchBody {
  batchCode?: string;
  materialId: number;
  typeId?: number;
  quantity: number;
  totalCost: number;
  costAllocMethod: string;
  supplierId?: number;
  purchaseDate?: string;
  notes?: string;
}

export type UpdateBatchBody = Partial<CreateBatchBody>;

export interface CreateItemBody {
  skuCode?: string;
  name?: string;
  materialId?: number;
  typeId?: number;
  costPrice?: number;
  sellingPrice: number;
  floorPrice?: number;
  origin?: string;
  counter?: number;
  certNo?: string;
  batchId?: number;
  purchaseDate?: string;
  supplierId?: number;
  notes?: string;
  spec?: Partial<ItemSpec>;
  tags?: number[];
  tagIds?: number[];
  status?: string;
  // ADR-020: 货品类型与材质组件
  compositeType?: string;
  components?: MaterialComponentInput[];
}

export type UpdateItemBody = Partial<CreateItemBody>;

export interface CreateSaleBody {
  itemId: number;
  actualPrice: number;
  channel: string;
  saleDate: string;
  customerId?: number;
  note?: string;
}

export type UpdateSaleBody = Partial<CreateSaleBody>;

export interface CreateBundleSaleBody {
  itemIds: number[];
  totalPrice: number;
  allocMethod: string;
  chainItemIds?: number[];
  saleDate: string;
  channel: string;
  customerId?: number;
  note?: string;
}

export interface ReturnSaleBody {
  saleId: number;
  refundAmount: number;
  returnReason: string;
  returnDate: string;
}

export interface MergeCustomerBody {
  targetCustomerId: number;
  saleRecordIds: number[];
}

export interface UpdateMetalPriceBody {
  materialId: number;
  pricePerGram: number;
}

export interface RepriceBody {
  materialId: number;
  newPricePerGram: number;
}

export interface PricingBody {
  materialId: number;
  costPrice?: number;
  typeId?: number;
  weight?: number;
  metalWeight?: number;
  laborCost?: number;
  margin?: number;
}

export interface BatchPriceBody {
  ids: string[];
  adjustmentType: 'percentage' | 'fixed';
  value: number;
  direction: 'increase' | 'decrease';
}

export interface UpdateConfigBody {
  key: string;
  value: string;
}

export interface ChangePasswordBody {
  oldPassword: string;
  newPassword: string;
}

export interface ImportOptions {
  autoCreate?: boolean;
  skipExisting?: boolean;
}
