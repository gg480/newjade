'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { formatPrice, StatusBadge, EmptyState, LoadingSkeleton } from './shared';
import PromotionCreateDialog from './promotion-create-dialog';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  CalendarDays, Tag, Target, MoreHorizontal, Plus, Search, Eye,
  Pencil, Trash2, Play, Pause, X, ChevronDown, ChevronUp, SlidersHorizontal,
  Clock, DollarSign, BarChart3,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription } from '@/components/ui/alert-dialog';

// API 函数
async function getPromotions(params: any) {
  const url = new URL('/api/promotions', window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });
  const response = await fetch(url);
  const data = await response.json();
  if (data.code !== 0) throw new Error(data.message || '获取促销活动失败');
  return data.data;
}

async function createPromotion(data: any) {
  const response = await fetch('/api/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (result.code !== 0) throw new Error(result.message || '创建促销活动失败');
  return result.data;
}

async function updatePromotion(id: number, data: any) {
  const response = await fetch(`/api/promotions?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (result.code !== 0) throw new Error(result.message || '更新促销活动失败');
  return result.data;
}

async function deletePromotion(id: number) {
  const response = await fetch(`/api/promotions?id=${id}`, {
    method: 'DELETE',
  });
  const result = await response.json();
  if (result.code !== 0) throw new Error(result.message || '删除促销活动失败');
  return result.data;
}

async function getPromotionItems(promotionId: number) {
  const response = await fetch(`/api/promotions/${promotionId}/items`);
  const data = await response.json();
  if (data.code !== 0) throw new Error(data.message || '获取促销商品失败');
  return data.data;
}

async function addPromotionItems(promotionId: number, itemIds: number[]) {
  const response = await fetch(`/api/promotions/${promotionId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemIds }),
  });
  const result = await response.json();
  if (result.code !== 0) throw new Error(result.message || '添加促销商品失败');
  return result.data;
}

async function removePromotionItems(promotionId: number, itemIds: number[]) {
  const response = await fetch(`/api/promotions/${promotionId}/items`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemIds }),
  });
  const result = await response.json();
  if (result.code !== 0) throw new Error(result.message || '移除促销商品失败');
  return result.data;
}

async function forecastPromotionEffect(promotionId: number) {
  const response = await fetch(`/api/promotions/${promotionId}/forecast`);
  const data = await response.json();
  if (data.code !== 0) throw new Error(data.message || '预测促销效果失败');
  return data.data;
}

