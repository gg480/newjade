'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Input,
  InputDescription,
  InputLabel,
  InputWrapper,
} from '@/components/ui/input';
import {
  Textarea,
  TextareaDescription,
  TextareaLabel,
  TextareaWrapper,
} from '@/components/ui/textarea';
import {
  Button,
  buttonVariants,
} from '@/components/ui/button';
import {
  Checkbox,
} from '@/components/ui/checkbox';
import {
  Label,
} from '@/components/ui/label';
import {
  Badge,
  badgeVariants,
} from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Calendar,
  CalendarContent,
  CalendarDay,
  CalendarHeader,
  CalendarMonth,
  CalendarMonthHeader,
  CalendarNextButton,
  CalendarPreviousButton,
  CalendarTitle,
} from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// 类型定义
interface Stocktaking {
  id: number;
  type: 'regular' | 'random';
  startDate: string;
  endDate: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  details: StocktakingDetail[];
}

interface StocktakingDetail {
  id: number;
  stocktakingId: number;
  itemId: number;
  systemQty: number;
  actualQty: number;
  variance: number;
  notes: string | null;
  item: {
    id: number;
    skuCode: string;
    name: string | null;
    material: {
      id: number;
      name: string;
    };
    type: {
      id: number;
      name: string;
    } | null;
  };
}

interface Item {
  id: number;
  skuCode: string;
  name: string | null;
  material: {
    id: number;
    name: string;
  };
  type: {
    id: number;
    name: string;
  } | null;
  status: string;
}

