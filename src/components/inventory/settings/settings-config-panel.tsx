'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, CheckCircle, Search } from 'lucide-react';
import type { SysConfig } from '@/lib/api.types';

interface ConfigPanelProps {
  configs: SysConfig[];
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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConfigs = useMemo(() => {
    const excludedKeys = ['store_name', 'warning_days', 'currency_symbol', 'profit_warning_threshold', 'default_profit_rate'];
    if (!searchQuery.trim()) return configs.filter(c => !excludedKeys.includes(c.key));
    const q = searchQuery.toLowerCase();
    return configs.filter(c => {
      if (excludedKeys.includes(c.key)) return false;
      return c.key.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
    });
  }, [configs, searchQuery]);

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
          {/* 搜索框 */}
          <div className="flex items-center gap-2 mb-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索配置项..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSearchQuery('')}
              >
                清除
              </Button>
            )}
          </div>

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
          {filteredConfigs.map((c) => {
              const editValue = editConfigs[c.key] ?? c.value;
              const valueType = c.valueType ?? 'string';
              const isNumeric = valueType === 'number';
              const isPassword = c.key === 'admin_password';
              // 百分比类配置：值在 0~1 之间，前端显示为百分比
              const isPercent = isNumeric && c.minValue === 0 && c.maxValue !== null && c.maxValue <= 5;
              // 范围提示文本
              const rangeHint = isNumeric && (c.minValue !== null || c.maxValue !== null)
                ? `${c.minValue !== null ? c.minValue : ''} ~ ${c.maxValue !== null ? c.maxValue : ''}${c.unit ?? ''}`
                : null;
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
                    {rangeHint && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        范围: {rangeHint}
                      </p>
                    )}
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
                      min={c.minValue ?? undefined}
                      max={c.maxValue ?? undefined}
                    />
                    {isPercent && (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        ({(parseFloat(editValue) * 100).toFixed(0)}%)
                      </span>
                    )}
                    {c.unit && !isPercent && (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {c.unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