// 促销状态映射
const STATUS_MAP: Record<string, { label: string; class: string }> = {
  draft: { label: '草稿', class: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  active: { label: '进行中', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  paused: { label: '已暂停', class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  ended: { label: '已结束', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

// 促销类型映射
const TYPE_MAP: Record<string, string> = {
  discount: '折扣',
  '满减': '满减',
  '赠品': '赠品',
  '套餐': '套餐',
};

// 促销管理页面组件
function PromotionsTab() {
  const { setActiveTab } = useAppStore();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', type: '', keyword: '' });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 对话框状态
  const [showCreate, setShowCreate] = useState(false);
  const [editPromotion, setEditPromotion] = useState<any>(null);
  const [deleteConfirmPromotion, setDeleteConfirmPromotion] = useState<any>(null);
  const [detailPromotion, setDetailPromotion] = useState<any>(null);
  const [promotionItems, setPromotionItems] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<any>(null);
  const [showForecast, setShowForecast] = useState(false);

  // 刷新数据
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  // 加载促销活动数据
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const params: any = { page: pagination.page, size: pagination.size };
        if (filters.status) params.status = filters.status;
        if (filters.type) params.type = filters.type;
        if (filters.keyword) params.keyword = filters.keyword;
        
        const data = await getPromotions(params);
        if (!cancelled) {
          setPromotions(data.promotions || []);
          setPagination(data.pagination || { total: 0, page: 1, size: 20, pages: 0 });
        }
      } catch (e: any) {
        console.error('[PromotionsTab] loadData FAILED:', e);
        if (!cancelled) toast.error(e.message || '加载促销活动失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.size, refreshKey, filters.status, filters.type, filters.keyword]);

  // 自动刷新过期的促销活动
  useEffect(() => {
    const checkExpiredPromotions = () => {
      const now = new Date().toISOString().split('T')[0];
      promotions.forEach(promotion => {
        if (promotion.status === 'active' && promotion.endDate < now) {
          handleStatusChange(promotion.id, 'ended');
        }
      });
    };

    // 初始检查
    checkExpiredPromotions();
    
    // 每小时检查一次
    const interval = setInterval(checkExpiredPromotions, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [promotions]);

  // 处理创建促销活动
  async function handleCreatePromotion(data: any) {
    try {
      await createPromotion(data);
      toast.success('创建促销活动成功！');
      setShowCreate(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message || '创建促销活动失败');
    }
  }

  // 处理更新促销活动
  async function handleUpdatePromotion(id: number, data: any) {
    try {
      await updatePromotion(id, data);
      toast.success('更新促销活动成功！');
      setEditPromotion(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || '更新促销活动失败');
    }
  }

  // 处理删除促销活动
  async function handleDeletePromotion() {
    if (!deleteConfirmPromotion) return;
    try {
      await deletePromotion(deleteConfirmPromotion.id);
      toast.success('删除促销活动成功！');
      setDeleteConfirmPromotion(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || '删除促销活动失败');
    }
  }

  // 处理促销活动状态变更
  async function handleStatusChange(id: number, status: string) {
    try {
      await updatePromotion(id, { status });
      toast.success('更新促销活动状态成功！');
      refresh();
    } catch (e: any) {
      toast.error(e.message || '更新促销活动状态失败');
    }
  }

  // 处理查看促销详情
  async function handleViewDetail(promotion: any) {
    try {
      const data = await getPromotionItems(promotion.id);
      setPromotionItems(data.items || []);
      setDetailPromotion(promotion);
    } catch (e: any) {
      toast.error(e.message || '获取促销商品失败');
    }
  }

  // 处理预测促销效果
  async function handleForecast(promotion: any) {
    try {
      const data = await forecastPromotionEffect(promotion.id);
      setForecastData(data);
      setShowForecast(true);
    } catch (e: any) {
      toast.error(e.message || '预测促销效果失败');
    }
  }

  // 排序处理
  function toggleSortOrder() {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  }

  // 排序字段标签
  const sortFieldLabels: Record<string, string> = {
    created_at: '创建时间',
    start_date: '开始日期',
    end_date: '结束日期',
    name: '名称',
  };

  if (loading && promotions.length === 0) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md hover:border-emerald-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><Target className="h-16 w-16 text-emerald-500" /></div>
            <p className="text-sm text-muted-foreground">总促销活动</p>
            <p className="text-2xl font-bold">{pagination.total}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md hover:border-sky-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><Play className="h-16 w-16 text-sky-500" /></div>
            <p className="text-sm text-muted-foreground">进行中</p>
            <p className="text-2xl font-bold text-emerald-600">
              {promotions.filter(p => p.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md hover:border-amber-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><Pause className="h-16 w-16 text-amber-500" /></div>
            <p className="text-sm text-muted-foreground">已暂停</p>
            <p className="text-2xl font-bold">
              {promotions.filter(p => p.status === 'paused').length}
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md hover:border-purple-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><BarChart3 className="h-16 w-16 text-purple-500" /></div>
            <p className="text-sm text-muted-foreground">已结束</p>
            <p className="text-2xl font-bold">
              {promotions.filter(p => p.status === 'ended').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和操作 */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-xs">关键词</Label>
              <Input 
                placeholder="搜索促销名称..." 
                value={filters.keyword} 
                onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))} 
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">状态</Label>
              <Select 
                value={filters.status || 'all'} 
                onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="active">进行中</SelectItem>
                  <SelectItem value="paused">已暂停</SelectItem>
                  <SelectItem value="ended">已结束</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">类型</Label>
              <Select 
                value={filters.type || 'all'} 
                onValueChange={v => setFilters(f => ({ ...f, type: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="discount">折扣</SelectItem>
                  <SelectItem value="满减">满减</SelectItem>
                  <SelectItem value="赠品">赠品</SelectItem>
                  <SelectItem value="套餐">套餐</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button 
                size="sm" 
                onClick={() => {
                  setPagination(p => ({ ...p, page: 1 }));
                  refresh();
                }} 
                className="h-9"
              >
                <Search className="h-3 w-3 mr-1" />
                搜索
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setFilters({ status: '', type: '', keyword: '' });
                }} 
                className="h-9"
              >
                重置
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700 h-9" 
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                新建促销
              </Button>
            </div>
            
            {/* 排序控制 */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">排序</Label>
              <Select value={sortBy} onValueChange={v => setSortBy(v)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sortFieldLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 w-8 p-0" 
                onClick={toggleSortOrder} 
                title={sortOrder === 'desc' ? '降序' : '升序'}
              >
                {sortOrder === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 促销活动表格 */}
      {promotions.length === 0 ? (
        <EmptyState 
          icon={<Target className="h-12 w-12 text-muted-foreground" />}
          title="暂无促销活动"
          description="点击上方「新建促销」按钮创建第一个促销活动"
          action={<Button onClick={() => setShowCreate(true)}>新建促销</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>促销名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>时间范围</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>商品数量</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((promotion, index) => (
                    <TableRow key={promotion.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{promotion.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {TYPE_MAP[promotion.type] || promotion.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{promotion.startDate}</div>
                        <div>至 {promotion.endDate}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_MAP[promotion.status]?.class || 'bg-gray-100 text-gray-800'}>
                          {STATUS_MAP[promotion.status]?.label || promotion.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{promotion.itemCount || 0}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetail(promotion)}>
                              <Eye className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditPromotion(promotion)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleForecast(promotion)}>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              效果预测
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {promotion.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(promotion.id, 'active')}>
                                <Play className="h-4 w-4 mr-2" />
                                激活
                              </DropdownMenuItem>
                            )}
                            {promotion.status === 'active' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(promotion.id, 'paused')}>
                                <Pause className="h-4 w-4 mr-2" />
                                暂停
                              </DropdownMenuItem>
                            )}
                            {(promotion.status === 'active' || promotion.status === 'paused') && (
                              <DropdownMenuItem onClick={() => handleStatusChange(promotion.id, 'ended')}>
                                <X className="h-4 w-4 mr-2" />
                                结束
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setDeleteConfirmPromotion(promotion)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            
            {/* 分页 */}
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                共 {pagination.total} 条记录
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={pagination.page === 1}
                >
                  上一页
                </Button>
                <span className="text-sm">
                  {pagination.page} / {pagination.pages || 1}
                </span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages || 1, p.page + 1) }))}
                  disabled={pagination.page === (pagination.pages || 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 创建促销对话框 */}
      <PromotionCreateDialog 
        open={showCreate} 
        onClose={() => setShowCreate(false)} 
        onSubmit={handleCreatePromotion}
      />

      {/* 编辑促销对话框 */}
      {editPromotion && (
        <PromotionCreateDialog 
          open={true} 
          onClose={() => setEditPromotion(null)} 
          onSubmit={(data) => handleUpdatePromotion(editPromotion.id, data)}
          initialData={editPromotion}
        />
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteConfirmPromotion} onOpenChange={(open) => !open && setDeleteConfirmPromotion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除促销活动「{deleteConfirmPromotion?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmPromotion(null)}>
              取消
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeletePromotion}>
              删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 促销详情对话框 */}
      <Dialog open={!!detailPromotion} onOpenChange={(open) => !open && setDetailPromotion(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>促销详情</DialogTitle>
            <DialogDescription>
              {detailPromotion?.name}
            </DialogDescription>
          </DialogHeader>
          {detailPromotion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">促销类型</Label>
                  <p className="mt-1">{TYPE_MAP[detailPromotion.type] || detailPromotion.type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">状态</Label>
                  <p className="mt-1">{STATUS_MAP[detailPromotion.status]?.label || detailPromotion.status}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">开始日期</Label>
                  <p className="mt-1">{detailPromotion.startDate}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">结束日期</Label>
                  <p className="mt-1">{detailPromotion.endDate}</p>
                </div>
                {detailPromotion.type === 'discount' && detailPromotion.discountValue && (
                  <div>
                    <Label className="text-sm font-medium">折扣值</Label>
                    <p className="mt-1">{detailPromotion.discountValue}%</p>
                  </div>
                )}
                {detailPromotion.type === '满减' && detailPromotion.condition && detailPromotion.discountValue && (
                  <>
                    <div>
                      <Label className="text-sm font-medium">满减条件</Label>
                      <p className="mt-1">满 {detailPromotion.condition} 元</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">满减金额</Label>
                      <p className="mt-1">减 {detailPromotion.discountValue} 元</p>
                    </div>
                  </>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium">促销商品</Label>
                {promotionItems.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">暂无促销商品</p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {promotionItems.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          {item.coverImage ? (
                            <img src={`/api/images/${item.coverImage}`} alt={item.name} className="w-full h-full object-cover rounded" />
                          ) : (
                            <Tag className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name || item.skuCode}</p>
                          <p className="text-xs text-muted-foreground">{item.skuCode}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 促销效果预测对话框 */}
      <Dialog open={showForecast} onOpenChange={(open) => !open && setShowForecast(false)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>促销效果预测</DialogTitle>
            <DialogDescription>
              {forecastData?.promotionName}
            </DialogDescription>
          </DialogHeader>
          {forecastData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">预计销量增长</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {forecastData.prediction.salesGrowth.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">预计利润变化</p>
                    <p className={`text-2xl font-bold ${forecastData.prediction.profitChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {forecastData.prediction.profitChange >= 0 ? '+' : ''}
                      {forecastData.prediction.profitChange.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">预测置信度</p>
                    <p className="text-2xl font-bold">
                      {(forecastData.prediction.confidence * 100).toFixed(0)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">促销天数</p>
                    <p className="text-2xl font-bold">
                      {forecastData.prediction.total.days} 天
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <div>
                <Label className="text-sm font-medium">预计总销售额</Label>
                <p className="mt-1 text-xl font-bold">
                  ¥{forecastData.prediction.total.salesAmount.toFixed(2)}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">预计总利润</Label>
                <p className="mt-1 text-xl font-bold">
                  ¥{forecastData.prediction.total.profit.toFixed(2)}
                </p>
              </div>
              
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>预测说明：</strong>基于过去90天的销售数据，结合促销类型和力度进行预测。实际效果可能因市场变化而有所不同。
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PromotionsTab;
