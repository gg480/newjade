'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import { CalendarDays, Tag, Target, Plus } from 'lucide-react';
import PromotionItemSelect from './promotion-item-select';

// 促销创建/编辑对话框组件
function PromotionCreateDialog({ 
  open, 
  onClose, 
  onSubmit, 
  initialData 
}: { 
  open: boolean; 
  onClose: (o: boolean) => void; 
  onSubmit: (data: any) => void;
  initialData?: any 
}) {
  const [form, setForm] = useState({
    name: '',
    type: 'discount',
    discountValue: 0,
    condition: 0,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().slice(0, 10),
    recurrence: 'none',
    status: 'draft',
    itemIds: [] as number[],
  });
  
  const [saving, setSaving] = useState(false);
  const [showItemSelect, setShowItemSelect] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        type: initialData.type || 'discount',
        discountValue: initialData.discountValue || 0,
        condition: initialData.condition || 0,
        startDate: initialData.startDate || new Date().toISOString().slice(0, 10),
        endDate: initialData.endDate || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().slice(0, 10),
        recurrence: initialData.recurrence || 'none',
        status: initialData.status || 'draft',
        itemIds: initialData.items?.map((item: any) => item.item.id) || [],
      });
    } else {
      setForm({
        name: '',
        type: 'discount',
        discountValue: 0,
        condition: 0,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().slice(0, 10),
        recurrence: 'none',
        status: 'draft',
        itemIds: [],
      });
    }
  }, [initialData, open]);

  // 处理表单输入变化
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'discountValue' || name === 'condition' ? parseFloat(value) || 0 : value
    }));
  }

  // 处理选择变化
  function handleSelectChange(name: string, value: string) {
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  }

  // 处理商品选择
  function handleItemsSelected(itemIds: number[]) {
    setForm(prev => ({
      ...prev,
      itemIds
    }));
    setShowItemSelect(false);
  }

  // 校验表单
  function validateForm() {
    if (!form.name.trim()) {
      toast.error('请输入促销名称');
      return false;
    }
    if (!form.type) {
      toast.error('请选择促销类型');
      return false;
    }
    if (form.type === 'discount' && (!form.discountValue || form.discountValue <= 0)) {
      toast.error('请输入有效的折扣值');
      return false;
    }
    if (form.type === '满减' && (!form.condition || form.condition <= 0)) {
      toast.error('请输入有效的满减条件');
      return false;
    }
    if (form.type === '满减' && (!form.discountValue || form.discountValue <= 0)) {
      toast.error('请输入有效的满减金额');
      return false;
    }
    if (!form.startDate) {
      toast.error('请选择开始日期');
      return false;
    }
    if (!form.endDate) {
      toast.error('请选择结束日期');
      return false;
    }
    if (new Date(form.startDate) > new Date(form.endDate)) {
      toast.error('开始日期不能晚于结束日期');
      return false;
    }
    if (form.itemIds.length === 0) {
      toast.error('请选择促销商品');
      return false;
    }
    return true;
  }

  // 处理提交
  async function handleSubmit() {
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        discountValue: form.discountValue || undefined,
        condition: form.condition || undefined,
      });
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? '编辑促销' : '新建促销'}</DialogTitle>
          <DialogDescription>
            {initialData ? '修改促销活动信息' : '创建新的促销活动'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* 促销名称 */}
          <div className="space-y-1">
            <Label className="text-xs">促销名称 <span className="text-red-500">*</span></Label>
            <Input 
              name="name" 
              value={form.name} 
              onChange={handleInputChange} 
              className="h-9" 
              placeholder="输入促销名称"
            />
          </div>

          {/* 促销类型 */}
          <div className="space-y-1">
            <Label className="text-xs">促销类型 <span className="text-red-500">*</span></Label>
            <Select 
              value={form.type} 
              onValueChange={(value) => handleSelectChange('type', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择促销类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">折扣</SelectItem>
                <SelectItem value="满减">满减</SelectItem>
                <SelectItem value="赠品">赠品</SelectItem>
                <SelectItem value="套餐">套餐</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 促销参数 */}
          {form.type === 'discount' && (
            <div className="space-y-1">
              <Label className="text-xs">折扣值 (%) <span className="text-red-500">*</span></Label>
              <Input 
                name="discountValue" 
                type="number" 
                min="0.1" 
                max="99.9" 
                step="0.1"
                value={form.discountValue || ''} 
                onChange={handleInputChange} 
                className="h-9" 
                placeholder="输入折扣值"
              />
            </div>
          )}

          {form.type === '满减' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">满减条件 (元) <span className="text-red-500">*</span></Label>
                <Input 
                  name="condition" 
                  type="number" 
                  min="1" 
                  step="1"
                  value={form.condition || ''} 
                  onChange={handleInputChange} 
                  className="h-9" 
                  placeholder="输入满减条件"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">满减金额 (元) <span className="text-red-500">*</span></Label>
                <Input 
                  name="discountValue" 
                  type="number" 
                  min="1" 
                  step="1"
                  value={form.discountValue || ''} 
                  onChange={handleInputChange} 
                  className="h-9" 
                  placeholder="输入满减金额"
                />
              </div>
            </div>
          )}

          {/* 时间范围 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">开始日期 <span className="text-red-500">*</span></Label>
              <Input 
                name="startDate" 
                type="date" 
                value={form.startDate} 
                onChange={handleInputChange} 
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">结束日期 <span className="text-red-500">*</span></Label>
              <Input 
                name="endDate" 
                type="date" 
                value={form.endDate} 
                onChange={handleInputChange} 
                className="h-9"
              />
            </div>
          </div>

          {/* 周期设置 */}
          <div className="space-y-1">
            <Label className="text-xs">周期设置</Label>
            <Select 
              value={form.recurrence} 
              onValueChange={(value) => handleSelectChange('recurrence', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择周期" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">单次</SelectItem>
                <SelectItem value="daily">每天</SelectItem>
                <SelectItem value="weekly">每周</SelectItem>
                <SelectItem value="monthly">每月</SelectItem>
                <SelectItem value="quarterly">每季度</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 状态设置 */}
          <div className="space-y-1">
            <Label className="text-xs">状态</Label>
            <Select 
              value={form.status} 
              onValueChange={(value) => handleSelectChange('status', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="active">进行中</SelectItem>
                <SelectItem value="paused">已暂停</SelectItem>
                <SelectItem value="ended">已结束</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 促销商品 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">促销商品 <span className="text-red-500">*</span></Label>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowItemSelect(true)}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                选择商品
              </Button>
            </div>
            <div className="p-3 border rounded-lg min-h-[80px]">
              {form.itemIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">未选择商品</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {form.itemIds.map(id => (
                    <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      商品 {id}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>取消</Button>
          <Button 
            onClick={handleSubmit} 
            className="bg-emerald-600 hover:bg-emerald-700" 
            disabled={saving}
          >
            {saving ? '保存中...' : initialData ? '更新促销' : '创建促销'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 商品选择对话框 */}
      <PromotionItemSelect 
        open={showItemSelect} 
        onClose={() => setShowItemSelect(false)} 
        onSelect={handleItemsSelected}
        selectedItemIds={form.itemIds}
      />
    </Dialog>
  );
}

// 导入Badge组件
import { Badge } from '@/components/ui/badge';

export default PromotionCreateDialog;
