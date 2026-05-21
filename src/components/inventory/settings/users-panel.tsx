'use client';

import React, { useState, useEffect } from 'react';
import { usersApi, rolesApi } from '@/lib/api';
import type { UserInfo, RoleInfo } from '@/lib/api.types';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { formatRelativeTime } from '@/components/inventory/settings-tab';
import { EmptyState, LoadingSkeleton } from '@/components/inventory/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

import {
  Plus, Pencil, Trash2, KeyRound, Loader2, Search, ShieldCheck, Users,
} from 'lucide-react';

export default function UsersPanel() {
  const { handleError } = useErrorHandler();
  const currentUser = useAppStore(s => s.currentUser);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserInfo | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserInfo | null>(null);
  const [disableUser, setDisableUser] = useState<UserInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ username: '', displayName: '', password: '', roleId: '' });
  const [editForm, setEditForm] = useState({ displayName: '', roleId: '' });
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try {
      const data = await usersApi.list({ page, limit: 20, keyword: searchKeyword || undefined });
      setUsers(data.items);
      setPagination(data.pagination);
    } catch (error) {
      handleError(error, { title: '加载用户列表失败' });
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await rolesApi.list();
      setRoles(data.items);
    } catch { /* roles load silently */ }
  };

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => loadUsers(1), 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Create user
  const handleCreate = async () => {
    if (!formData.username.trim() || !formData.password.trim() || !formData.roleId) {
      toast.error('请填写所有必填项');
      return;
    }
    if (formData.password.length < 4) {
      toast.error('密码至少4位');
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.create({
        username: formData.username.trim(),
        password: formData.password.trim(),
        displayName: formData.displayName.trim(),
        roleId: Number(formData.roleId),
      });
      toast.success('用户创建成功');
      setShowCreate(false);
      setFormData({ username: '', displayName: '', password: '', roleId: '' });
      loadUsers(1);
    } catch (error) {
      handleError(error, { title: '创建失败' });
    } finally {
      setSubmitting(false);
    }
  };

  // Edit user
  const handleEdit = async () => {
    if (!editUser) return;
    setSubmitting(true);
    try {
      await usersApi.update(editUser.id, {
        displayName: editForm.displayName.trim(),
        roleId: Number(editForm.roleId),
      });
      toast.success('用户更新成功');
      setEditUser(null);
      loadUsers(pagination.page);
    } catch (error) {
      handleError(error, { title: '更新失败' });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!resetPwdUser || !newPassword.trim()) {
      toast.error('请输入新密码');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('密码至少4位');
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.resetPassword(resetPwdUser.id, newPassword.trim());
      toast.success('密码重置成功');
      setResetPwdUser(null);
      setNewPassword('');
    } catch (error) {
      handleError(error, { title: '重置失败' });
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active/disable
  const handleToggleActive = async () => {
    if (!disableUser) return;
    setSubmitting(true);
    try {
      await usersApi.update(disableUser.id, { isActive: !disableUser.isActive });
      toast.success(disableUser.isActive ? '用户已禁用' : '用户已启用');
      setDisableUser(null);
      loadUsers(pagination.page);
    } catch (error) {
      handleError(error, { title: '操作失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (user: UserInfo) => {
    setEditForm({ displayName: user.displayName, roleId: String(user.roleId) });
    setEditUser(user);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-lg">用户管理</CardTitle>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名/显示名..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="pl-8 h-9 w-56"
            />
          </div>
          <Button size="sm" onClick={() => { setFormData({ username: '', displayName: '', password: '', roleId: '' }); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-1" /> 新增用户
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-8"><LoadingSkeleton /></div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="暂无用户" desc={'点击「新增用户」创建第一个用户'} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.displayName || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{user.roleName}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'} className={user.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : ''}>
                        {user.isActive ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : '从未登录'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(user)} title="编辑">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setResetPwdUser(user); setNewPassword(''); }} title="重置密码">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        {currentUser?.id !== user.id && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDisableUser(user)} title={user.isActive ? '禁用' : '启用'}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadUsers(pagination.page + 1)}>下一页</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>用户名 <span className="text-destructive">*</span></Label>
              <Input value={formData.username} onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} placeholder="登录用用户名" />
            </div>
            <div className="space-y-2">
              <Label>显示名</Label>
              <Input value={formData.displayName} onChange={e => setFormData(p => ({ ...p, displayName: e.target.value }))} placeholder="用户显示名称" />
            </div>
            <div className="space-y-2">
              <Label>初始密码 <span className="text-destructive">*</span></Label>
              <Input type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="至少4位" />
            </div>
            <div className="space-y-2">
              <Label>角色 <span className="text-destructive">*</span></Label>
              <Select value={formData.roleId} onValueChange={v => setFormData(p => ({ ...p, roleId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={o => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户 — {editUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>显示名</Label>
              <Input value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={editForm.roleId} onValueChange={v => setEditForm(p => ({ ...p, roleId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={submitting}>取消</Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwdUser} onOpenChange={o => !o && setResetPwdUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码 — {resetPwdUser?.username}</DialogTitle>
            <DialogDescription>重置后将立即生效，用户下次登录需使用新密码。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>新密码 <span className="text-destructive">*</span></Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少4位" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwdUser(null)} disabled={submitting}>取消</Button>
            <Button onClick={handleResetPassword} disabled={submitting || !newPassword.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable/Enable Confirm Dialog */}
      <AlertDialog open={!!disableUser} onOpenChange={o => !o && setDisableUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disableUser?.isActive ? '禁用用户' : '启用用户'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disableUser?.isActive
                ? `确定要禁用用户「${disableUser?.username}」吗？禁用后该用户将无法登录系统。`
                : `确定要启用用户「${disableUser?.username}」吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={submitting} className={disableUser?.isActive ? 'bg-destructive hover:bg-destructive/90' : ''}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              确认{disableUser?.isActive ? '禁用' : '启用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
