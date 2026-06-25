'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { itemsApi, salesApi, dictsApi, batchesApi, exportApi, customersApi } from '@/lib/api';
import type { ItemSummary, DictMaterial, DictType, DictTag, Batch, Customer, PaginatedData, ItemsQueryParams, CreateSaleBody, BatchPriceAdjustResult } from '@/lib/api.types';
import type { LabelItem } from './label-print-dialog';
import { CustomerSearchSelect } from './customer-search-select';
import { itemsApiEnhanced } from '@/lib/api';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { formatPrice, StatusBadge, EmptyState, LoadingSkeleton, ConfirmDialog } from './shared';
import ItemCreateDialog from './item-create-dialog';
import FactoryModeWrapper from './create/factory-mode-wrapper';
import BatchPhotoMode from './create/batch-photo-mode';
import ScanPhotoMode from './create/scan-photo-mode';
import ItemDetailDialog from './item-detail-dialog';
import ItemEditDialog from './item-edit-dialog';
import LabelPrintDialog from './label-print-dialog';
// BarcodeScanner loaded dynamically when scanner dialog opens (avoids html5-qrcode chunk loading at tab load)
import ImageLightbox from './image-lightbox';
import SortableHead from './inventory/inventory-sortable-head';
import InventoryFilterBar from './inventory/inventory-filter-bar';
import InventoryBatchOpsBar from './inventory/inventory-batch-ops-bar';
import InventoryDesktopTable from './inventory/inventory-desktop-table';
import InventoryMobileCards from './inventory/inventory-mobile-cards';
import InventoryScanSellSection from './inventory/inventory-scan-sell-section';
import InventoryBatchPriceDialog from './inventory/inventory-batch-price-dialog';
import InventoryBatchCompleteDialog from './inventory/inventory-batch-complete-dialog';
import InventoryItemSlidePanel from './inventory/inventory-item-slide-panel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Package, CheckCircle, DollarSign, BarChart3, Plus, Search, Eye,
  Pencil, DollarSign as DollarSignIcon, RotateCcw, Trash2, Barcode, Printer, ArrowUp, ArrowDown, ArrowUpDown, Camera, Layers,
  ShoppingCart, Tag, MapPin, X, Gem, CheckSquare, ChevronDown, ChevronUp, SlidersHorizontal,
  Info, FileText, FileCheck, CalendarDays, Target, MoreHorizontal, Copy, Loader2, Clock,
  CircleDot, AlertCircle,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// ========== Tag Color Map ==========
const TAG_COLOR_PALETTE = [
  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
];
const TAG_COLOR_CACHE: Record<string, string> = {};
function getTagColor(tagName: string): string {
  if (!TAG_COLOR_CACHE[tagName]) {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash += tagName.charCodeAt(i);
    }
    TAG_COLOR_CACHE[tagName] = TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
  }
  return TAG_COLOR_CACHE[tagName];
}