const StocktakingTab: React.FC = () => {
  // 状态管理
  const [stocktakings, setStocktakings] = useState<Stocktaking[]>([]);
  const [selectedStocktaking, setSelectedStocktaking] = useState<Stocktaking | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [newStocktaking, setNewStocktaking] = useState({
    type: 'regular' as 'regular' | 'random',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });
  const [stocktakingDetails, setStocktakingDetails] = useState<StocktakingDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 获取盘点计划列表
  const fetchStocktakings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stocktaking');
      const data = await response.json();
      if (data.code === 0) {
        setStocktakings(data.data.stocktakings);
      }
    } catch (error) {
      console.error('获取盘点计划列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取可盘点的商品列表（在库状态）
  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items?status=in_stock');
      const data = await response.json();
      if (data.code === 0) {
        setItems(data.data.items || []);
      }
    } catch (error) {
      console.error('获取商品列表失败:', error);
    }
  };

  // 初始化数据
  useEffect(() => {
    fetchStocktakings();
    fetchItems();
  }, []);

  // 创建盘点计划
  const handleCreateStocktaking = async () => {
    if (selectedItems.length === 0) {
      alert('请至少选择一个商品');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/stocktaking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newStocktaking,
          itemIds: selectedItems,
        }),
      });
      const data = await response.json();
      if (data.code === 0) {
        setIsCreateDialogOpen(false);
        setSelectedItems([]);
        setNewStocktaking({
          type: 'regular',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          notes: '',
        });
        fetchStocktakings();
      } else {
        alert('创建盘点计划失败: ' + data.message);
      }
    } catch (error) {
      console.error('创建盘点计划失败:', error);
      alert('创建盘点计划失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 查看盘点详情
  const handleViewDetail = async (stocktaking: Stocktaking) => {
    setSelectedStocktaking(stocktaking);
    setStocktakingDetails(stocktaking.details);
    setIsDetailDialogOpen(true);
  };

  // 更新盘点明细
  const handleUpdateDetail = (detailId: number, actualQty: number, notes: string) => {
    setStocktakingDetails(prev =>
      prev.map(detail =>
        detail.id === detailId
          ? {
              ...detail,
              actualQty,
              variance: actualQty - detail.systemQty,
              notes,
            }
          : detail
      )
    );
  };

  // 保存盘点明细
  const handleSaveDetails = async () => {
    if (!selectedStocktaking) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/stocktaking/${selectedStocktaking.id}/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          details: stocktakingDetails.map(detail => ({
            detailId: detail.id,
            actualQty: detail.actualQty,
            systemQty: detail.systemQty,
            notes: detail.notes,
          })),
        }),
      });
      const data = await response.json();
      if (data.code === 0) {
        alert('保存盘点明细成功');
        fetchStocktakings();
      } else {
        alert('保存盘点明细失败: ' + data.message);
      }
    } catch (error) {
      console.error('保存盘点明细失败:', error);
      alert('保存盘点明细失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 完成盘点
  const handleCompleteStocktaking = async () => {
    if (!selectedStocktaking) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/stocktaking/${selectedStocktaking.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          endDate: format(new Date(), 'yyyy-MM-dd'),
        }),
      });
      const data = await response.json();
      if (data.code === 0) {
        setIsDetailDialogOpen(false);
        fetchStocktakings();
      } else {
        alert('完成盘点失败: ' + data.message);
      }
    } catch (error) {
      console.error('完成盘点失败:', error);
      alert('完成盘点失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 状态标签
  const statusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge variant="secondary">进行中</Badge>;
      case 'completed':
        return <Badge variant="default">已完成</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">已取消</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // 类型标签
  const typeBadge = (type: string) => {
    switch (type) {
      case 'regular':
        return <Badge variant="default">定期盘点</Badge>;
      case 'spot_check':
        return <Badge variant="secondary">抽查盘点</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">库存盘点</h2>
        <Button 
          variant={"default"}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          创建盘点计划
        </Button>
      </div>

      {/* 盘点计划列表 */}
      <Card>
        <CardHeader>
          <CardTitle>盘点计划列表</CardTitle>
          <CardDescription>管理所有库存盘点计划</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>开始日期</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>商品数量</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocktakings.map((stocktaking) => (
                  <TableRow key={stocktaking.id}>
                    <TableCell>{stocktaking.id}</TableCell>
                    <TableCell>{typeBadge(stocktaking.type)}</TableCell>
                    <TableCell>{stocktaking.startDate}</TableCell>
                    <TableCell>{stocktaking.endDate || '-'}</TableCell>
                    <TableCell>{statusBadge(stocktaking.status)}</TableCell>
                    <TableCell>{stocktaking.details.length}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="secondary"
                          onClick={() => handleViewDetail(stocktaking)}
                        >
                          查看
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 创建盘点计划对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          {/* 由按钮触发 */}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>创建盘点计划</DialogTitle>
            <DialogDescription>
              选择要盘点的商品并设置盘点计划信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">盘点类型</Label>
              <Select 
                value={newStocktaking.type} 
                onValueChange={(value) => setNewStocktaking({...newStocktaking, type: value as 'regular' | 'random'})}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="选择盘点类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">定期盘点</SelectItem>
                  <SelectItem value="random">抽查盘点</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"secondary"}
                    className="w-full justify-start text-left font-normal"
                  >
                    {newStocktaking.startDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={new Date(newStocktaking.startDate)}
                    onSelect={(date) => setNewStocktaking({...newStocktaking, startDate: format(date, 'yyyy-MM-dd')})}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                value={newStocktaking.notes}
                onChange={(e) => setNewStocktaking({...newStocktaking, notes: e.target.value})}
                placeholder="输入备注信息"
              />
            </div>
            <div className="space-y-2">
              <Label>选择商品</Label>
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems([...selectedItems, item.id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== item.id));
                          }
                        }}
                      />
                      <Label htmlFor={`item-${item.id}`} className="flex-1">
                        <div className="font-medium">{item.skuCode}</div>
                        <div className="text-sm text-gray-500">
                          {item.name || '未命名'} - {item.material.name} - {item.type?.name || '无类型'}
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-500">
                已选择 {selectedItems.length} 个商品
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant={"secondary"}
              onClick={() => setIsCreateDialogOpen(false)}
            >
              取消
            </Button>
            <Button 
              variant={"default"}
              onClick={handleCreateStocktaking}
              disabled={isLoading || selectedItems.length === 0}
            >
              {isLoading ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 盘点详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogTrigger asChild>
          {/* 由按钮触发 */}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px]">
          {selectedStocktaking && (
            <>
              <DialogHeader>
                <DialogTitle>盘点详情</DialogTitle>
                <DialogDescription>
                  盘点计划 #{selectedStocktaking.id} - {selectedStocktaking.type === 'regular' ? '定期盘点' : '抽查盘点'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">开始日期</Label>
                    <div>{selectedStocktaking.startDate}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">结束日期</Label>
                    <div>{selectedStocktaking.endDate || '-'}</div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">状态</Label>
                    <div>{statusBadge(selectedStocktaking.status)}</div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">备注</Label>
                    <div>{selectedStocktaking.notes || '-'}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>盘点明细</Label>
                  <div className="overflow-x-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>商品名称</TableHead>
                          <TableHead>材质</TableHead>
                          <TableHead>器型</TableHead>
                          <TableHead>系统数量</TableHead>
                          <TableHead>实际数量</TableHead>
                          <TableHead>差异</TableHead>
                          <TableHead>备注</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stocktakingDetails.map((detail) => (
                          <TableRow key={detail.id}>
                            <TableCell>{detail.item.skuCode}</TableCell>
                            <TableCell>{detail.item.name || '未命名'}</TableCell>
                            <TableCell>{detail.item.material.name}</TableCell>
                            <TableCell>{detail.item.type?.name || '无类型'}</TableCell>
                            <TableCell>{detail.systemQty}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                value={detail.actualQty}
                                onChange={(e) => handleUpdateDetail(detail.id, parseInt(e.target.value) || 0, detail.notes || '')}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell className={cn(
                              detail.variance > 0 ? 'text-green-600' :
                              detail.variance < 0 ? 'text-red-600' :
                              'text-gray-600'
                            )}>
                              {detail.variance > 0 ? `+${detail.variance}` : detail.variance}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={detail.notes || ''}
                                onChange={(e) => handleUpdateDetail(detail.id, detail.actualQty, e.target.value)}
                                className="w-32"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant={"secondary"}
                  onClick={() => setIsDetailDialogOpen(false)}
                >
                  关闭
                </Button>
                {selectedStocktaking.status === 'in_progress' && (
                  <>
                    <Button 
                      variant={"default"}
                      onClick={handleSaveDetails}
                      disabled={isLoading}
                    >
                      {isLoading ? '保存中...' : '保存明细'}
                    </Button>
                    <Button 
                      variant={"default"}
                      onClick={handleCompleteStocktaking}
                      disabled={isLoading}
                    >
                      {isLoading ? '完成中...' : '完成盘点'}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StocktakingTab;
