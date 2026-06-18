'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Save, Wifi, Loader2, KeyRound, Server, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { promotionApi, contentApi } from '@/lib/api';
import type { AIConfig, UpdateAIConfigRequest } from '@/types/promotion';

// 后端返回的配置响应：API Key 脱敏 + 配置标志 + 可能的执行时间（后端尚未实现，预留字段）
type AIConfigResponse = AIConfig & {
  openclawApiKeyConfigured: boolean;
  baiduApiKeyConfigured: boolean;
  lastExecutionTime?: string;
};

// 密码输入框：带显示/隐藏切换，复用于两个 API Key 输入
function PasswordInput({ id, value, onChange, show, onToggle, placeholder }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button type="button" variant="outline" size="icon" onClick={onToggle}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// 格式化最近执行时间：无值时显示"未执行"
function formatLastExecutionTime(time?: string): string {
  if (!time) return '未执行';
  try {
    return new Date(time).toLocaleString('zh-CN');
  } catch {
    return '未执行';
  }
}

// OpenClaw 配置卡片：API Key + 服务地址 + 最近执行时间 + 测试连接
function OpenClawConfigCard({ config, form, setForm, showKey, setShowKey, onTest, testing }: {
  config: AIConfigResponse | null;
  form: UpdateAIConfigRequest;
  setForm: React.Dispatch<React.SetStateAction<UpdateAIConfigRequest>>;
  showKey: boolean;
  setShowKey: React.Dispatch<React.SetStateAction<boolean>>;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          OpenClaw 配置
        </CardTitle>
        <CardDescription>配置 OpenClaw AI 服务的连接信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="openclaw-api-key">API Key</Label>
          <PasswordInput
            id="openclaw-api-key"
            value={form.openclawApiKey || ''}
            onChange={v => setForm(f => ({ ...f, openclawApiKey: v }))}
            show={showKey}
            onToggle={() => setShowKey(!showKey)}
            placeholder={config?.openclawApiKeyConfigured ? '已配置（输入新值覆盖）' : '未配置'}
          />
          {config?.openclawApiKeyConfigured && (
            <p className="text-xs text-muted-foreground">当前已配置 API Key</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="openclaw-base-url">服务地址</Label>
          <Input
            id="openclaw-base-url"
            type="text"
            value={form.openclawBaseUrl || ''}
            onChange={e => setForm(f => ({ ...f, openclawBaseUrl: e.target.value }))}
            placeholder="http://localhost:3000"
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>最近执行时间：</span>
            <Badge variant="outline">{formatLastExecutionTime(config?.lastExecutionTime)}</Badge>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wifi className="h-4 w-4 mr-1" />}
            {testing ? '测试中...' : '测试连接'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 百度 API 配置卡片：仅 API Key
function BaiduConfigCard({ config, form, setForm, showKey, setShowKey }: {
  config: AIConfigResponse | null;
  form: UpdateAIConfigRequest;
  setForm: React.Dispatch<React.SetStateAction<UpdateAIConfigRequest>>;
  showKey: boolean;
  setShowKey: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          百度 API 配置
        </CardTitle>
        <CardDescription>配置百度 AI 服务 API Key（用于内容审核等）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="baidu-api-key">API Key</Label>
          <PasswordInput
            id="baidu-api-key"
            value={form.baiduApiKey || ''}
            onChange={v => setForm(f => ({ ...f, baiduApiKey: v }))}
            show={showKey}
            onToggle={() => setShowKey(!showKey)}
            placeholder={config?.baiduApiKeyConfigured ? '已配置（输入新值覆盖）' : '未配置'}
          />
          {config?.baiduApiKeyConfigured && (
            <p className="text-xs text-muted-foreground">当前已配置 API Key</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// AI 配置 Tab 主组件：加载/保存配置，测试 OpenClaw 连接
export default function AIConfigTab() {
  const [config, setConfig] = useState<AIConfigResponse | null>(null);
  const [form, setForm] = useState<UpdateAIConfigRequest>({
    openclawApiKey: '',
    openclawBaseUrl: '',
    baiduApiKey: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showOpenClawKey, setShowOpenClawKey] = useState(false);
  const [showBaiduKey, setShowBaiduKey] = useState(false);

  // 加载配置：API Key 脱敏值不回填到输入框，服务地址用实际值填充
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await promotionApi.config.get();
      setConfig(data);
      setForm({
        openclawApiKey: '',
        openclawBaseUrl: data.openclawBaseUrl,
        baiduApiKey: '',
      });
    } catch (e) {
      toast.error('加载配置失败: ' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 保存配置：只提交非空字段，避免空值覆盖已有配置
  async function handleSave() {
    setSaving(true);
    try {
      const updateData: UpdateAIConfigRequest = {};
      if (form.openclawApiKey) updateData.openclawApiKey = form.openclawApiKey;
      if (form.openclawBaseUrl) updateData.openclawBaseUrl = form.openclawBaseUrl;
      if (form.baiduApiKey) updateData.baiduApiKey = form.baiduApiKey;

      const data = await promotionApi.config.update(updateData);
      setConfig(data);
      setForm({
        openclawApiKey: '',
        openclawBaseUrl: data.openclawBaseUrl,
        baiduApiKey: '',
      });
      toast.success('配置保存成功');
    } catch (e) {
      toast.error('保存配置失败: ' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setSaving(false);
    }
  }

  // 测试连接：调用健康检查端点，反馈 OpenClaw 启用状态
  async function handleTestConnection() {
    setTesting(true);
    try {
      const result = await contentApi.health();
      if (result.status === 'ok') {
        toast.success(`连接成功（OpenClaw ${result.openclawEnabled ? '已启用' : '未启用'}）`);
      } else {
        toast.warning(`状态: ${result.status}`);
      }
    } catch (e) {
      toast.error('连接失败: ' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载配置中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <OpenClawConfigCard
        config={config}
        form={form}
        setForm={setForm}
        showKey={showOpenClawKey}
        setShowKey={setShowOpenClawKey}
        onTest={handleTestConnection}
        testing={testing}
      />
      <BaiduConfigCard
        config={config}
        form={form}
        setForm={setForm}
        showKey={showBaiduKey}
        setShowKey={setShowBaiduKey}
      />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {saving ? '保存中...' : '保存配置'}
        </Button>
      </div>
    </div>
  );
}
