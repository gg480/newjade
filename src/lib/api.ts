// API client for jade inventory system
import type {
  DictMaterial, DictType, DictTag, SysConfig,
  PriceRange, CustomerSegment, ProductCategory,
  Batch, ItemSummary, SkuLookupResult, SaleRecord, Customer, CustomerDetail,
  Supplier, SupplierStats, SupplierPurchase,
  PaginatedData, ImageUploadResult, ImageUploadResponse,
  DashboardSummary, BatchProfitItem, StockAging, TopSellerItem, MonthlyComparison,
  TrendDataPoint, SalesByChannelItem, ProfitByCategoryItem, ProfitByChannelItem,
  ProfitByCounterItem, PriceRangeItem, WeightDistribution, AgeDistributionItem,
  DistributionByType, DistributionByMaterial, TurnoverDataPoint, HeatmapData,
  CustomerFrequency, TopCustomerItem, InventoryValueByCategoryItem,
  DashboardAggregate, RecentSaleItem,
  MetalPrice, MarketPriceItem, CompetitorPrice, LocalReferenceResponse, RepricePreview, PricingResult, OperationLog, Notification,
  ImportResult, BatchPriceAdjustResult, BatchCompleteResult, AuthToken, AuthSession, BackupResult,
  ItemsQueryParams, SalesQueryParams, BatchesQueryParams, CustomersQueryParams,
  SuppliersQueryParams, LogsQueryParams, NotificationsQueryParams,
  DashboardQueryParams, MetalPriceHistoryParams, SupplierStatsParams,
  CreateDictMaterialBody, CreateDictTypeBody, CreateDictTagBody,
  CreateCustomerBody, UpdateCustomerBody, CreateSupplierBody, UpdateSupplierBody,
  CreateBatchBody, UpdateBatchBody, CreateItemBody, UpdateItemBody,
  CreateSaleBody, UpdateSaleBody, CreateBundleSaleBody, ReturnSaleBody,
  MergeCustomerBody, UpdateMetalPriceBody, RepriceBody, PricingBody,
  BatchPriceBody, UpdateConfigBody, ChangePasswordBody, ImportOptions,
  CurrentUser, UserInfo, RoleInfo, UpdateLaborCostBody,
} from './api.types';

const BASE = '/api';

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) };
  // Attach auth token for API middleware
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const { headers: _optHeaders, ...restOptions } = options || {};
  const res = await fetch(`${BASE}${path}`, {
    ...restOptions,
    headers,
  });
  let json: { code: number; data: T; message: string } | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail = json?.message || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`请求失败: ${detail}`);
  }
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(json.message || '请求失败');
  }
  return json.data as T;
}

