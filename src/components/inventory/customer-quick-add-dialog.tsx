'use client';

import { useState } from 'react';
import { customersApi } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, SkipForward, CheckCircle } from 'lucide-react';

interface CustomerQuickAddDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 开关控制 */
  onOpenChange: (open: boolean) => void;
  /** 销售上下文信息（用于展示） */
  context?: {
    itemSku?: string;
    itemName?: string;
    itemCount?: number;
  };
  /** 客户创建成功后回调 */
  onCreated?: (customer: any) => void;
  /** 跳过回调 */
  onSkip?: () => void;
}

export function CustomerQuickAddDialog({
  open,
  onOpenChange,
  context,
  onCreated,
  onSkip,
}: CustomerQuickAddDialogProps) {
  const [form, setForm] = useState({ name: '', phone: '', wechat: '', address: '', notes: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);

  function reset() {
    setForm({ name: '', phone: '', wechat: '', address: '', notes: '', tags: '' });
    setSaving(false);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('请输入客户姓名');
      return;
    }
    setSaving(true);
    try {
      // 检查是否已有同名客户
      const existing = await customersApi.getCustomers({ keyword: form.name.trim(), size: 5 });
      const sameName = (existing?.items || []).find(
        (c: any) => c.name.trim() === form.name.trim(),
      );

      if (sameName) {
        // 同名客户存在，提示是否更新
        toast.warning(`已存在同名客户「${sameName.name}」，信息已合并到该客户`);
        // 更新已有客户的信息（补全空字段）
        const updateData: any = {};
        if (form.phone.trim() && !sameName.phone) updateData.phone = form.phone.trim();
        if (form.wechat.trim() && !sameName.wechat) updateData.wechat = form.wechat.trim();
        if (form.address.trim() && !sameName.address) updateData.address = form.address.trim();
        if (Object.keys(updateData).length > 0) {
          await customersApi.updateCustomer(sameName.id, updateData);
        }
        onCreated?.(sameName);
      } else {
        // 新建客户
        const tagsArr = form.tags
          ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
          : [];
        const newCustomer = await customersApi.createCustomer({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          wechat: form.wechat.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
          tags: tagsArr,
        });
        toast.success(`客户「${newCustomer.name}」已保存`);
        onCreated?.(newCustomer);
      }

      if (doNotAskAgain) {
        localStorage.setItem('customer_quick_add_suppress', '1');
      }

      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || '保存客户失败');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    if (doNotAskAgain) {
      localStorage.setItem('customer_quick_add_suppress', '1');
    }
    onSkip?.();
    reset();
    onOpenChange(false);
  }

  const itemLabel = context
    ? context.itemSku
      ? `${context.itemSku}${context.itemName ? ` ${context.itemName}` : ''}`
      : context.itemName || ''
    : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleSkip();
        else onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            保存客户信息
          </DialogTitle>
          <DialogDescription>
            {context?.itemCount && context.itemCount > 1
              ? `${context.itemCount} 件货品已出库`
              : '货品已成功出库'}
            {itemLabel && <span className="block text-xs mt-1">货品：{itemLabel}</span>}
            <span className="block text-xs mt-1 text-amber-600">
              当前为散客交易，建议补充客户资料以便后续追踪
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>
              姓名 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="客户姓名"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && form.name.trim()) handleSave();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>电话</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="手机号"
            />
          </div>
          <div className="space-y-1">
            <Label>微信号</Label>
            <Input
              value={form.wechat}
              onChange={(e) => setForm((f) => ({ ...f, wechat: e.target.value }))}
              placeholder="微信号"
            />
          </div>
          <div className="space-y-1">
            <Label>地址</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="地址"
            />
          </div>
          <div className="space-y-1">
            <Label>标签</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="多个标签用逗号分隔"
            />
          </div>
          <div className="space-y-1">
            <Label>备注</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="备注信息（可选）"
              className="min-h-[60px]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="doNotAskAgain"
              checked={doNotAskAgain}
              onCheckedChange={(c) => setDoNotAskAgain(!!c)}
            />
            <Label htmlFor="doNotAskAgain" className="text-xs text-muted-foreground cursor-pointer">
              本次不再提示
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSkip} disabled={saving} className="sm:order-1">
            <SkipForward className="h-4 w-4 mr-1" />
            跳过
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 sm:order-2"
          >
            {saving ? (
              '保存中...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                保存客户
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
