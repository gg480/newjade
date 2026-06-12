'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';

/** 密码强度计算（与后端 DEFAULT_POLICY 的 5 条规则对齐） */
function calcPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 2) return { score, label: '弱', color: 'text-red-500' };
  if (score <= 3) return { score, label: '中', color: 'text-orange-500' };
  return { score, label: '强', color: 'text-green-500' };
}

export default function PasswordPanel() {
  const { handleError } = useErrorHandler();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleChangePassword() {
    if (!oldPassword) { toast.error('请输入旧密码'); return; }
    if (!newPassword) { toast.error('请输入新密码'); return; }
    const strength = calcPasswordStrength(newPassword);
    if (strength.score <= 2) { toast.error('密码强度太弱，请设置更强的密码'); return; }
    if (newPassword !== confirmPassword) { toast.error('两次输入的新密码不一致'); return; }

    setChangingPassword(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      toast.success('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      handleError(error, { title: '密码修改失败' });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <Card className="border-l-4 border-l-amber-400 hover:shadow-sm transition-shadow duration-200 mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-600" />
          修改密码
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
          <p className="font-medium text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-600" />
            修改密码
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">旧密码</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="h-8 text-sm"
                placeholder="输入旧密码"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-8 text-sm"
                placeholder="至少8位，含大小写字母、数字、特殊字符"
              />
              {/* 密码强度指示条 */}
              {newPassword && (() => {
                const strength = calcPasswordStrength(newPassword);
                const barWidth = (strength.score / 5) * 100;
                const barColor = strength.score <= 2
                  ? 'bg-red-500'
                  : strength.score <= 3 ? 'bg-orange-500' : 'bg-green-500';
                return (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-muted-foreground">密码强度</span>
                      <span className={`text-[10px] font-semibold ${strength.color}`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">确认新密码</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
                className="h-8 text-sm"
                placeholder="再次输入新密码"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 bg-amber-600 hover:bg-amber-700 text-xs"
            onClick={handleChangePassword}
            disabled={changingPassword || (!!newPassword && calcPasswordStrength(newPassword).score <= 2)}
          >
            {changingPassword ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <KeyRound className="h-3 w-3 mr-1" />
            )}
            修改密码
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
