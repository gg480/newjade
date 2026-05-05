// API client for jade inventory system
import type {
  DictMaterial, DictType, DictTag, SysConfig,
  Batch, ItemSummary, SkuLookupResult, SaleRecord, Customer, CustomerDetail,
  Supplier, SupplierStats, SupplierPurchase,
  PaginatedData, ImageUploadResult,
  DashboardSummary, BatchProfitItem, StockAging, TopSellerItem, MonthlyComparison,
  TrendDataPoint, SalesByChannelItem, ProfitByCategoryItem, ProfitByChannelItem,
  ProfitByCounterItem, PriceRangeItem, WeightDistribution, AgeDistributionItem,
  DistributionByType, DistributionByMaterial, TurnoverDataPoint, HeatmapData,
  CustomerFrequency, TopCustomerItem, InventoryValueByCategoryItem,
  DashboardAggregate, RecentSaleItem,
  MetalPrice, RepricePreview, PricingResult, OperationLog, Notification,
  ImportResult, BatchPriceAdjustResult, AuthToken, AuthSession, BackupResult,
  ItemsQueryParams, SalesQueryParams, BatchesQueryParams, CustomersQueryParams,
  SuppliersQueryParams, LogsQueryParams, NotificationsQueryParams,
  DashboardQueryParams, MetalPriceHistoryParams, SupplierStatsParams,
  CreateDictMaterialBody, CreateDictTypeBody, CreateDictTagBody,
  CreateCustomerBody, UpdateCustomerBody, CreateSupplierBody, UpdateSupplierBody,
  CreateBatchBody, UpdateBatchBody, CreateItemBody, UpdateItemBody,
  CreateSaleBody, UpdateSaleBody, CreateBundleSaleBody, ReturnSaleBody,
  MergeCustomerBody, UpdateMetalPriceBody, RepriceBody, PricingBody,
  BatchPriceBody, UpdateConfigBody, ChangePasswordBody, ImportOptions,
} from './api.types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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

  getTypes: (includeInactive = false) =>
    request<DictType[]>(`/dicts/types?include_inactive=${includeInactive}`),
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
  uploadImage: async (itemId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/items/${itemId}/images`, { method: 'POST', body: formData });
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

// ========== Batch Price ==========
export const itemsApiEnhanced = {
  batchPriceAdjust: async (data: BatchPriceBody) => {
    return request<BatchPriceAdjustResult>('/items/batch-price', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ========== Auth ==========
export const authApi = {
  login: (password: string) =>
    request<AuthToken>('/auth', { method: 'POST', body: JSON.stringify({ password }) }),
  validateSession: () =>
    request<AuthSession>('/auth', { method: 'GET' }),
  logout: () =>
    request<null>('/auth', { method: 'DELETE' }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<null>('/auth', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword } satisfies ChangePasswordBody) }),
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
};
