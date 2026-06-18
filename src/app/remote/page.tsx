'use client';

// 远程指挥台 — 手机端页面，通过微信/浏览器远程发送指令到终端
// 访问方式：http://<PC-IP>:5000/remote?token=jade-remote-2026

import { useState, useEffect, useRef, useCallback } from 'react';

interface CommandEntry {
  id: string;
  command: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  result?: string;
}

const TOKEN = 'jade-remote-2026';
const POLL_INTERVAL = 5000; // 5 秒轮询一次状态

export default function RemotePage() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 拉取指令历史
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/remote/command?token=${TOKEN}`);
      const json = await res.json();
      if (json.code === 0) {
        setHistory(json.data.commands);
      }
    } catch {
      // 静默失败
    }
  }, []);

  // 定期轮询
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // 发送指令
  const sendCommand = useCallback(async () => {
    if (!command.trim() || sending) return;
    setSending(true);
    setStatus('发送中...');
    try {
      const res = await fetch('/api/remote/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim(), token: TOKEN }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setStatus(`✅ 已发送: ${json.data.id}`);
        setCommand('');
        fetchHistory();
      } else {
        setStatus(`❌ ${json.message}`);
      }
    } catch {
      setStatus('❌ 网络错误，请检查连接');
    }
    setSending(false);
  }, [command, sending, fetchHistory]);

  // 快速指令模板
  const quickCommands = [
    { label: '📋 查看状态', cmd: '查看当前 Sprint 状态和待办任务' },
    { label: '🔨 编译检查', cmd: '运行 pnpm build 检查编译是否通过' },
    { label: '🧪 运行测试', cmd: '运行 npx playwright test 全量 E2E 回归测试' },
    { label: '📝 代码审查', cmd: '审查最近一次 commit 的代码变更' },
    { label: '🔒 安全检查', cmd: '检查最新变更中的安全问题' },
  ];

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'text-yellow-400';
      case 'processing': return 'text-blue-400';
      case 'done': return 'text-emerald-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending': return '⏳ 等待';
      case 'processing': return '🔄 执行中';
      case 'done': return '✅ 完成';
      case 'failed': return '❌ 失败';
      default: return s;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-3 py-4 max-w-lg mx-auto">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <h1 className="text-base font-semibold">远程指挥台</h1>
        <span className="text-xs text-zinc-500 ml-auto">Sprint-014</span>
      </div>

      {/* 状态提示 */}
      {status && (
        <div className="mb-3 px-3 py-2 bg-zinc-900 rounded-lg text-xs border border-zinc-800">
          {status}
        </div>
      )}

      {/* 输入区 */}
      <div className="mb-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendCommand()}
          placeholder="输入指令，如：查看 Sprint 状态..."
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          autoComplete="off"
        />
        <button
          onClick={sendCommand}
          disabled={sending || !command.trim()}
          className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 active:bg-emerald-700 transition-colors shrink-0"
        >
          {sending ? '...' : '发送'}
        </button>
      </div>

      {/* 快速指令 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {quickCommands.map(qc => (
          <button
            key={qc.label}
            onClick={() => setCommand(qc.cmd)}
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-400 active:bg-zinc-800 active:text-zinc-200 transition-colors"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* 指令历史 */}
      <div className="space-y-2">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">指令历史</h2>
        {history.length === 0 && (
          <p className="text-xs text-zinc-600 py-8 text-center">暂无指令记录</p>
        )}
        {history.map(entry => (
          <div
            key={entry.id}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-zinc-200 break-words flex-1">{entry.command}</p>
              <span className={`text-xs shrink-0 ${statusColor(entry.status)}`}>
                {statusLabel(entry.status)}
              </span>
            </div>
            {entry.result && (
              <p className="mt-1.5 text-xs text-zinc-500 bg-zinc-950 rounded px-2 py-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {entry.result}
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-600">
              {new Date(entry.timestamp).toLocaleTimeString('zh-CN')}
            </p>
          </div>
        ))}
      </div>

      {/* 底部信息 */}
      <div className="mt-6 pt-3 border-t border-zinc-800 text-xs text-zinc-600 text-center">
        指令通过本地 API 队列执行 · 刷新看结果
      </div>
    </div>
  );
}
