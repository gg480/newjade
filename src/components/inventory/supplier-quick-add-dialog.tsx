'use client';

import React, { useState } from 'react';
import { suppliersApi } from '@/lib/api';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: { id: number; name: string }) => void;
}

/**
 * 快速新增供应商弹窗
 * 在入库流程中无需离开当前页面即可创建新供应商
 */
export default function SupplierQuickAddDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('请输入供应商名称');
      return;
    }
    setSaving(true);
    try {
      const newSupplier = await suppliersApi.createSupplier({
        name: name.trim(),
        contact: contact.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success(`供应商「${newSupplier.name}」已创建`);
      onCreated(newSupplier);
      setName('');
      setContact('');
      setPhone('');
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '创建供应商失败';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setName('');
    setContact('');
    setPhone('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>快速新增供应商</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">
              名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9"
              placeholder="供应商名称"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">联系人</Label>
            <Input
              value={contact}
              onChange={e => setContact(e.target.value)}
              className="h-9"
              placeholder="可选"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">电话</Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="h-9"
              placeholder="可选"
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
