'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SysConfig } from '@/lib/api.types';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState(() => {
    try {
      if (typeof window === 'undefined') return '兴盛艺珠宝';
      const stored = localStorage.getItem('jade_system_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.storeName) return parsed.storeName;
      }
    } catch {}
    return '兴盛艺珠宝';
  });

  useEffect(() => {
    // Sync store name from server config
    let mounted = true;
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (mounted && data.code === 0 && Array.isArray(data.data)) {
          const cfg = data.data.find((c: SysConfig) => c.key === 'store_name');
          if (cfg?.value) setStoreName(cfg.value);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  const [checking, setChecking] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.code === 0) {
            onLogin(token);
          } else {
            localStorage.removeItem('auth_token');
            setChecking(false);
          }
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
          setChecking(false);
        });
    } else {
      setChecking(false);
    }
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (!password.trim()) {
      toast.error('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();

      if (data.code === 0 && data.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        toast.success(`欢迎回来，${data.data.user?.displayName || username}`);
        onLogin(data.data.token);
      } else {
        toast.error(data.message || '登录失败');
      }
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-jade-600 animate-spin" />
          <p className="text-sm text-muted-foreground">验证登录状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-jade-50/80 via-white to-champagne-50/60 dark:from-jade-950/30 dark:via-background dark:to-champagne-950/20" />
      
      {/* Decorative floating jade shapes — 移动端隐藏节省性能 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        <div className="jade-float-shape jade-shape-1 absolute top-[10%] left-[10%] w-16 h-16 rounded-full bg-jade-200/40 dark:bg-jade-700/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-2 absolute top-[20%] right-[15%] w-12 h-12 rounded-2xl bg-teal-200/30 dark:bg-teal-700/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-3 absolute bottom-[15%] left-[20%] w-20 h-20 rounded-3xl bg-cyan-200/30 dark:bg-cyan-700/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-4 absolute bottom-[25%] right-[10%] w-10 h-10 rounded-full bg-jade-300/30 dark:bg-jade-600/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-5 absolute top-[50%] left-[5%] w-8 h-8 rounded-xl bg-teal-300/20 dark:bg-teal-600/15 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-6 absolute top-[40%] right-[8%] w-14 h-14 rounded-full bg-jade-200/25 dark:bg-jade-800/15 backdrop-blur-sm" />
        {/* Decorative ring — 移动端隐藏 */}
        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-jade-200/30 dark:border-jade-700/20" />
        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-teal-200/20 dark:border-teal-700/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full mx-4 max-w-sm">
        <Card className="shadow-2xl border-jade-200/80 dark:border-jade-800/50 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-2 bg-white/70 dark:bg-gray-900/70 rounded-2xl shadow-lg shadow-jade-500/20 animate-pulse-slow">
                <img src="/logo-xingshengyi.png" alt="兴盛艺珠宝Logo" className="h-14 w-14 rounded-md object-cover" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-noto-serif), var(--font-geist-sans), serif' }}>
              {storeName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">请输入管理密码以登录系统</p>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="输入用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="h-11"
                  autoFocus
                  autoComplete="username"
                  spellCheck={false}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="输入密码…"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pr-10 h-11"
                    autoComplete={showPassword ? 'off' : 'current-password'}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-jade-600" />
                登录后将保持7天会话有效期
              </p>
              <Button
                type="submit"
                className="w-full h-11 bg-jade-600 hover:bg-jade-700 text-white font-medium shadow-lg shadow-jade-500/20 transition-all duration-200"
                disabled={loading || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登 录'
                )}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground/60 mt-6">技术支持: Lrunning</p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