// ========== Inventory Tab ==========
function InventoryTab() {
  const { setActiveTab } = useAppStore();
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [summary, setSummary] = useState({
    statusCounts: { in_stock: 0, sold: 0, returned: 0 },
    totalCost: 0,
    totalMarketValue: 0,
  });
  const [materials, setMaterials] = useState<DictMaterial[]>([]);
  const [types, setTypes] = useState<DictType[]>([]);
  const [tags, setTags] = useState<DictTag[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ materialCategory: '', materialId: '', typeId: '', tagId: '', status: '', keyword: '', counter: '', batchId: '', has_tags: '', minPrice: '', maxPrice: '', purchaseStartDate: '', purchaseEndDate: '' });
  const [searchField, setSearchField] = useState('all');
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(['in_stock']));
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [returnConfirmItem, setReturnConfirmItem] = useState<{ open: boolean; item: ItemSummary | null }>({ open: false, item: null });
  const [saleDialog, setSaleDialog] = useState<{ open: boolean; item: ItemSummary | null }>({ open: false, item: null });
  const [saleForm, setSaleForm] = useState({ actualPrice: 0, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' });
  const [scanSku, setScanSku] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [printLabelItem, setPrintLabelItem] = useState<ItemSummary | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerComponent, setScannerComponent] = useState<React.ComponentType<object> | null>(null);

  // Open scanner - dynamic import of local barcode-scanner component
  async function openScanner() {
    if (!scannerComponent) {
      try {
        const mod = await import('@/components/inventory/barcode-scanner');
        setScannerComponent(() => mod.default as unknown as React.ComponentType<object>);
      } catch (e) { console.error('[InventoryTab]', e);
        toast.error('扫码组件加载失败，请刷新页面重试');
        return;
      }
    }
    setShowScanner(true);
  }

  // Batch operation dialogs
  const [batchSellOpen, setBatchSellOpen] = useState(false);
  const [batchRestoreOpen, setBatchRestoreOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchPriceOpen, setBatchPriceOpen] = useState(false);
  const [batchCompleteOpen, setBatchCompleteOpen] = useState(false);
  const [batchCounterOpen, setBatchCounterOpen] = useState(false);

  // Batch sell form
  const [batchSellForm, setBatchSellForm] = useState({ channel: 'store', saleDate: new Date().toISOString().slice(0, 10), useCurrentPrice: true, customerId: '' });
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Batch delete options
  const [batchDeleteHard, setBatchDeleteHard] = useState(false);

  // Batch price adjust form
  const [batchPriceForm, setBatchPriceForm] = useState<{ mode: 'percent' | 'fixed'; target: 'sellingPrice' | 'minimumPrice'; value: string; direction: 'increase' | 'decrease' }>({ mode: 'percent', target: 'sellingPrice', value: '', direction: 'increase' });

  // Batch counter form
  const [batchCounterForm, setBatchCounterForm] = useState({ counter: '' });

  // Batch operation loading state
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Batch sell individual prices
  const [batchSellPrices, setBatchSellPrices] = useState<Record<number, number>>({});

  // Batch label print dialog
  const [batchLabelPrintOpen, setBatchLabelPrintOpen] = useState(false);

  // Delete confirmation dialog
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any>(null);

  // Slide-in detail panel
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Factory mode (快速录货)
  const [showFactoryMode, setShowFactoryMode] = useState(false);
  const [factoryMode] = useState<'photo' | 'draft'>('photo');

  // Batch photo mode (批量补图)
  const [showBatchPhoto, setShowBatchPhoto] = useState(false);

  // Scan photo mode (扫码拍摄)
  const [showScanPhoto, setShowScanPhoto] = useState(false);

  // Image lightbox gallery
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ id: number; url: string; isCover?: boolean }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    dictsApi.getMaterials().then(setMaterials).catch(() => {});
    loadTypes();
    loadTags();
  }, []);
  const loadTypes = async (materialId?: number) => {
    try {
      const data = await dictsApi.getTypes(false, materialId);
      setTypes(data);
    } catch (error) {
      console.error('加载器型失败:', error);
    }
  };
  const loadTags = async (materialId?: number) => {
    try {
      const data = await dictsApi.getTags(undefined, false, materialId);
      setTags(data);
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  };
  useEffect(() => { customersApi.getCustomers().then((d: PaginatedData<Customer>) => setCustomers(d?.items || d || [])).catch(() => {}); }, []);
  useEffect(() => { batchesApi.getBatches({ page: 1, size: 1000 }).then(d => setAllBatches(d.items || [])).catch(() => {}); }, []);

  // Listen for escape key to close detail panel
  useEffect(() => {
    const handler = () => setSelectedItemId(null);
    window.addEventListener('escape-press', handler);
    return () => window.removeEventListener('escape-press', handler);
  }, []);

  // Listen for shortcut-new-item to open create dialog
  useEffect(() => {
    const handler = () => setShowCreate(true);
    window.addEventListener('shortcut-new-item', handler);
    return () => window.removeEventListener('shortcut-new-item', handler);
  }, []);

  // Extract unique counters from loaded items
  const allCounters = useMemo(() => {
    const counterSet = new Set<number>();
    items.forEach(i => { if (i.counter != null) counterSet.add(i.counter); });
    return Array.from(counterSet).sort((a, b) => a - b);
  }, [items]);

  // Status counts for filter buttons
  const statusCounts = useMemo(() => summary.statusCounts, [summary.statusCounts]);

  // Toggle status filter
  function toggleStatusFilter(status: string) {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  // Client-side filter for price range, purchase date, and multi-status (applied after server fetch)
  const filteredItems = useMemo(() => {
    let result = items;
    // Multi-status filter
    if (activeStatuses.size > 0 && activeStatuses.size < 3) {
      result = result.filter(i => activeStatuses.has(i.status));
    }
    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice);
      if (!isNaN(min)) result = result.filter(i => (i.sellingPrice || 0) >= min);
    }
    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice);
      if (!isNaN(max)) result = result.filter(i => (i.sellingPrice || 0) <= max);
    }
    if (filters.purchaseStartDate) {
      result = result.filter(i => (i.purchaseDate || '') >= filters.purchaseStartDate);
    }
    if (filters.purchaseEndDate) {
      result = result.filter(i => (i.purchaseDate || '') <= filters.purchaseEndDate);
    }
    if (filters.typeId) {
      result = result.filter(i => String(i.typeId) === filters.typeId);
    }
    if (filters.tagId) {
      result = result.filter(i => i.tags?.some((t: DictTag) => String(t.id) === filters.tagId));
    }
    return result;
  }, [items, activeStatuses, filters.minPrice, filters.maxPrice, filters.purchaseStartDate, filters.purchaseEndDate, filters.typeId, filters.tagId]);

  // Client-side sort for table display
  const sortedItems = useMemo(() => {
    if (!filteredItems.length) return filteredItems;
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'selling_price':
          cmp = (a.sellingPrice || 0) - (b.sellingPrice || 0);
          break;
        case 'cost_price':
          cmp = (a.allocatedCost || a.estimatedCost || a.costPrice || 0) - (b.allocatedCost || b.estimatedCost || b.costPrice || 0);
          break;
        case 'purchase_date':
          cmp = (a.purchaseDate || '').localeCompare(b.purchaseDate || '');
          break;
        case 'sku_code':
          cmp = (a.skuCode || '').localeCompare(b.skuCode || '');
          break;
        case 'name':
          cmp = (a.name || a.skuCode || '').localeCompare(b.name || b.skuCode || '');
          break;
        case 'created_at':
        default:
          cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredItems, sortBy, sortOrder]);

  // 根据大类筛选材质
  const filteredMaterials = materials.filter((m: DictMaterial) => {
    if (!filters.materialCategory) return true;
    return m.category === filters.materialCategory;
  });

  // Selected items (memoized)
  const selectedItems = useMemo(() => filteredItems.filter(i => selectedIds.has(i.id)), [filteredItems, selectedIds]);

  // Only in_stock items among selected
  const selectedInStockItems = useMemo(() => selectedItems.filter(i => i.status === 'in_stock'), [selectedItems]);
  const selectedReturnedItems = useMemo(() => selectedItems.filter(i => i.status === 'returned'), [selectedItems]);

  // Refresh key for manual reload triggers
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  // Reset to first page when server-side query conditions change.
  useEffect(() => {
    setPagination(prev => prev.page === 1 ? prev : { ...prev, page: 1 });
  }, [activeStatuses, filters.materialId, filters.typeId, filters.tagId, filters.keyword, searchField, filters.counter, filters.batchId, filters.has_tags, sortBy, sortOrder]);

  // Auto-load items on mount and when deps change
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (process.env.NODE_ENV !== 'production') console.log('[InventoryTab] loadData START, page=', pagination.page, 'size=', pagination.size, 'refreshKey=', refreshKey);
      setLoading(true);
      try {
        const params: ItemsQueryParams = { page: pagination.page, size: pagination.size };
        if (filters.materialId) params.material_id = filters.materialId;
        if (filters.typeId) params.type_id = filters.typeId;
        if (filters.tagId) params.tag_id = filters.tagId;
        if (activeStatuses.size === 1) params.status = Array.from(activeStatuses)[0];
        if (filters.keyword) {
          params.keyword = filters.keyword;
          if (searchField !== 'all') params.search_field = searchField;
        }
        if (filters.counter) params.counter = filters.counter;
        if (filters.batchId) params.batch_id = filters.batchId;
        if (filters.has_tags) params.has_tags = filters.has_tags;
        params.sort_by = sortBy;
        params.sort_order = sortOrder;
        const data = await itemsApi.getItems(params) as unknown as Record<string, unknown>;
        if (process.env.NODE_ENV !== 'production') console.log('[InventoryTab] loadData OK, items=', (data as Record<string, unknown>).items);
        if (!cancelled) {
          setItems((data.items || []) as ItemSummary[]);
          setPagination((data.pagination || { total: 0, page: 1, size: 20, pages: 0 }) as { total: number; page: number; size: number; pages: number });
          setSummary((data.summary || {
            statusCounts: { in_stock: 0, sold: 0, returned: 0 },
            totalCost: 0,
            totalMarketValue: 0,
          }) as typeof summary);
        }
      } catch (e) { console.error('[InventoryTab] loadData FAILED:', e); if (!cancelled) toast.error('加载库存失败'); } finally { if (process.env.NODE_ENV !== 'production') console.log('[InventoryTab] loadData FINALLY, cancelled=', cancelled); if (!cancelled) setLoading(false); }
    };
    loadData();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.size, refreshKey, activeStatuses, filters.materialId, filters.typeId, filters.tagId, filters.keyword, searchField, filters.counter, filters.batchId, filters.has_tags, sortBy, sortOrder]);

  // Clear selection when page/filters change
  useEffect(() => { setSelectedIds(new Set()); }, [pagination.page, filters.materialId, filters.typeId, filters.tagId, filters.keyword, searchField, filters.counter, filters.batchId, filters.status, activeStatuses, sortBy, sortOrder]);

  // Selection handlers
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ========== Image Lightbox Gallery ==========
  const galleryImages = useMemo(() => {
    return sortedItems
      .filter((item: ItemSummary) => item.coverImage)
      .map((item: ItemSummary, idx: number) => ({ id: idx, url: item.coverImage, isCover: true, itemId: item.id, skuCode: item.skuCode }));
  }, [sortedItems]);

  function openLightbox(itemId: number) {
    const idx = galleryImages.findIndex((img: { itemId: number }) => img.itemId === itemId);
    if (idx >= 0) {
      setLightboxImages(galleryImages.map(img => ({ ...img, url: img.url ?? '' })));
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  }

  async function handleSale() {
    if (!saleDialog.item) return;
    if (!saleForm.actualPrice || isNaN(saleForm.actualPrice) || saleForm.actualPrice <= 0) {
      toast.error('请输入有效的成交价');
      return;
    }
    if (!saleForm.saleDate) {
      toast.error('请选择销售日期');
      return;
    }
    try {
      const salePayload: CreateSaleBody = { itemId: saleDialog.item.id, actualPrice: saleForm.actualPrice, channel: saleForm.channel, saleDate: saleForm.saleDate, note: saleForm.note };
      if (saleForm.customerId) salePayload.customerId = Number(saleForm.customerId);
      await salesApi.createSale(salePayload);
      toast.success('出库成功！');
      setSaleDialog({ open: false, item: null });
      refresh();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '出库失败'); }
  }

  async function handleDelete(id: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setDeleteConfirmItem(item);
  }

  async function confirmDelete() {
    if (!deleteConfirmItem) return;
    try {
      await itemsApi.deleteItem(deleteConfirmItem.id);
      toast.success('删除成功');
      setDeleteConfirmItem(null);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  }

  async function handleReturn() {
    if (!returnConfirmItem.item) return;
    try {
      const item = returnConfirmItem.item;
      // 优先通过销售退货 API 处理（含 SaleReturn 记录 + 退款审计）
      // 如果货品有最近的销售记录，走正规退货流程
      try {
        const saleResult = await salesApi.getSales({ itemId: item.id, page: 1, size: 1 });
        const lastSale = saleResult?.items?.[0];
        if (lastSale) {
          await salesApi.returnSale({
            saleId: lastSale.id,
            refundAmount: lastSale.actualPrice,
            returnReason: '库存页直接退货',
            returnDate: new Date().toISOString().slice(0, 10),
          });
          toast.success('退货成功！已记录退款');
          setReturnConfirmItem({ open: false, item: null });
          refresh();
          return;
        }
      } catch {
        // 无关联销售记录，降级为直接状态变更（兼容旧数据）
      }
      // 降级：无销售记录时直接更新状态
      await itemsApi.updateItem(item.id, { status: 'returned' });
      toast.success('退货成功！');
      setReturnConfirmItem({ open: false, item: null });
      refresh();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '退货失败'); }
  }

  async function handleRestoreToStock(itemId?: number) {
    try {
      if (itemId != null) {
        const target = sortedItems.find(i => i.id === itemId);
        if (!target || target.status !== 'returned') return;
        await itemsApi.updateItem(itemId, { status: 'in_stock' });
        toast.success(`货品 ${target.skuCode} 已恢复在库`);
        refresh();
        return;
      }

      if (selectedReturnedItems.length === 0) {
        toast.error('仅支持恢复已退货品');
        return;
      }
      setBatchLoading(true);
      setBatchProgress({ current: 0, total: selectedReturnedItems.length });

      const results = await Promise.allSettled(
        selectedReturnedItems.map(item => itemsApi.updateItem(item.id, { status: 'in_stock' }))
      );
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      setBatchProgress({ current: selectedReturnedItems.length, total: selectedReturnedItems.length });

      if (failCount === 0) toast.success(`批量恢复在库成功！共 ${successCount} 件`);
      else toast.warning(`批量恢复完成：成功 ${successCount} 件，失败 ${failCount} 件`);
      setBatchRestoreOpen(false);
      clearSelection();
      refresh();
    } finally {
      setBatchLoading(false);
      setBatchProgress(null);
    }
  }

  async function handleScanSku() {
    if (!scanSku.trim()) return;
    setScanLoading(true);
    try {
      const item = await itemsApi.lookupBySku(scanSku.trim());
      if (item.status === 'in_stock') {
        setSaleDialog({ open: true, item: item as unknown as ItemSummary });
        setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' });
        setScanSku('');
      } else {
        toast.error(`货品 ${item.skuCode} 当前状态为「${item.status === 'sold' ? '已售' : item.status === 'returned' ? '已退' : item.status}」，无法出库`);
      }
    } catch (e) { console.error('[InventoryTab]', e);
      toast.error('未找到该SKU对应的货品');
    } finally {
      setScanLoading(false);
    }
  }

  async function handleBarcodeScan(code: string) {
    setShowScanner(false);
    setScanSku(''); // 清空输入框（扫描枪字符可能已注入 input）
    setScanLoading(true);
    try {
      const item = await itemsApi.lookupBySku(code.trim());
      if (item.status === 'in_stock') {
        setSaleDialog({ open: true, item: item as unknown as ItemSummary });
        setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' });
      } else {
        toast.error(`货品 ${item.skuCode} 当前状态为「${item.status === 'sold' ? '已售' : item.status === 'returned' ? '已退' : item.status}」，无法出库`);
      }
    } catch (e) { console.error('[InventoryTab]', e);
      toast.error(`未找到条码「${code}」对应的货品`);
    } finally {
      setScanLoading(false);
    }
  }

  // 全局扫描枪监听（HID 键盘模拟器模式）：USB/蓝牙扫描枪扫码后自动触发出库
  // ScanPhotoMode 打开时禁用，避免 HID 扫描枪事件冲突触发错误流程
  useBarcodeScanner({ onComplete: handleBarcodeScan, enabled: !showScanPhoto });

  function toggleSortOrder() {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  }

  // ========== Batch Operations ==========

  async function handleBatchSell() {
    if (selectedInStockItems.length === 0) {
      toast.error('没有可出库的在库货品');
      return;
    }
    setBatchLoading(true);
    setBatchProgress({ current: 0, total: selectedInStockItems.length });
    const selectedCustomer = customers.find((c: Customer) => String(c.id) === batchSellForm.customerId);
    const customerName = selectedCustomer?.name || '';

    const results = await Promise.allSettled(
      selectedInStockItems.map(item => {
        const price = batchSellForm.useCurrentPrice
          ? item.sellingPrice
          : (batchSellPrices[item.id] ?? item.sellingPrice);
        return salesApi.createSale({
          itemId: item.id,
          actualPrice: price,
          channel: batchSellForm.channel,
          saleDate: batchSellForm.saleDate,
          customerId: batchSellForm.customerId ? Number(batchSellForm.customerId) : undefined,
          note: `批量出库${customerName ? ` - ${customerName}` : ''}`,
        });
      })
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    setBatchProgress({ current: selectedInStockItems.length, total: selectedInStockItems.length });
    setBatchLoading(false);
    setBatchProgress(null);
    setBatchSellOpen(false);
    setBatchSellPrices({});
    setBatchSellForm(f => ({ ...f, customerId: '' }));
    clearSelection();
    refresh();
    if (failCount === 0) {
      toast.success(`批量出库成功！共 ${successCount} 件`);
    } else {
      toast.warning(`批量出库完成：成功 ${successCount} 件，失败 ${failCount} 件`);
    }
  }

  async function handleBatchDelete() {
    setBatchLoading(true);
    setBatchProgress({ current: 0, total: selectedItems.length });

    const results = await Promise.allSettled(
      selectedItems.map(item => itemsApi.deleteItem(item.id, batchDeleteHard))
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    setBatchProgress({ current: selectedItems.length, total: selectedItems.length });
    setBatchLoading(false);
    setBatchProgress(null);
    setBatchDeleteOpen(false);
    setBatchDeleteHard(false);
    clearSelection();
    refresh();
    if (failCount === 0) {
      toast.success(`批量删除成功！共 ${successCount} 件${batchDeleteHard ? '（彻底删除）' : '（标记删除）'}`);
    } else {
      toast.warning(`批量删除完成：成功 ${successCount} 件，失败 ${failCount} 件`);
    }
  }

  async function handleBatchPriceAdjust() {
    const adjustValue = parseFloat(batchPriceForm.value);
    if (isNaN(adjustValue) || adjustValue < 0) {
      toast.error('请输入有效的调整值（正数）');
      return;
    }
    setBatchLoading(true);
    try {
      const result = await itemsApiEnhanced.batchPriceAdjust({
        ids: Array.from(selectedIds).map(String),
        adjustmentType: batchPriceForm.mode as 'percentage' | 'fixed',
        value: adjustValue,
        direction: batchPriceForm.direction,
      });
      setBatchLoading(false);
      setBatchProgress(null);
      setBatchPriceOpen(false);
      setBatchPriceForm({ mode: 'percent', target: 'sellingPrice', value: '', direction: 'increase' });
      clearSelection();
      refresh();
      if (result.errors && result.errors.length > 0) {
        toast.warning(`批量调价完成：成功 ${result.success} 件，${result.errors.length} 件失败`);
      } else {
        toast.success(`批量调价成功！共 ${result.success} 件`);
      }
    } catch (e: unknown) {
      setBatchLoading(false);
      toast.error(e instanceof Error ? e.message : '批量调价失败');
    }
  }

  /** 导出标签打印数据（德佟 P2 微打 App 兼容 CSV） */
  async function handleBatchLabelExport() {
    if (selectedIds.size === 0) return;
    try {
      await exportApi.exportLabels(Array.from(selectedIds));
      toast.success(`已导出 ${selectedIds.size} 件货品标签数据`);
    } catch (e: unknown) {
      toast.error('导出失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  }

  /** 导出全部货品标签数据（德佟 P2 微打 App 兼容 CSV） */
  async function handleExportAllLabels() {
    try {
      await exportApi.exportAllLabels();
      toast.success('已导出全部货品标签数据');
    } catch (e: unknown) {
      toast.error('导出失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  }

  /** 导出全量库存表格（所有字段） */
  async function handleExportFullInventory() {
    try {
      await exportApi.exportFullInventory();
      toast.success('已导出全量库存表格');
    } catch (e: unknown) {
      toast.error('导出失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  }

  async function handleBatchCounter() {
    const counter = parseInt(batchCounterForm.counter);
    if (isNaN(counter)) {
      toast.error('请输入有效的柜台号');
      return;
    }
    setBatchLoading(true);
    setBatchProgress({ current: 0, total: selectedItems.length });

    const results = await Promise.allSettled(
      selectedItems.map(item => itemsApi.updateItem(item.id, { counter }))
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    setBatchProgress({ current: selectedItems.length, total: selectedItems.length });
    setBatchLoading(false);
    setBatchProgress(null);
    setBatchCounterOpen(false);
    setBatchCounterForm({ counter: '' });
    clearSelection();
    refresh();
    if (failCount === 0) {
      toast.success(`批量修改柜台成功！共 ${successCount} 件`);
    } else {
      toast.warning(`批量修改柜台完成：成功 ${successCount} 件，失败 ${failCount} 件`);
    }
  }

  // Price preview for batch adjust
  const pricePreview = useMemo(() => {
    const adjustValue = parseFloat(batchPriceForm.value);
    if (isNaN(adjustValue)) return [];
    return selectedItems.slice(0, 10).map(item => {
      const field = batchPriceForm.target === 'sellingPrice' ? 'sellingPrice' : 'minimumPrice';
      const oldPrice = item[field] || 0;
      let newPrice: number;
      if (batchPriceForm.mode === 'percent') {
        newPrice = batchPriceForm.direction === 'increase'
          ? Math.round(oldPrice * (1 + adjustValue / 100))
          : Math.round(oldPrice * (1 - adjustValue / 100));
      } else {
        newPrice = batchPriceForm.direction === 'increase'
          ? Math.round(oldPrice + adjustValue)
          : Math.round(oldPrice - adjustValue);
      }
      newPrice = Math.max(0, newPrice);
      return { id: item.id, name: item.name || item.skuCode, sku: item.skuCode, oldPrice, newPrice };
    });
  }, [selectedItems, batchPriceForm]);

  // SortableHead 已抽离为独立组件，此辅助函数保留 sortBy+sortOrder 联动
  const handleSortChange = (field: string) => { setSortBy(field); setSortOrder('desc'); };

  if (loading && items.length === 0) return <LoadingSkeleton />;

  const totalCost = summary.totalCost || 0;
  const totalMarketValue = summary.totalMarketValue || 0;

  const sortFieldLabels: Record<string, string> = {
    created_at: '入库时间',
    selling_price: '售价',
    cost_price: '成本',
    purchase_date: '采购日期',
    sku_code: 'SKU编号',
    name: '名称',
  };

  const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  return (
    <div className="space-y-6">
      <InventoryScanSellSection
        scanSku={scanSku}
        onScanSkuChange={setScanSku}
        scanLoading={scanLoading}
        onScanSell={handleScanSku}
        onOpenScanner={openScanner}
        totalItems={pagination.total}
        inStockCount={statusCounts.in_stock}
        totalCost={totalCost}
        totalMarketValue={totalMarketValue}
      />

      <InventoryFilterBar
        activeStatuses={activeStatuses}
        onToggleStatusFilter={toggleStatusFilter}
        statusCounts={statusCounts}
        filters={filters}
        onFiltersChange={(fn) => setFilters(fn as unknown as (prev: typeof filters) => typeof filters)}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        materials={materials}
        filteredMaterials={filteredMaterials}
        types={types}
        tags={tags}
        onLoadTypes={loadTypes}
        onLoadTags={loadTags}
        allBatches={allBatches}
        allCounters={allCounters}
        showMoreFilters={showMoreFilters}
        onToggleMoreFilters={() => setShowMoreFilters(!showMoreFilters)}
        onSearch={() => { setPagination(p => ({ ...p, page: 1 })); refresh(); }}
        onResetFilters={() => { setFilters({ materialCategory: '', materialId: '', typeId: '', tagId: '', status: '', keyword: '', counter: '', batchId: '', has_tags: '', minPrice: '', maxPrice: '', purchaseStartDate: '', purchaseEndDate: '' }); setActiveStatuses(new Set(['in_stock'])); }}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderToggle={toggleSortOrder}
        sortFieldLabels={sortFieldLabels}
        onCreateItem={() => setShowCreate(true)}
        onExportAllLabels={handleExportAllLabels}
        onExportFullInventory={handleExportFullInventory}
        isExportDisabled={sortedItems.length === 0}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
        onToggleSelectAll={toggleSelectAll}
        onClearFilter={(key: string) => setFilters(f => ({ ...f, [key]: '' }))}
      />

      {/* 数据补全快捷筛选 */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <Button
          size="sm"
          variant={filters.has_tags === 'false' ? 'default' : 'outline'}
          className={`h-7 text-xs rounded-full ${filters.has_tags === 'false' ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : ''}`}
          onClick={() => {
            setFilters(f => ({
              ...f,
              has_tags: f.has_tags === 'false' ? '' : 'false',
            }));
          }}
        >
          <AlertCircle className="h-3 w-3 mr-1" />
          待补全（缺标签）
        </Button>
      </div>

      {/* 快速录货入口 — 移动端显示 */}
      <div className="flex md:hidden items-center gap-2 px-1">
        <Button
          onClick={() => setShowFactoryMode(true)}
          variant="default"
          size="sm"
          className="flex-1 h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Camera className="h-4 w-4 mr-1" />
          快速录货
        </Button>
      </div>

      {/* 批量补图 + 扫码拍摄入口 */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <Button
          onClick={() => setShowScanPhoto(true)}
          variant="default"
          size="sm"
          className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Camera className="h-4 w-4 mr-1" />
          扫码拍摄
        </Button>
        <Button
          onClick={() => setShowBatchPhoto(true)}
          variant="outline"
          size="sm"
          className="h-9 text-sm"
        >
          <Camera className="h-4 w-4 mr-1" />
          批量补图
        </Button>
      </div>

      {/* Items Table */}
      {sortedItems.length === 0 ? (
        <EmptyState icon={Package} title="暂无货品" desc="还没有入库任何货品，点击「新增入库」开始" />
      ) : (
        <>
          <InventoryDesktopTable
            sortedItems={sortedItems.map(i => ({ ...i, coverImage: i.coverImage ?? undefined })) as any}
            selectedIds={selectedIds}
            isAllSelected={isAllSelected}
            isSomeSelected={isSomeSelected}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onSortOrderToggle={toggleSortOrder}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onOpenLightbox={openLightbox}
            onSelectItem={(id) => setSelectedItemId(id)}
            onShowDetailDialog={setDetailItemId}
            onShowEditDialog={setEditItemId}
            onShowSaleDialog={(item: ItemSummary) => { setSaleDialog({ open: true, item }); setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' }); }}
            onShowReturnConfirm={(item: ItemSummary) => setReturnConfirmItem({ open: true, item })}
            onRestoreToStock={handleRestoreToStock}
            onDeleteItem={handleDelete}
            onNavigateToBatches={() => setActiveTab('batches')}
            getTagColor={getTagColor}
          />

        <InventoryMobileCards
          sortedItems={sortedItems.map(i => ({ ...i, coverImage: i.coverImage ?? undefined })) as any}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpenLightbox={openLightbox}
          onSelectItem={(id) => setSelectedItemId(id)}
          onShowDetailDialog={setDetailItemId}
          onShowEditDialog={setEditItemId}
          onShowSaleDialog={(item: ItemSummary) => { setSaleDialog({ open: true, item }); setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' }); }}
          onShowReturnConfirm={(item: ItemSummary) => setReturnConfirmItem({ open: true, item })}
          onRestoreToStock={handleRestoreToStock}
          onDeleteItem={handleDelete}
          onNavigateToBatches={() => setActiveTab('batches')}
          onPrintLabel={(item: ItemSummary) => setPrintLabelItem(item)}
          getTagColor={getTagColor}
        />
        </>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>上一页</Button>
          <span className="text-sm text-muted-foreground">{pagination.page} / {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>下一页</Button>
        </div>
      )}

      <InventoryBatchOpsBar
        selectedCount={selectedIds.size}
        inStockCount={selectedInStockItems.length}
        returnedCount={selectedReturnedItems.length}
        onBatchSell={() => setBatchSellOpen(true)}
        onBatchRestore={() => setBatchRestoreOpen(true)}
        onBatchDelete={() => setBatchDeleteOpen(true)}
        onBatchPriceAdjust={() => setBatchPriceOpen(true)}
        onBatchComplete={() => setBatchCompleteOpen(true)}
        onBatchLabelPrint={() => setBatchLabelPrintOpen(true)}
        onBatchLabelExport={handleBatchLabelExport}
        onClearSelection={clearSelection}
      />

      {/* Sale Dialog */}
      <Dialog open={saleDialog.open} onOpenChange={open => setSaleDialog({ open, item: open ? saleDialog.item : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>销售出库</DialogTitle><DialogDescription>货品: {saleDialog.item?.skuCode} - {saleDialog.item?.name || saleDialog.item?.skuCode}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>成交价 <span className="text-red-500">*</span></Label><Input type="number" min="0" step="0.01" value={saleForm.actualPrice || ''} onChange={e => setSaleForm(f => ({ ...f, actualPrice: e.target.value ? parseFloat(e.target.value) : 0 }))} placeholder="必填" /></div>
            <div className="space-y-1"><Label>客户</Label>
              <CustomerSearchSelect
                value={saleForm.customerId}
                onChange={id => setSaleForm(f => ({ ...f, customerId: id }))}
                placeholder="搜索客户（姓名/手机号/微信）"
              />
            </div>
            <div className="space-y-1"><Label>销售渠道 <span className="text-red-500">*</span></Label>
              <Select value={saleForm.channel} onValueChange={v => setSaleForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="store">门店</SelectItem><SelectItem value="wechat">微信</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>销售日期 <span className="text-red-500">*</span></Label><Input type="date" value={saleForm.saleDate} onChange={e => setSaleForm(f => ({ ...f, saleDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={saleForm.note} onChange={e => setSaleForm(f => ({ ...f, note: e.target.value }))} placeholder="可选" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDialog({ open: false, item: null })}>取消</Button>
            <Button onClick={handleSale} className="bg-emerald-600 hover:bg-emerald-700">确认出库</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Sell Dialog */}
      <Dialog open={batchSellOpen} onOpenChange={setBatchSellOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              批量出库
            </DialogTitle>
            <DialogDescription>将选中的在库货品批量出库销售</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Progress indicator */}
            {batchProgress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>处理进度</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                </div>
              </div>
            )}
            {/* Selected items list */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">选中货品（{selectedInStockItems.length} 件可出库）</Label>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {selectedItems.map(item => (
                    <div key={item.id} className={`flex items-center justify-between text-sm py-1 px-2 rounded ${item.status === 'in_stock' ? 'bg-muted/50' : 'bg-muted/20 opacity-50'}`}>
                      <span className="font-mono text-xs">{item.skuCode}</span>
                      <span className="truncate mx-2 text-xs">{item.name || item.skuCode}</span>
                      {!batchSellForm.useCurrentPrice && item.status === 'in_stock' ? (
                        <Input
                          type="number"
                          className="h-7 w-24 text-xs text-right"
                          value={batchSellPrices[item.id] ?? item.sellingPrice}
                          onChange={e => setBatchSellPrices(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                          disabled={batchLoading}
                        />
                      ) : (
                        <span className="font-medium text-emerald-600 whitespace-nowrap">{formatPrice(item.sellingPrice)}</span>
                      )}
                      {item.status !== 'in_stock' && <span className="text-xs text-red-500 ml-1">(非在库)</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {/* Common fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>客户</Label>
                <CustomerSearchSelect
                  value={batchSellForm.customerId}
                  onChange={id => setBatchSellForm(f => ({ ...f, customerId: id }))}
                  placeholder="搜索客户（姓名/手机号/微信）"
                />
              </div>
              <div className="space-y-1">
                <Label>销售渠道</Label>
                <Select value={batchSellForm.channel} onValueChange={v => setBatchSellForm(f => ({ ...f, channel: v }))} disabled={batchLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="store">门店</SelectItem><SelectItem value="wechat">微信</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>销售日期</Label>
              <Input type="date" value={batchSellForm.saleDate} onChange={e => setBatchSellForm(f => ({ ...f, saleDate: e.target.value }))} disabled={batchLoading} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="useCurrentPrice"
                checked={batchSellForm.useCurrentPrice}
                onCheckedChange={(checked) => {
                  setBatchSellForm(f => ({ ...f, useCurrentPrice: !!checked }));
                  if (checked) setBatchSellPrices({});
                }}
                disabled={batchLoading}
              />
              <Label htmlFor="useCurrentPrice" className="text-sm cursor-pointer">使用当前售价作为成交价</Label>
            </div>
            {selectedInStockItems.length > 0 && (() => {
              const totalValue = selectedInStockItems.reduce((sum, i) => {
                if (batchSellForm.useCurrentPrice) return sum + (i.sellingPrice || 0);
                return sum + (batchSellPrices[i.id] ?? (i.sellingPrice || 0));
              }, 0);
              const selectedCustomer = customers.find((c: Customer) => String(c.id) === batchSellForm.customerId);
              return (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    {selectedInStockItems.length} 件货品，总售价 {formatPrice(totalValue)}
                    {selectedCustomer && <span className="ml-1">→ 客户：{selectedCustomer.name}</span>}
                  </p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchSellOpen(false)} disabled={batchLoading}>取消</Button>
            <Button onClick={handleBatchSell} disabled={batchLoading || selectedInStockItems.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
              {batchLoading ? `处理中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}` : `确认出库 ${selectedInStockItems.length} 件`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Restore In-Stock */}
      <AlertDialog open={batchRestoreOpen} onOpenChange={setBatchRestoreOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              批量恢复在库
            </AlertDialogTitle>
            <AlertDialogDescription>
              即将恢复 <span className="text-orange-600 font-bold">{selectedReturnedItems.length}</span> 件已退货品为在库状态。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {batchProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>恢复进度</span>
                <span>{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBatchRestoreOpen(false)} disabled={batchLoading}>取消</Button>
            <Button onClick={() => handleRestoreToStock()} disabled={batchLoading || selectedReturnedItems.length === 0} className="bg-orange-600 hover:bg-orange-700">
              {batchLoading ? `处理中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}` : `确认恢复 ${selectedReturnedItems.length} 件`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              批量删除确认
            </AlertDialogTitle>
            <AlertDialogDescription>
              即将删除 <span className="text-red-600 font-bold">{selectedIds.size}</span> 件货品，请确认操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Progress indicator */}
          {batchProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>删除进度</span>
                <span>{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {/* Scrollable list of items */}
          <ScrollArea className="max-h-48">
            <div className="space-y-1 py-2">
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-red-50 dark:bg-red-950/20">
                  <span className="font-mono text-xs">{item.skuCode}</span>
                  <span className="truncate mx-2 text-xs">{item.name || item.skuCode}</span>
                  <span className="font-medium whitespace-nowrap">{formatPrice(item.sellingPrice)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          {/* Soft/Hard delete toggle */}
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              id="hardDelete"
              checked={batchDeleteHard}
              onCheckedChange={(checked) => setBatchDeleteHard(!!checked)}
              disabled={batchLoading}
            />
            <Label htmlFor="hardDelete" className="text-sm cursor-pointer text-red-600 font-medium">彻底删除</Label>
            <span className="text-xs text-muted-foreground">（不勾选则为仅标记删除，可恢复）</span>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteOpen(false)} disabled={batchLoading}>取消</Button>
            <Button onClick={handleBatchDelete} disabled={batchLoading} className="bg-red-600 hover:bg-red-700">
              {batchLoading ? `删除中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}` : `确认删除 ${selectedIds.size} 件`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InventoryBatchPriceDialog
        open={batchPriceOpen}
        onOpenChange={setBatchPriceOpen}
        selectedCount={selectedIds.size}
        priceForm={batchPriceForm}
        onPriceFormChange={setBatchPriceForm}
        loading={batchLoading}
        progress={batchProgress}
        pricePreview={pricePreview}
        onConfirm={handleBatchPriceAdjust}
        onCancel={() => { setBatchPriceOpen(false); setBatchPriceForm({ mode: 'percent', target: 'sellingPrice', value: '', direction: 'increase' }); }}
      />

      {/* Batch Complete Dialog */}
      <InventoryBatchCompleteDialog
        open={batchCompleteOpen}
        onOpenChange={setBatchCompleteOpen}
        onSuccess={() => { clearSelection(); refresh(); }}
        selectedItemIds={Array.from(selectedIds)}
      />

      {/* Batch Change Counter Dialog */}
      <Dialog open={batchCounterOpen} onOpenChange={setBatchCounterOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-sky-600" />
              批量修改柜台
            </DialogTitle>
            <DialogDescription>将选中的 {selectedIds.size} 件货品统一修改到指定柜台</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Progress indicator */}
            {batchProgress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>修改进度</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>新柜台号</Label>
              <Input
                type="number"
                placeholder="输入柜台号"
                value={batchCounterForm.counter}
                onChange={e => setBatchCounterForm(f => ({ ...f, counter: e.target.value }))}
                disabled={batchLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBatchCounterOpen(false); setBatchCounterForm({ counter: '' }); }} disabled={batchLoading}>取消</Button>
            <Button onClick={handleBatchCounter} disabled={batchLoading || !batchCounterForm.counter} className="bg-sky-600 hover:bg-sky-700 text-white">
              {batchLoading ? `修改中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}` : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Label Print Dialog */}
      <Dialog open={batchLabelPrintOpen} onOpenChange={setBatchLabelPrintOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              批量标签打印
            </DialogTitle>
            <DialogDescription>预览并打印选中货品的标签（共 {selectedItems.length} 件）</DialogDescription>
          </DialogHeader>
          <div id="batch-label-print-area" className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
            {selectedItems.map(item => (
              <div key={item.id} className="batch-label-card border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-lg p-3 bg-white dark:bg-gray-950 print:border-solid print:border-black print:dark:bg-white print:dark:text-black">
                <div className="text-center space-y-1.5">
                  <p className="font-mono text-xs font-bold tracking-widest">{item.skuCode || ''}</p>
                  <p className="text-sm font-medium truncate">{item.name || item.skuCode}</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatPrice(item.sellingPrice)}</p>
                  {item.counter != null && (
                    <p className="text-xs text-muted-foreground print:text-black">柜台: {item.counter}号</p>
                  )}
                  {item.materialName && (
                    <p className="text-xs text-muted-foreground print:text-black">{item.materialName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchLabelPrintOpen(false)}>取消</Button>
            <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">
              <Printer className="h-4 w-4 mr-1" />打印
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox Gallery */}
      <ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

      {/* Item Create Dialog */}
      <ItemCreateDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={refresh} />

      {/* Factory Mode Wrapper（快速录货） */}
      {showFactoryMode && (
        <FactoryModeWrapper
          onClose={() => { setShowFactoryMode(false); refresh(); }}
        />
      )}

      {/* Scan Photo Mode（扫码拍摄） */}
      {showScanPhoto && (
        <ScanPhotoMode
          onClose={() => { setShowScanPhoto(false); refresh(); }}
          api={{
            lookupBySku: itemsApi.lookupBySku,
            scanPhoto: itemsApi.scanPhoto,
          }}
        />
      )}

      {/* Batch Photo Mode（批量补图） */}
      {showBatchPhoto && (
        <BatchPhotoMode
          onClose={() => { setShowBatchPhoto(false); refresh(); }}
        />
      )}

      {/* Item Detail Dialog */}
      <ItemDetailDialog itemId={detailItemId} open={detailItemId !== null} onOpenChange={open => { if (!open) setDetailItemId(null); }} />

      {/* Item Edit Dialog */}
      <ItemEditDialog itemId={editItemId} open={editItemId !== null} onOpenChange={open => { if (!open) setEditItemId(null); }} onSuccess={refresh} />

      {/* Return Confirmation Dialog */}
      <Dialog open={returnConfirmItem.open} onOpenChange={open => setReturnConfirmItem({ open, item: open ? returnConfirmItem.item : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认退货</DialogTitle>
            <DialogDescription>确定将此货品标记为退货？</DialogDescription>
          </DialogHeader>
          {returnConfirmItem.item && (
            <div className="py-2">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{returnConfirmItem.item.skuCode}</span></p>
                <p><span className="text-muted-foreground">名称:</span> {returnConfirmItem.item.name || returnConfirmItem.item.skuCode}</p>
                <p><span className="text-muted-foreground">售价:</span> <span className="font-medium text-emerald-600">{formatPrice(returnConfirmItem.item.sellingPrice)}</span></p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnConfirmItem({ open: false, item: null })}>取消</Button>
            <Button onClick={handleReturn} className="bg-orange-600 hover:bg-orange-700">确认退货</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmItem !== null}
        onOpenChange={open => { if (!open) setDeleteConfirmItem(null); }}
        title="确认删除"
        description={deleteConfirmItem
          ? `此操作不可撤销，确定要删除货品「${deleteConfirmItem.name || deleteConfirmItem.skuCode}」(${deleteConfirmItem.skuCode})吗？`
          : ''}
        confirmText="确认删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Label Print Dialog */}
      <LabelPrintDialog item={printLabelItem as unknown as LabelItem} open={printLabelItem !== null} onOpenChange={open => { if (!open) setPrintLabelItem(null); }} />

      {/* Barcode Scanner Dialog - dynamically imported to avoid loading html5-qrcode at tab load */}
      {showScanner && scannerComponent && (() => {
        const ScannerComponent = scannerComponent as React.ComponentType<{ open: boolean; onClose: () => void; onScan: (code: string) => void }>;
        return <ScannerComponent open={showScanner} onClose={() => setShowScanner(false)} onScan={handleBarcodeScan} />;
      })()}

      {/* ===== Slide-in Detail Panel ===== */}
      <InventoryItemSlidePanel
        selectedItemId={selectedItemId}
        sortedItems={sortedItems}
        onClose={() => setSelectedItemId(null)}
        onEdit={(id: number) => { setSelectedItemId(null); setEditItemId(id); }}
        onQuickSell={(item: ItemSummary) => { setSelectedItemId(null); setSaleDialog({ open: true, item }); setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' }); }}
        onRestoreToStock={handleRestoreToStock}
        getTagColor={getTagColor}
      />
    </div>
  );
}

export default InventoryTab;
