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
  sortOrder: number;
  isActive: boolean;
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

// ========== 系统配置 ==========

export interface SysConfig {
  id: number;
  key: string;
  value: string;
  description: string | null;
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
  // Relations
  material?: DictMaterial;
  type?: DictType;
  batch?: Batch;
  supplier?: Supplier;
  spec?: ItemSpec | null;
  images?: ItemImage[];
  tags?: DictTag[];
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
}

export interface DistributionByMaterial {
  priceDistribution: Array<{ materialName: string; totalSellingPrice: number }>;
  profitByMaterial: Array<{ materialName: string; profit: number }>;
  countByMaterial: Array<{ materialName: string; count: number }>;
  marginByMaterial: Array<{ materialName: string; margin: number }>;
}

export interface TurnoverDataPoint {
  month: string;
  sellCount: number;
  revenue: number;
  avgSellingDays: number;
}

export interface HeatmapData {
  days: string[];
  channels: string[];
  data: number[][];
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

export interface MetalPrice {
  id: number;
  materialId: number;
  pricePerGram: number;
  effectiveDate: string;
  createdAt: string;
  material?: DictMaterial;
}

export interface RepricePreview {
  affectedItems: number;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
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
  failed: number;
  errors: string[];
  items?: ItemSummary[];
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

// ========== 认证 ==========

export interface AuthToken {
  token: string;
  expiresIn: number;
}

export interface AuthSession {
  authenticated: boolean;
  user: string;
}

// ========== 备份 ==========

export interface BackupResult {
  filename: string;
  size: number;
  message: string;
}

// ========== 图像上传结果 ==========

export interface ImageUploadResult {
  id: number;
  itemId: number;
  filename: string;
  isCover: boolean;
}

// ========== 查询参数类型 ==========

export interface PaginationQueryParams {
  page?: number;
  size?: number;
}

export interface ItemsQueryParams extends PaginationQueryParams {
  material_id?: string;
  type_id?: string;
  status?: string;
  batch_id?: string;
  counter?: string;
  keyword?: string;
  search_field?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface SalesQueryParams extends PaginationQueryParams {
  channel?: string;
  start_date?: string;
  end_date?: string;
  customer_id?: string;
  unlinked_only?: string;
  keyword?: string;
  item_keyword?: string;
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
}

export interface MetalPriceHistoryParams extends PaginationQueryParams {
  material_id?: string;
  start_date?: string;
  end_date?: string;
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
}

export interface CreateDictTypeBody {
  name: string;
  specFields?: string;
  sortOrder?: number;
}

export interface CreateDictTagBody {
  name: string;
  groupName?: string;
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
  materialId: number;
  typeId?: number;
  costPrice?: number;
  sellingPrice: number;
  floorPrice?: number;
  origin?: string;
  counter?: number;
  batchId?: number;
  notes?: string;
  spec?: Partial<ItemSpec>;
  tags?: number[];
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
  weight: number;
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
