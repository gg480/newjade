'use client';

import React, { useState } from 'react';
import { customersApi } from '@/lib/api';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface CustomerQuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: { id: number; name: string }) => void;
}

/**
 * 快速新增客户弹窗
 * 在收银台流程中无需离开当前页面即可创建新客户
 */
export default function CustomerQuickAddDialog({ open, onOpenChange, onCreated }: CustomerQuickAddDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('请输入客户姓名');
      return;
    }
    setSaving(true);
    try {
      const newCustomer = await customersApi.createCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      toast.success(`客户「${newCustomer.name}」已创建`);
      onCreated(newCustomer);
      setName('');
      setPhone('');
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '创建客户失败';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setName('');
    setPhone('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>快速新增客户</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">
              姓名 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9"
              placeholder="客户姓名"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">手机号</Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="h-9"
              placeholder="选填"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={saving}
          >
            {saving ? '创建中...' : '确认新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
