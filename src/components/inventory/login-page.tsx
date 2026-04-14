'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Gem, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch('/api/auth', {
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
    if (!password.trim()) {
      toast.error('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();

      if (data.code === 0 && data.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        toast.success('登录成功');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-muted-foreground">验证登录状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/40 animate-gradient-bg" />
      
      {/* Decorative floating jade shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="jade-float-shape jade-shape-1 absolute top-[10%] left-[10%] w-16 h-16 rounded-full bg-emerald-200/40 dark:bg-emerald-700/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-2 absolute top-[20%] right-[15%] w-12 h-12 rounded-2xl bg-teal-200/30 dark:bg-teal-700/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-3 absolute bottom-[15%] left-[20%] w-20 h-20 rounded-3xl bg-cyan-200/30 dark:bg-cyan-700/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-4 absolute bottom-[25%] right-[10%] w-10 h-10 rounded-full bg-emerald-300/30 dark:bg-emerald-600/20 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-5 absolute top-[50%] left-[5%] w-8 h-8 rounded-xl bg-teal-300/20 dark:bg-teal-600/15 backdrop-blur-sm" />
        <div className="jade-float-shape jade-shape-6 absolute top-[40%] right-[8%] w-14 h-14 rounded-full bg-emerald-200/25 dark:bg-emerald-800/15 backdrop-blur-sm" />
        {/* Decorative ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-emerald-200/30 dark:border-emerald-700/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-teal-200/20 dark:border-teal-700/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">
        <Card className="shadow-2xl border-emerald-200/80 dark:border-emerald-800/50 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl shadow-lg shadow-emerald-500/30 animate-pulse-slow">
                <Gem className="h-9 w-9 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
              翡翠进销存
            </h1>
            <p className="text-sm text-muted-foreground mt-1">请输入管理密码以登录系统</p>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">管理密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="输入密码"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pr-10 h-11"
                    autoFocus
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
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                登录后将保持7天会话有效期
              </p>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-lg shadow-emerald-500/20 transition-all duration-200"
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
            <p className="text-center text-xs text-muted-foreground/60 mt-6">技术支持: Z.ai</p>
          </CardContent>
        </Card>
      </div>

      {/* Inline styles for animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-bg {
          background-size: 200% 200%;
          animation: gradientShift 15s ease infinite;
        }
        @keyframes pulseSlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.03); }
        }
        .animate-pulse-slow {
          animation: pulseSlow 3s ease-in-out infinite;
        }
        @keyframes floatShape1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes floatShape2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-8deg); }
        }
        @keyframes floatShape3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(3deg); }
        }
        .jade-shape-1 { animation: floatShape1 8s ease-in-out infinite; }
        .jade-shape-2 { animation: floatShape2 10s ease-in-out infinite 1s; }
        .jade-shape-3 { animation: floatShape3 12s ease-in-out infinite 2s; }
        .jade-shape-4 { animation: floatShape1 9s ease-in-out infinite 3s; }
        .jade-shape-5 { animation: floatShape2 11s ease-in-out infinite 0.5s; }
        .jade-shape-6 { animation: floatShape3 7s ease-in-out infinite 1.5s; }
      ` }} />
    </div>
  );
}
