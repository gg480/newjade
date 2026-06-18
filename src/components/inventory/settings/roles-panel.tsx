'use client';

import React, { useState, useEffect } from 'react';
import { rolesApi } from '@/lib/api';
import type { RoleInfo } from '@/lib/api.types';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { EmptyState, LoadingSkeleton } from '@/components/inventory/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

import {
  Plus, Pencil, Trash2, Loader2, ShieldCheck, Users,
} from 'lucide-react';

// 权限树定义
const PERMISSION_GROUPS = [
  {
    label: '导航权限',
    permissions: [
      { key: 'tab:dashboard', label: '看板' },
      { key: 'tab:inventory', label: '库存管理' },
      { key: 'tab:sales', label: '销售记录' },
      { key: 'tab:batches', label: '批次管理' },
      { key: 'tab:customers', label: '客户管理' },
      { key: 'tab:settings', label: '系统设置' },
      { key: 'tab:logs', label: '操作日志' },
      { key: 'tab:promotions', label: '促销活动' },
      { key: 'tab:restock', label: '入货建议' },
      { key: 'tab:stocktaking', label: '库存盘点' },
      { key: 'tab:content-promotion', label: '内容推广' },
    ],
  },
  {
    label: '用户 & 角色',
    permissions: [
      { key: 'action:user_manage', label: '用户管理' },
      { key: 'action:role_manage', label: '角色管理' },
    ],
  },
  {
    label: '内容推广',
    permissions: [
      { key: 'action:content_view', label: '查看内容推广' },
      { key: 'action:content_manage', label: '管理内容推广' },
    ],
  },
  {
    label: '货品管理',
    permissions: [
      { key: 'action:item_create', label: '创建货品' },
      { key: 'action:item_edit', label: '编辑货品' },
      { key: 'action:item_delete', label: '删除货品' },
      { key: 'action:delete_item', label: '删除货品(旧)' },
      { key: 'action:item_view', label: '查看货品' },
      { key: 'action:item_batch_ops', label: '批量操作' },
    ],
  },
  {
    label: '销售管理',
    permissions: [
      { key: 'action:sale_create', label: '销售出库' },
      { key: 'action:sale_return', label: '退货' },
      { key: 'action:sale_bundle', label: '套装销售' },
      { key: 'action:sale_view', label: '查看销售记录' },
      { key: 'action:sale_edit', label: '编辑销售记录' },
    ],
  },
  {
    label: '批次管理',
    permissions: [
      { key: 'action:batch_create', label: '创建批次' },
      { key: 'action:batch_edit', label: '编辑批次' },
      { key: 'action:batch_allocate', label: '批次分配' },
      { key: 'action:batch_view', label: '查看批次' },
    ],
  },
  {
    label: '客户管理',
    permissions: [
      { key: 'action:customer_create', label: '创建客户' },
      { key: 'action:customer_edit', label: '编辑客户' },
      { key: 'action:customer_delete', label: '删除客户' },
      { key: 'action:customer_merge', label: '合并客户' },
      { key: 'action:customer_view', label: '查看客户' },
    ],
  },
  {
    label: '其他权限',
    permissions: [
      { key: 'action:export', label: '导出数据' },
      { key: 'action:import_data', label: '数据导入' },
      { key: 'action:price_adjust', label: '调价' },
      { key: 'action:supplier_manage', label: '供应商管理' },
      { key: 'action:dict_manage', label: '字典管理' },
      { key: 'action:config_manage', label: '系统配置管理' },
      { key: 'action:log_view', label: '查看操作日志' },
      { key: 'action:backup_manage', label: '备份管理' },
      { key: 'action:metal_price_manage', label: '贵金属价格管理' },
      { key: 'action:promotion_manage', label: '促销管理' },
      { key: 'action:stocktaking_manage', label: '盘点管理' },
      { key: 'action:restock_manage', label: '补货管理' },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

export default function RolesPanel() {
  const { handleError } = useErrorHandler();
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [editRole, setEditRole] = useState<RoleInfo | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ name: '', description: '', permissions: new Set<string>() });
  const [editForm, setEditForm] = useState({ name: '', description: '', permissions: new Set<string>() });

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await rolesApi.list();
      setRoles(data.items);
    } catch (error) {
      handleError(error, { title: '加载角色列表失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入角色名');
      return;
    }
    setSubmitting(true);
    try {
      await rolesApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        permissions: Array.from(formData.permissions),
      });
      toast.success('角色创建成功');
      setShowCreate(false);
      setFormData({ name: '', description: '', permissions: new Set(ALL_PERMISSION_KEYS) });
      loadRoles();
    } catch (error) {
      handleError(error, { title: '创建失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editRole) return;
    setSubmitting(true);
    try {
      await rolesApi.update(editRole.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        permissions: Array.from(editForm.permissions),
      });
      toast.success('角色更新成功');
      setEditRole(null);
      loadRoles();
    } catch (error) {
      handleError(error, { title: '更新失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    setSubmitting(true);
    try {
      await rolesApi.delete(deleteRole.id);
      toast.success('角色已删除');
      setDeleteRole(null);
      loadRoles();
    } catch (error) {
      handleError(error, { title: '删除失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (role: RoleInfo) => {
    setEditForm({
      name: role.name,
      description: role.description || '',
      permissions: new Set(role.permissions),
    });
    setEditRole(role);
  };

  const togglePermission = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const toggleGroup = (set: Set<string>, groupKeys: string[], checked: boolean) => {
    const next = new Set(set);
    if (checked) {
      groupKeys.forEach(k => next.add(k));
    } else {
      groupKeys.forEach(k => next.delete(k));
    }
    return next;
  };

  const isGroupFullSelected = (set: Set<string>, groupKeys: string[]) =>
    groupKeys.every(k => set.has(k));

  const PermissionCheckboxGroup = ({
    label,
    perms,
    selected,
    onChange,
  }: {
    label: string;
    perms: { key: string; label: string }[];
    selected: Set<string>;
    onChange: (set: Set<string>) => void;
  }) => {
    const allSelected = isGroupFullSelected(selected, perms.map(p => p.key));
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`chk-${label}`}
            checked={allSelected}
            onCheckedChange={c => onChange(toggleGroup(selected, perms.map(p => p.key), c === true))}
          />
          <Label htmlFor={`chk-${label}`} className="font-medium text-sm cursor-pointer">{label}</Label>
        </div>
        <div className="ml-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {perms.map(p => (
            <div key={p.key} className="flex items-center gap-2">
              <Checkbox
                id={`chk-${p.key}`}
                checked={selected.has(p.key)}
                onCheckedChange={() => onChange(togglePermission(selected, p.key))}
              />
              <Label htmlFor={`chk-${p.key}`} className="text-sm cursor-pointer text-muted-foreground">{p.label}</Label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-lg">角色管理</CardTitle>
        <Button size="sm" onClick={() => { setFormData({ name: '', description: '', permissions: new Set(ALL_PERMISSION_KEYS) }); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> 新增角色
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSkeleton />
        ) : roles.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="暂无角色" desc={'点击「新增角色」创建第一个角色'} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map(role => (
              <Card key={role.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{role.name}</h3>
                        {role.isSystem && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-muted">系统</Badge>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{role.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(role)} title="编辑权限">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!role.isSystem && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteRole(role)} title="删除角色">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {role.userCount} 个用户
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {role.permissions.length} 项权限
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {role.permissions.slice(0, 5).map(p => (
                      <Badge key={p} variant="secondary" className="text-[10px] h-5 px-1.5">
                        {p}
                      </Badge>
                    ))}
                    {role.permissions.length > 5 && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">+{role.permissions.length - 5}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create Role Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>角色名 <span className="text-destructive">*</span></Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="如：custom_role" />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="角色描述（可选）" rows={2} />
            </div>
            <div className="border-t pt-4">
              <Label className="mb-3 block">权限设置</Label>
              <div className="space-y-4">
                {PERMISSION_GROUPS.map(group => (
                  <PermissionCheckboxGroup
                    key={group.label}
                    label={group.label}
                    perms={group.permissions}
                    selected={formData.permissions}
                    onChange={s => setFormData(p => ({ ...p, permissions: s }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editRole} onOpenChange={o => !o && setEditRole(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑角色 — {editRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>角色名</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                disabled={editRole?.isSystem}
              />
              {editRole?.isSystem && <p className="text-xs text-muted-foreground">系统预置角色名称不可修改</p>}
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="border-t pt-4">
              <Label className="mb-3 block">权限设置</Label>
              <div className="space-y-4">
                {PERMISSION_GROUPS.map(group => (
                  <PermissionCheckboxGroup
                    key={group.label}
                    label={group.label}
                    perms={group.permissions}
                    selected={editForm.permissions}
                    onChange={s => setEditForm(p => ({ ...p, permissions: s }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)} disabled={submitting}>取消</Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirm */}
      <AlertDialog open={!!deleteRole} onOpenChange={o => !o && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除角色</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除角色「{deleteRole?.name}」吗？
              {deleteRole && deleteRole.userCount > 0 && (
                <span className="block mt-2 text-destructive">该角色下还有 {deleteRole.userCount} 个用户，无法删除。</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting || (deleteRole?.userCount || 0) > 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
