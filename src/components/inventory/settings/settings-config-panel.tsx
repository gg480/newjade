'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, CheckCircle, KeyRound, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';

interface ConfigPanelProps {
  configs: any[];
  editConfigs: Record<string, string>;
  setEditConfigs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  systemConfig: {
    storeName: string;
    currencySymbol: string;
    lowStockDays: number;
    profitWarningThreshold: number;
    defaultProfitRate: number;
  };
  setSystemConfig: React.Dispatch<
    React.SetStateAction<{
      storeName: string;
      currencySymbol: string;
      lowStockDays: number;
      profitWarningThreshold: number;
      defaultProfitRate: number;
    }>
  >;
  onUpdateConfig: (key: string, value: string) => Promise<void>;
  onSaveConfig: () => Promise<void>;
  onResetConfig: () => void;
}

export default function SettingsConfigPanel({
  configs,
  editConfigs,
  setEditConfigs,
  systemConfig,
  setSystemConfig,
  onUpdateConfig,
  onSaveConfig,
  onResetConfig,
}: ConfigPanelProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleChangePassword() {
    if (!oldPassword) { toast.error('请输入旧密码'); return; }
    if (!newPassword) { toast.error('请输入新密码'); return; }
    if (newPassword.length < 4) { toast.error('新密码长度不能少于4位'); return; }
    if (newPassword !== confirmPassword) { toast.error('两次输入的新密码不一致'); return; }

    setChangingPassword(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      toast.success('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.message || '密码修改失败');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <Card className="border-l-4 border-l-gray-400 hover:shadow-sm transition-shadow duration-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4 text-gray-500" />
          系统配置
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* System Config (localStorage + server sync for store_name) */}
          <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 space-y-3">
            <p className="font-medium text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-violet-600" />
              系统配置
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">店铺名称</Label>
                <Input
                  value={systemConfig.storeName}
                  onChange={(e) =>
                    setSystemConfig((c) => ({ ...c, storeName: e.target.value }))
                  }
                  className="h-8 text-sm"
                  placeholder="兴盛艺珠宝"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">默认货币符号</Label>
                <Input
                  value={systemConfig.currencySymbol}
                  onChange={(e) =>
                    setSystemConfig((c) => ({
                      ...c,
                      currencySymbol: e.target.value,
                    }))
                  }
                  className="h-8 text-sm w-24"
                  placeholder="¥"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">利润预警阈值 (%)</Label>
                <Input
                  type="number"
                  value={systemConfig.profitWarningThreshold}
                  onChange={(e) =>
                    setSystemConfig((c) => ({
                      ...c,
                      profitWarningThreshold: parseInt(e.target.value) || 30,
                    }))
                  }
                  className="h-8 text-sm w-24"
                  min="0"
                  max="100"
                />
                <p className="text-[10px] text-muted-foreground">
                  低于此比例的利润将触发预警
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">压货天数阈值 (天)</Label>
                <Input
                  type="number"
                  value={systemConfig.lowStockDays}
                  onChange={(e) =>
                    setSystemConfig((c) => ({
                      ...c,
                      lowStockDays: parseInt(e.target.value) || 90,
                    }))
                  }
                  className="h-8 text-sm w-24"
                  min="1"
                />
                <p className="text-[10px] text-muted-foreground">
                  超过此天数未售出将标记为压货
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">默认利润率 (%)</Label>
                <Input
                  type="number"
                  value={systemConfig.defaultProfitRate}
                  onChange={(e) =>
                    setSystemConfig((c) => ({
                      ...c,
                      defaultProfitRate: parseInt(e.target.value) || 40,
                    }))
                  }
                  className="h-8 text-sm w-24"
                  min="0"
                  max="100"
                />
                <p className="text-[10px] text-muted-foreground">
                  新建货品时的默认利润率
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs"
                onClick={onSaveConfig}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                保存设置
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={onResetConfig}
              >
                恢复默认
              </Button>
            </div>
          </div>

          {/* Server-side configs — fully editable */}
          {configs
            .filter((c) => !['store_name', 'warning_days'].includes(c.key))
            .map((c) => {
              const editValue = editConfigs[c.key] ?? c.value;
              const isNumeric = [
                'operating_cost_rate',
                'markup_rate',
                'aging_threshold_days',
              ].includes(c.key);
              const isPassword = c.key === 'admin_password';
              return (
                <div
                  key={c.key}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{c.description || c.key}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {c.key}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type={isPassword ? 'password' : isNumeric ? 'number' : 'text'}
                      value={editValue}
                      onChange={(e) =>
                        setEditConfigs((prev) => ({
                          ...prev,
                          [c.key]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        if (editValue !== c.value) {
                          onUpdateConfig(c.key, editValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          (e.target as HTMLInputElement).blur();
                      }}
                      className={
                        isNumeric
                          ? 'w-24 h-8 text-sm text-right'
                          : 'w-40 h-8 text-sm'
                      }
                      step={isNumeric ? 'any' : undefined}
                    />
                    {c.key === 'operating_cost_rate' && (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        ({(parseFloat(editValue) * 100).toFixed(0)}%)
                      </span>
                    )}
                    {c.key === 'markup_rate' && (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        ({(parseFloat(editValue) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

          {/* 修改密码 */}
          <div className="mt-6 pt-5 border-t p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
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
                  placeholder="至少4位"
                />
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
              disabled={changingPassword}
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