function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ========== Dicts ==========
export const dictsApi = {
  getMaterials: (includeInactive = false) =>
    request<DictMaterial[]>(`/dicts/materials?include_inactive=${includeInactive}`),
  createMaterial: (data: CreateDictMaterialBody) =>
    request<DictMaterial>('/dicts/materials', { method: 'POST', body: JSON.stringify(data) }),
  updateMaterial: (id: number, data: Partial<CreateDictMaterialBody>) =>
    request<DictMaterial>(`/dicts/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMaterial: (id: number) =>
    request<null>(`/dicts/materials/${id}`, { method: 'DELETE' }),

  getTypes: (includeInactive = false, materialId?: number) =>
    request<DictType[]>(`/dicts/types?include_inactive=${includeInactive}${materialId ? `&material_id=${materialId}` : ''}`),
  createType: (data: CreateDictTypeBody) =>
    request<DictType>('/dicts/types', { method: 'POST', body: JSON.stringify(data) }),
  updateType: (id: number, data: Partial<CreateDictTypeBody>) =>
    request<DictType>(`/dicts/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteType: (id: number) =>
    request<null>(`/dicts/types/${id}`, { method: 'DELETE' }),

  getTags: (groupName?: string, includeInactive = false, materialId?: number) =>
    request<DictTag[]>(`/dicts/tags?${groupName ? `group_name=${groupName}&` : ''}include_inactive=${includeInactive}${materialId ? `&material_id=${materialId}` : ''}`),
  createTag: (data: CreateDictTagBody) =>
    request<DictTag>('/dicts/tags', { method: 'POST', body: JSON.stringify(data) }),
  updateTag: (id: number, data: Partial<CreateDictTagBody>) =>
    request<DictTag>(`/dicts/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTag: (id: number) =>
    request<null>(`/dicts/tags/${id}`, { method: 'DELETE' }),

  // ===== 价格带 =====
  getPriceRanges: () => request<PriceRange[]>('/dicts/price-ranges'),
  createPriceRange: (data: { name: string; minValue?: number; maxValue?: number; sortOrder?: number }) =>
    request<PriceRange>('/dicts/price-ranges', { method: 'POST', body: JSON.stringify(data) }),
  updatePriceRange: (id: number, data: { name?: string; minValue?: number; maxValue?: number; sortOrder?: number; isActive?: boolean }) =>
    request<PriceRange>(`/dicts/price-ranges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePriceRange: (id: number) =>
    request<null>(`/dicts/price-ranges/${id}`, { method: 'DELETE' }),

  // ===== 客户分组 =====
  getCustomerSegments: () => request<CustomerSegment[]>('/dicts/customer-segments'),
  createCustomerSegment: (data: { name: string; description?: string; sortOrder?: number }) =>
    request<CustomerSegment>('/dicts/customer-segments', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomerSegment: (id: number, data: { name?: string; description?: string; sortOrder?: number; isActive?: boolean }) =>
    request<CustomerSegment>(`/dicts/customer-segments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomerSegment: (id: number) =>
    request<null>(`/dicts/customer-segments/${id}`, { method: 'DELETE' }),

  // ===== 商品分类 =====
  getProductCategories: () => request<ProductCategory[]>('/dicts/product-categories'),
  createProductCategory: (data: { name: string; parentId?: number; description?: string; sortOrder?: number }) =>
    request<ProductCategory>('/dicts/product-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateProductCategory: (id: number, data: { name?: string; parentId?: number; description?: string; sortOrder?: number; isActive?: boolean }) =>
    request<ProductCategory>(`/dicts/product-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProductCategory: (id: number) =>
    request<null>(`/dicts/product-categories/${id}`, { method: 'DELETE' }),
};

// ========== Config ==========
export const configApi = {
  getConfig: () => request<SysConfig[]>('/config'),
  updateConfig: (key: string, value: string) =>
    request<null>('/config', { method: 'PUT', body: JSON.stringify({ key, value } satisfies UpdateConfigBody) }),
};

// ========== Batches ==========
export const batchesApi = {
  getBatches: (params?: BatchesQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<PaginatedData<Batch>>(`/batches${qs}`);
  },
  getBatch: (id: number) => request<Batch>(`/batches/${id}`),
  createBatch: (data: CreateBatchBody) =>
    request<Batch>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateBatch: (id: number, data: UpdateBatchBody) =>
    request<Batch>(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  allocateBatch: (id: number) =>
    request<Batch>(`/batches/${id}/allocate`, { method: 'POST' }),
  deleteBatch: (id: number) =>
    request<null>(`/batches/${id}`, { method: 'DELETE' }),
};

// ========== Items ==========
export const itemsApi = {
  getItems: (params?: ItemsQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<PaginatedData<ItemSummary>>(`/items${qs}`);
  },
  getItem: (id: number) => request<ItemSummary>(`/items/${id}`),
  createItem: (data: CreateItemBody) =>
    request<ItemSummary>('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: number, data: UpdateItemBody) =>
    request<ItemSummary>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id: number, hard?: boolean) =>
    request<null>(`/items/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' }),
  createItemsBatch: (data: CreateItemBody[]) =>
    request<ItemSummary[]>('/items/batch', { method: 'POST', body: JSON.stringify(data) }),
  lookupBySku: (sku: string) => request<SkuLookupResult>(`/items/lookup?sku=${encodeURIComponent(sku)}`),
  uploadImage: async (itemId: number, file: File, angleCode?: string) => {
    const formData = new FormData();
    formData.append('image', file);
    if (angleCode) formData.append('angleCode', angleCode);
    const res = await fetch(`${BASE}/items/${itemId}/images`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '上传失败');
    return json.data as ImageUploadResult;
  },
  /** 扫码拍摄：SKU定位 + 上传图片 + 标记角度，一步完成 */
  scanPhoto: async (skuCode: string, file: File, angleCode?: string) => {
    const formData = new FormData();
    formData.append('skuCode', skuCode);
    formData.append('image', file);
    if (angleCode) formData.append('angleCode', angleCode);
    const res = await fetch(`${BASE}/items/scan-photo`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '上传失败');
    return json.data as ImageUploadResult;
  },
  deleteImage: (itemId: number, imageId: number) =>
    request<null>(`/items/${itemId}/images?image_id=${imageId}`, { method: 'DELETE' }),
  setCoverImage: (itemId: number, imageId: number) =>
    request<null>(`/items/${itemId}/images`, { method: 'PUT', body: JSON.stringify({ imageId }) }),
};

// ========== Sales ==========
export const salesApi = {
  getSales: (params?: SalesQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<PaginatedData<SaleRecord>>(`/sales${qs}`);
  },
  createSale: (data: CreateSaleBody) =>
    request<SaleRecord>('/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateSale: (id: number, data: UpdateSaleBody) =>
    request<SaleRecord>(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  createBundleSale: (data: CreateBundleSaleBody) =>
    request<SaleRecord[]>('/sales/bundle', { method: 'POST', body: JSON.stringify(data) }),
  returnSale: (data: ReturnSaleBody) =>
    request<SaleRecord>('/sales/return', { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Customers ==========
export const customersApi = {
  getCustomers: (params?: CustomersQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<PaginatedData<Customer>>(`/customers${qs}`);
  },
  getCustomerDetail: (id: number) => request<CustomerDetail>(`/customers/${id}`),
  createCustomer: (data: CreateCustomerBody) =>
    request<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: number, data: UpdateCustomerBody) =>
    request<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: number) =>
    request<null>(`/customers/${id}`, { method: 'DELETE' }),
  mergeCustomer: (sourceId: number, data: MergeCustomerBody) =>
    request<null>(`/customers/${sourceId}/merge`, { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Suppliers ==========
export const suppliersApi = {
  getSuppliers: (params?: SuppliersQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<PaginatedData<Supplier>>(`/suppliers${qs}`);
  },
  createSupplier: (data: CreateSupplierBody) =>
    request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: UpdateSupplierBody) =>
    request<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: number) =>
    request<null>(`/suppliers/${id}`, { method: 'DELETE' }),
  // 供应商进货统计
  getSupplierStats: () => request<SupplierStats>('/suppliers/stats'),
  getSupplierPurchases: (supplierId: number, params?: SupplierStatsParams) => {
    const qs = buildQueryString({ supplierId: String(supplierId), ...params } as Record<string, string | number | boolean | undefined | null>);
    return request<PaginatedData<SupplierPurchase>>(`/suppliers/stats${qs}`);
  },
};

// ========== Logs ==========
export const logsApi = {
  getLogs: (params?: LogsQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<PaginatedData<OperationLog>>(`/logs${qs}`);
  },
};

// ========== Backup ==========
export const backupApi = {
  download: () => `${BASE}/backup`,
  restore: async (file: File) => {
    const formData = new FormData();
    formData.append('backup', file);
    const res = await fetch(`${BASE}/backup`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '恢复失败');
    return json.data as BackupResult;
  },
};

// ========== Dashboard ==========
export const dashboardApi = {
  getSummary: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<DashboardSummary>(`/dashboard/summary${qs}`);
  },
  getBatchProfit: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<BatchProfitItem[]>(`/dashboard/batch-profit${qs}`);
  },
  getProfitByCategory: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<ProfitByCategoryItem[]>(`/dashboard/profit/by-category${qs}`);
  },
  getProfitByChannel: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<ProfitByChannelItem[]>(`/dashboard/profit/by-channel${qs}`);
  },
  getTrend: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<TrendDataPoint[]>(`/dashboard/trend${qs}`);
  },
  getStockAging: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<StockAging>(`/dashboard/stock-aging${qs}`);
  },
  getDistributionByType: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<DistributionByType>(`/dashboard/distribution/by-type${qs}`);
  },
  getDistributionByMaterial: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<DistributionByMaterial>(`/dashboard/distribution/by-material${qs}`);
  },
  getProfitByCounter: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<ProfitByCounterItem[]>(`/dashboard/profit/by-counter${qs}`);
  },
  getPriceRangeCost: () => request<PriceRangeItem[]>(`/dashboard/price-range/cost`),
  getPriceRangeSelling: () => request<PriceRangeItem[]>(`/dashboard/price-range/selling`),
  getWeightDistribution: () => request<WeightDistribution>(`/dashboard/weight-distribution`),
  getAgeDistribution: () => request<AgeDistributionItem[]>(`/dashboard/age-distribution`),
  getMomComparison: () => request<MonthlyComparison>(`/dashboard/mom-comparison`),
  getTurnover: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<TurnoverDataPoint[]>(`/dashboard/turnover${qs}`);
  },
  getHeatmap: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<HeatmapData>(`/dashboard/heatmap${qs}`);
  },
  getTopSellers: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<TopSellerItem[]>(`/dashboard/top-sellers${qs}`);
  },
  getCustomerFrequency: () => request<CustomerFrequency>(`/dashboard/customer-frequency`),
  getTopCustomers: () => request<TopCustomerItem[]>(`/dashboard/top-customers`),
  getAggregate: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<DashboardAggregate>(`/dashboard/aggregate${qs}`);
  },
  getInventoryValueByCategory: () => request<InventoryValueByCategoryItem[]>(`/dashboard/inventory-value-by-category`),
  getSalesByChannel: (params?: DashboardQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<SalesByChannelItem[]>(`/dashboard/sales-by-channel${qs}`);
  },
};

// ========== Metal Prices ==========
export const metalApi = {
  getCurrentPrices: () => request<MetalPrice[]>('/metal-prices'),
  updatePrice: (data: UpdateMetalPriceBody) =>
    request<MetalPrice>('/metal-prices', { method: 'POST', body: JSON.stringify(data) }),
  getPriceHistory: (params?: MetalPriceHistoryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<MetalPrice[]>(`/metal-prices/history${qs}`);
  },
  getMarketPrices: (source?: 'gzjn168' | 'tanshu' | 'auto') =>
    request<MarketPriceItem[]>(`/metal-prices/market${source ? `?source=${source}` : ''}`),
  /** 获取竞品金价列表 */
  getCompetitors: () => request<CompetitorPrice[]>('/metal-prices/competitors'),
  /** 获取本地参考行情（融通金 gzjn168.com） */
  getLocalReference: () =>
    request<LocalReferenceResponse>('/metal-prices/local-reference'),
  /** 更新材质工费单价 */
  updateLaborCost: (data: UpdateLaborCostBody) =>
    request<null>('/metal-prices/labor-cost', { method: 'PUT', body: JSON.stringify(data) }),
  previewReprice: (data: RepriceBody) =>
    request<RepricePreview>('/metal-prices/reprice', { method: 'POST', body: JSON.stringify(data) }),
  confirmReprice: (data: RepriceBody) =>
    request<{ affectedItems: number; message: string }>('/metal-prices/reprice/confirm', { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Pricing ==========
export const pricingApi = {
  calculate: (data: PricingBody) =>
    request<PricingResult>('/pricing', { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Import ==========
export const importApi = {
  importItems: async (file: File, options?: ImportOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('autoCreate', String(options?.autoCreate ?? true));
    formData.append('skipExisting', String(options?.skipExisting ?? true));
    const res = await fetch(`${BASE}/import/items`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '导入失败');
    return json.data as ImportResult;
  },
  importCsvItems: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/import/items-csv`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '导入失败');
    return json.data as ImportResult;
  },
  importSales: async (file: File, options?: { autoCreate?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('autoCreate', String(options?.autoCreate ?? true));
    const res = await fetch(`${BASE}/import/sales`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '导入失败');
    return json.data as ImportResult;
  },
  downloadTemplate: (type: 'items' | 'sales') => `${BASE}/import/template?type=${type}`,
};

// ========== Promotions ==========
export const promotionsApi = {
  getPromotions: (params?: Record<string, string | number | boolean | undefined | null>) => {
    const qs = params ? buildQueryString(params) : '';
    return request<any>(`/promotions${qs}`);
  },
  createPromotion: (data: Record<string, unknown>) =>
    request<any>('/promotions', { method: 'POST', body: JSON.stringify(data) }),
  updatePromotion: (id: number, data: Record<string, unknown>) =>
    request<any>(`/promotions?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePromotion: (id: number) =>
    request<any>(`/promotions?id=${id}`, { method: 'DELETE' }),
  getPromotionItems: (promotionId: number) =>
    request<any>(`/promotions/${promotionId}/items`),
  addPromotionItems: (promotionId: number, itemIds: number[]) =>
    request<any>(`/promotions/${promotionId}/items`, { method: 'POST', body: JSON.stringify({ itemIds }) }),
  removePromotionItems: (promotionId: number, itemIds: number[]) =>
    request<any>(`/promotions/${promotionId}/items`, { method: 'DELETE', body: JSON.stringify({ itemIds }) }),
  forecastPromotionEffect: (promotionId: number) =>
    request<any>(`/promotions/${promotionId}/forecast`),
};

// ========== Stocktaking ==========
export const stocktakingApi = {
  listStocktakings: (params?: Record<string, string | number | boolean | undefined | null>) => {
    const qs = params ? buildQueryString(params) : '';
    return request<any>(`/stocktaking${qs}`);
  },
  getStocktaking: (id: number) =>
    request<any>(`/stocktaking/${id}`),
  createStocktaking: (data: Record<string, unknown>) =>
    request<any>('/stocktaking', { method: 'POST', body: JSON.stringify(data) }),
  updateStocktaking: (id: number, data: Record<string, unknown>) =>
    request<any>(`/stocktaking/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateDetails: (stocktakingId: number, data: Record<string, unknown>) =>
    request<any>(`/stocktaking/${stocktakingId}/details`, { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Restock ==========
export const restockApi = {
  getRecommendations: (params?: Record<string, string | number | boolean | undefined | null>) => {
    const qs = params ? buildQueryString(params) : '';
    return request<any[]>(`/restock/recommendations${qs}`);
  },
  generateRecommendations: (data: Record<string, unknown>) =>
    request<any[]>('/restock/generate', { method: 'POST', body: JSON.stringify(data) }),
  getSeasonalFactors: (params?: Record<string, string | number | boolean | undefined | null>) => {
    const qs = params ? buildQueryString(params) : '';
    return request<any[]>(`/restock/seasonal${qs}`);
  },
};

// ========== Batch Price & Complete ==========
export const itemsApiEnhanced = {
  batchPriceAdjust: async (data: BatchPriceBody) => {
    return request<BatchPriceAdjustResult>('/items/batch-price', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  /** 批量补全货品数据（PATCH /api/items/batch-complete） */
  batchComplete: async (data: {
    ids: number[];
    materialId?: number;
    typeId?: number;
    name?: string;
    tagIds?: number[];
    counter?: number;
    floorPrice?: number;
    origin?: string;
    weight?: number;
  }) => {
    return request<{ success: number; failed: number }>('/items/batch-complete', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ========== Images ==========
export const imagesApi = {
  /** 上传单张照片（不关联货品，返回访问 URL） */
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/images/upload`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '上传失败');
    return json.data as ImageUploadResponse;
  },
};

// ========== Auth ==========
export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; expiresIn: number; user: CurrentUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  validateSession: () =>
    request<AuthSession>('/auth', { method: 'GET' }),
  logout: () =>
    request<null>('/auth/logout', { method: 'POST' }),
  getMe: () =>
    request<CurrentUser>('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<null>('/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword } satisfies ChangePasswordBody) }),
};

// ========== Users ==========
export const usersApi = {
  list: (params?: Record<string, string | number | boolean | undefined | null>) => {
    const qs = params ? buildQueryString(params) : '';
    return request<{ items: UserInfo[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/users${qs}`);
  },
  create: (data: { username: string; password: string; displayName: string; roleId: number }) =>
    request<UserInfo>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { displayName?: string; roleId?: number; isActive?: boolean }) =>
    request<UserInfo>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<null>(`/users/${id}`, { method: 'DELETE' }),
  updateRole: (id: number, roleId: number) =>
    request<null>(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ roleId }) }),
  resetPassword: (id: number, newPassword: string) =>
    request<null>(`/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) }),
};

// ========== Roles ==========
export const rolesApi = {
  list: () =>
    request<{ items: RoleInfo[] }>('/roles'),
  create: (data: { name: string; description?: string; permissions: string[] }) =>
    request<RoleInfo>('/roles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name?: string; description?: string; permissions?: string[] }) =>
    request<RoleInfo>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<null>(`/roles/${id}`, { method: 'DELETE' }),
  getDetail: (id: number) =>
    request<RoleInfo>(`/roles/${id}`),
};

// ========== Notifications ==========
export const notificationsApi = {
  getNotifications: (params?: NotificationsQueryParams) => {
    const qs = params ? buildQueryString(params as Record<string, string | number | boolean | undefined | null>) : '';
    return request<PaginatedData<Notification>>(`/notifications${qs}`);
  },
  generateReport: (type: 'weekly_report' | 'monthly_report') =>
    request<Notification>('/notifications/generate', { method: 'POST', body: JSON.stringify({ type }) }),
  markAsRead: (id: number) =>
    request<null>(`/notifications/${id}`, { method: 'PATCH' }),
  markAllAsRead: () =>
    request<null>('/notifications/read-all', { method: 'PATCH' }),
};

// ========== Export ==========
export const exportApi = {
  inventory: (params?: Record<string, string | number | boolean>) => {
    const qs = params ? buildQueryString(params) : '';
    return `${BASE}/export/inventory${qs}`;
  },
  sales: (params?: Record<string, string | number | boolean>) => {
    const qs = params ? buildQueryString(params) : '';
    return `${BASE}/export/sales${qs}`;
  },
  batches: (params?: Record<string, string | number | boolean>) => {
    const qs = params ? buildQueryString(params) : '';
    return `${BASE}/export/batches${qs}`;
  },
  /** 导出标签打印数据（德佟 P2 微打 App 兼容 CSV） */
  exportLabels: async (ids: number[]) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${BASE}/export/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        detail = errJson.message || detail;
      } catch { /* ignore */ }
      throw new Error('导出失败: ' + detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labels_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  /** 导出全部货品标签数据（德佟 P2 微打 App 兼容 CSV） */
  exportAllLabels: async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${BASE}/export/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        detail = errJson.message || detail;
      } catch { /* ignore */ }
      throw new Error('导出失败: ' + detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `全部标签_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
