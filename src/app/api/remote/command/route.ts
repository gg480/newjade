// 远程指令 API — 接收来自微信/手机浏览器的指令，写入指令队列
// POST /api/remote/command
// Body: { command: string, token: string }

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const QUEUE_DIR = path.join(process.cwd(), '.trae', 'command-queue');
const INBOX_FILE = path.join(QUEUE_DIR, 'inbox.json');
const OUTBOX_FILE = path.join(QUEUE_DIR, 'outbox.json');

// 简单令牌验证（防止未授权访问）
// 必须通过环境变量 REMOTE_TOKEN 配置，无回退默认值
const REMOTE_TOKEN = process.env.REMOTE_TOKEN;

interface CommandEntry {
  id: string;
  command: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  result?: string;
}

function readQueue(filePath: string): CommandEntry[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeQueue(filePath: string, entries: CommandEntry[]): void {
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { command, token } = body;

    // 检查服务是否已配置
    if (!REMOTE_TOKEN) {
      return NextResponse.json(
        { code: 503, data: null, message: '远程指令服务未配置' },
        { status: 503 },
      );
    }

    // 令牌验证
    if (!token || token !== REMOTE_TOKEN) {
      return NextResponse.json(
        { code: 403, data: null, message: '无效令牌' },
        { status: 403 },
      );
    }

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return NextResponse.json(
        { code: 400, data: null, message: '请输入指令' },
        { status: 400 },
      );
    }

    // 创建指令条目
    const entry: CommandEntry = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      command: command.trim(),
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    // 追加到收件箱
    const inbox = readQueue(INBOX_FILE);
    inbox.push(entry);
    writeQueue(INBOX_FILE, inbox);

    return NextResponse.json({
      code: 0,
      data: { id: entry.id, message: '指令已加入队列' },
      message: 'ok',
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, data: null, message: '服务器错误' },
      { status: 500 },
    );
  }
}

// GET — 查看指令状态和结果
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token || token !== REMOTE_TOKEN) {
    return NextResponse.json(
      { code: 403, data: null, message: '无效令牌' },
      { status: 403 },
    );
  }

  const inbox = readQueue(INBOX_FILE);
  const outbox = readQueue(OUTBOX_FILE);

  // 合并 inbox 和 outbox 中的指令状态
  const all = [...inbox, ...outbox].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return NextResponse.json({
    code: 0,
    data: { commands: all.slice(0, 20) }, // 最近 20 条
    message: 'ok',
  });
}
