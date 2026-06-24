'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import type { DictMaterial, MarketPriceItem, MetalPrice } from '@/lib/api.types';

// ── 海报参数 ──
const POSTER_W = 750;
const POSTER_H = 1100;
const COLORS = { gold: '#f59e0b', silver: '#6b7280', platinum: '#06b6d4' };

interface DailyShareDialogProps {
  open: boolean;
  onClose: () => void;
  ourName: string;
  preciousMetals: DictMaterial[];
  marketPrices: MarketPriceItem[];
  trendData: Record<string, Array<{ date: string; price: number }>>;
  competitors?: Array<{ name: string; gold: number }>;
}

export default function DailyShareDialog({
  open,
  onClose,
  ourName,
  preciousMetals,
  marketPrices,
  trendData,
  competitors = [],
}: DailyShareDialogProps) {
  const { handleError } = useErrorHandler();
  const canvas1Ref = useRef<HTMLCanvasElement>(null); // 本日报价
  const canvas2Ref = useRef<HTMLCanvasElement>(null); // 价格优势
  const canvas3Ref = useRef<HTMLCanvasElement>(null); // 历史走势
  const [activeTab, setActiveTab] = useState(0);

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayISO = new Date().toISOString().slice(0, 10);

  // ── 获取材质对应的行情价 ──
  function getPrice(m: DictMaterial): MarketPriceItem | undefined {
    return (
      marketPrices.find((p) => p.materialId === m.id) ||
      marketPrices.find((p) => p.code === m.subType)
    );
  }

  // ── 行情码→中文名映射 ──
  const codeNames: Record<string, string> = {
    Au9999: '黄金 Au9999',
    'AgT+D': '白银 Ag(T+D)',
    PT9995: '铂金 Pt9995',
  };

  // ═══════════════════════════════════════
  // POSTER 1: 本日贵金属报价单
  // ═══════════════════════════════════════
  const drawPoster1 = useCallback(() => {
    const c = canvas1Ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = POSTER_W * dpr;
    c.height = POSTER_H * dpr;
    c.style.width = `${POSTER_W}px`;
    c.style.height = `${POSTER_H}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 背景：暖金渐变
    const bg = ctx.createLinearGradient(0, 0, 0, POSTER_H);
    bg.addColorStop(0, '#1a0f00');
    bg.addColorStop(0.3, '#3d1f0a');
    bg.addColorStop(0.6, '#6b3a1a');
    bg.addColorStop(1, '#fef8f0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, POSTER_W, POSTER_H);

    // 装饰金点
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * POSTER_W, Math.random() * POSTER_H * 0.5, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,215,120,${0.08 + Math.random() * 0.12})`;
      ctx.fill();
    }

    // 品牌条
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef8f0';
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(ourName, POSTER_W / 2, 14);

    // 标题
    ctx.fillStyle = 'rgba(254,248,240,0.7)';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText('✦ 本日贵金属报价 ✦', POSTER_W / 2, 65);

    // 日期
    ctx.fillStyle = 'rgba(254,248,240,0.5)';
    ctx.font = '13px "PingFang SC", sans-serif';
    ctx.fillText(today, POSTER_W / 2, 90);

    // 三条贵金属报价卡
    const metals = preciousMetals.filter(m => m.subType && ['Au9999', 'AgT+D', 'PT9995'].includes(m.subType));
    const metalConfigs = [
      { code: 'Au9999', icon: '🥇', unit: '元/克' },
      { code: 'AgT+D', icon: '🥈', unit: '元/克' },
      { code: 'PT9995', icon: '💍', unit: '元/克' },
    ];

    metalConfigs.forEach((cfg, idx) => {
      const cardY = 130 + idx * 130;
      const matched = metals.find(m => m.subType === cfg.code);
      const mp = matched ? getPrice(matched) : undefined;
      const price = mp?.finalPrice ?? mp?.refPrice ?? mp?.price ?? matched?.costPerGram ?? 0;

      // 卡片半透明背景
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(40, cardY, POSTER_W - 80, 110, 12);
      ctx.fill();

      // 金属名
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef8f0';
      ctx.font = 'bold 18px "PingFang SC", sans-serif';
      ctx.fillText(`${cfg.icon} ${codeNames[cfg.code] || cfg.code}`, 60, cardY + 30);

      // 价格
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fef8f0';
      ctx.font = 'bold 48px "PingFang SC", sans-serif';
      ctx.fillText(`¥${price.toFixed(0)}`, POSTER_W - 60, cardY + 50);

      // 单位
      ctx.fillStyle = 'rgba(254,248,240,0.5)';
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText(cfg.unit, POSTER_W - 60, cardY + 80);

      // 小字：数据时间
      if (mp?.updatedAt) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(254,248,240,0.35)';
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText(`数据更新: ${mp.updatedAt}`, 60, cardY + 80);
      }
    });

    // 底部信息
    const footerY = POSTER_H - 60;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(107,58,26,0.4)';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText('数据来源: 上海黄金交易所行情 + 融通金参考', POSTER_W / 2, footerY);
    ctx.fillText(`${ourName} · 每日报价 · 价格透明`, POSTER_W / 2, footerY + 20);
  }, [ourName, preciousMetals, marketPrices, today, codeNames]);

  // ═══════════════════════════════════════
  // POSTER 2: 本店 vs 主流金店价格优势
  // ═══════════════════════════════════════
  const drawPoster2 = useCallback(() => {
    const c = canvas2Ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = POSTER_W * dpr;
    c.height = POSTER_H * dpr;
    c.style.width = `${POSTER_W}px`;
    c.style.height = `${POSTER_H}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, POSTER_H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.3, '#1e293b');
    bg.addColorStop(0.6, '#334155');
    bg.addColorStop(1, '#f8fafc');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, POSTER_W, POSTER_H);

    // 品牌条
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(ourName, POSTER_W / 2, 14);

    // 标题
    ctx.fillStyle = 'rgba(248,250,252,0.7)';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText('✦ 饰金零售价对比 ✦', POSTER_W / 2, 60);

    // 本店金价大数字（优先取 marketRatio=1 的纯金材质）
    const goldMetals = preciousMetals.filter(m => m.subType === 'Au9999');
    const goldMetal = goldMetals.find(m => m.marketRatio === 1) || goldMetals[0];
    const goldMp = goldMetal ? getPrice(goldMetal) : undefined;
    const ourGoldPrice = goldMp?.finalPrice ?? goldMp?.refPrice ?? goldMp?.price ?? goldMetal?.costPerGram ?? 0;

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 64px "PingFang SC", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`¥${ourGoldPrice.toFixed(0)}`, POSTER_W / 2, 130);
    ctx.fillStyle = 'rgba(248,250,252,0.5)';
    ctx.font = '15px "PingFang SC", sans-serif';
    ctx.fillText('元/克 · 本店饰金零售价', POSTER_W / 2, 170);

    // 竞品对比条
    const allBars = [
      { label: ourName, price: ourGoldPrice, isOurs: true },
      ...competitors.map(c => ({ label: c.name, price: c.gold, isOurs: false })),
    ].sort((a, b) => a.price - b.price);

    if (allBars.length > 1) {
      // 有竞品数据：展示完整对比
      const maxP = Math.max(...allBars.map(b => b.price), 1);
      const barLeft = 80;
      const barRight = POSTER_W - 100;
      const barUsable = barRight - barLeft;
      const startY = 210;
      const barH = 24;
      const gap = 6;

      // 小标题
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(248,250,252,0.5)';
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.fillText('各品牌饰金售价对比（元/克）', POSTER_W / 2, startY - 8);

      // 分隔线
      ctx.fillStyle = 'rgba(148,163,184,0.2)';
      ctx.fillRect(barLeft, startY + 4, barUsable, 1);

      // 显示前6条
      const topBars = allBars.slice(0, 6);
      topBars.forEach((bar, i) => {
        const y = startY + 18 + i * (barH + gap);
        const barW = Math.max((bar.price / maxP) * barUsable, 8);

        // 排名
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = bar.isOurs ? '#f59e0b' : '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${i + 1}`, barLeft - 24, y + barH / 2);

        // 标签
        const label = bar.label.length > 5 ? bar.label.slice(0, 4) + '…' : bar.label;
        ctx.fillStyle = bar.isOurs ? '#fef8f0' : '#cbd5e1';
        ctx.font = bar.isOurs ? 'bold 12px "PingFang SC", sans-serif' : '11px "PingFang SC", sans-serif';
        ctx.fillText(bar.isOurs ? `★ ${label}` : label, barLeft - 6, y + barH / 2);

        // 条
        ctx.beginPath();
        const bx = barLeft;
        const by = y;
        ctx.moveTo(bx + 3, by);
        ctx.lineTo(bx + barW - 3, by);
        ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + 3);
        ctx.lineTo(bx + barW, by + barH - 3);
        ctx.quadraticCurveTo(bx + barW, by + barH, bx + barW - 3, by + barH);
        ctx.lineTo(bx + 3, by + barH);
        ctx.quadraticCurveTo(bx, by + barH, bx, by + barH - 3);
        ctx.lineTo(bx, by + 3);
        ctx.quadraticCurveTo(bx, by, bx + 3, by);
        ctx.closePath();

        if (bar.isOurs) {
          const g = ctx.createLinearGradient(bx, by, bx + barW, by);
          g.addColorStop(0, '#f59e0b');
          g.addColorStop(1, '#d97706');
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = '#475569';
        }
        ctx.fill();

        // 价格
        ctx.textAlign = 'left';
        ctx.fillStyle = bar.isOurs ? '#fbbf24' : '#94a3b8';
        ctx.font = bar.isOurs ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.fillText(`¥${bar.price.toFixed(0)}`, bx + barW + 5, y + barH / 2);
      });

      // 省钱信息
      const ourBar = allBars.find(b => b.isOurs)!;
      const others = allBars.filter(b => !b.isOurs);
      const avgOther = others.reduce((s, b) => s + b.price, 0) / others.length;
      const diff = avgOther - ourBar.price;
      const pctSave = avgOther > 0 ? (diff / avgOther * 100) : 0;
      const rankY = startY + 20 + topBars.length * (barH + gap) + 16;

      if (diff > 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 15px "PingFang SC", sans-serif';
        ctx.fillText(
          `🔥 本店饰金价比主流金店售价低 ¥${diff.toFixed(0)}（${pctSave.toFixed(1)}%）`,
          POSTER_W / 2,
          rankY,
        );
        ctx.fillStyle = 'rgba(248,250,252,0.4)';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.fillText(
          `共对比 ${allBars.length} 家品牌 · ${ourName} 价格排名第 ${allBars.findIndex(b => b.isOurs) + 1} 位`,
          POSTER_W / 2,
          rankY + 22,
        );
      }
    } else {
      // 无竞品数据：仅展示本店价格
      const msgY = 260;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(248,250,252,0.4)';
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText('暂无竞品对比数据', POSTER_W / 2, msgY);
      ctx.fillText('本店饰金价实惠透明，欢迎比价', POSTER_W / 2, msgY + 24);
    }

    // 白银/铂金简要对比
    const otherMetals = preciousMetals.filter(m => m.subType && ['AgT+D', 'PT9995'].includes(m.subType));
    if (otherMetals.length > 0) {
      const otherY = POSTER_H - 200;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(248,250,252,0.4)';
      ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText('其他贵金属本店售价', POSTER_W / 2, otherY);

      otherMetals.forEach((m, i) => {
        const mp = getPrice(m);
        const price = mp?.finalPrice ?? mp?.refPrice ?? mp?.price ?? m.costPerGram ?? 0;
        const x = POSTER_W / 2 - 80 + i * 160;
        const y = otherY + 30;

        // 小卡片
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.roundRect(x - 50, y - 15, 100, 45, 8);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px "PingFang SC", sans-serif';
        ctx.fillText(`¥${price.toFixed(0)}`, x, y + 5);
        ctx.fillStyle = 'rgba(248,250,252,0.5)';
        ctx.font = '11px sans-serif';
        const shortName = m.subType === 'AgT+D' ? '白银/克' : '铂金/克';
        ctx.fillText(shortName, x, y + 28);
      });
    }

    // 底部
    const footerY = POSTER_H - 60;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148,163,184,0.3)';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(`数据来源: 各品牌官方饰金零售价 · ${today}`, POSTER_W / 2, footerY);
    ctx.fillText(`${ourName} · 每日饰金价对比 · 价格透明`, POSTER_W / 2, footerY + 18);
  }, [ourName, preciousMetals, marketPrices, competitors, today]);

  // ═══════════════════════════════════════
  // POSTER 3: 历史走势 + 今日行情
  // ═══════════════════════════════════════
  const drawPoster3 = useCallback(() => {
    const c = canvas3Ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = POSTER_W * dpr;
    c.height = POSTER_H * dpr;
    c.style.width = `${POSTER_W}px`;
    c.style.height = `${POSTER_H}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, POSTER_H);
    bg.addColorStop(0, '#0c0a09');
    bg.addColorStop(0.25, '#1c1917');
    bg.addColorStop(0.5, '#292524');
    bg.addColorStop(1, '#fafaf9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, POSTER_W, POSTER_H);

    // 品牌
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fafaf9';
    ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(ourName, POSTER_W / 2, 14);

    // 标题
    ctx.fillStyle = 'rgba(250,250,249,0.6)';
    ctx.font = '13px "PingFang SC", sans-serif';
    ctx.fillText('✦ 贵金属行情走势 ✦', POSTER_W / 2, 55);

    // 今日金价大数字（优先使用最终售价 finalPrice，取 marketRatio=1 纯金材质）
    const goldMetals = preciousMetals.filter(m => m.subType === 'Au9999');
    const goldMetal = goldMetals.find(m => m.marketRatio === 1) || goldMetals[0];
    const goldMp = goldMetal ? getPrice(goldMetal) : undefined;
    const goldPrice = goldMp?.finalPrice ?? goldMp?.refPrice ?? goldMp?.price ?? goldMetal?.costPerGram ?? 0;

    ctx.fillStyle = '#fafaf9';
    ctx.font = 'bold 72px "PingFang SC", sans-serif';
    ctx.fillText(`¥${goldPrice.toFixed(0)}`, POSTER_W / 2, 135);
    ctx.fillStyle = 'rgba(250,250,249,0.5)';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText(`黄金 Au9999 · ${today} 实时行情`, POSTER_W / 2, 175);

    // 走势曲线区域（简化为手绘风格趋势线）
    const chartY = 210;
    const chartH = 200;
    const chartLeft = 60;
    const chartRight = POSTER_W - 40;
    const chartW = chartRight - chartLeft;

    // 图表背景
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(chartLeft - 10, chartY - 10, chartW + 20, chartH + 40, 8);
    ctx.fill();

    // 为每种贵金属绘制走势线
    const codes = ['Au9999', 'AgT+D', 'PT9995'];
    const lineColors: Record<string, string> = { Au9999: '#f59e0b', 'AgT+D': '#9ca3af', PT9995: '#22d3ee' };

    codes.forEach(code => {
      const data = trendData[code];
      if (!data || data.length < 2) return;

      // 找出全局min/max
      const allPrices = data.map(d => d.price);
      const minP = Math.min(...allPrices);
      const maxP = Math.max(...allPrices);
      const range = maxP - minP || 1;

      // 绘制折线
      ctx.strokeStyle = lineColors[code] || '#888';
      ctx.lineWidth = code === 'Au9999' ? 2.5 : 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      data.forEach((point, i) => {
        const x = chartLeft + (i / (data.length - 1)) * chartW;
        const y = chartY + chartH - ((point.price - minP) / range) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 最后一点标注价格
      const last = data[data.length - 1];
      const lx = chartLeft + chartW;
      const ly = chartY + chartH - ((last.price - minP) / range) * chartH;
      ctx.fillStyle = lineColors[code] || '#888';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`¥${last.price.toFixed(0)}`, lx + 4, ly + 4);
    });

    // 图例
    const legendY = chartY + chartH + 30;
    codes.forEach((code, i) => {
      const x = POSTER_W / 2 - 120 + i * 120;
      ctx.fillStyle = lineColors[code] || '#888';
      ctx.fillRect(x - 20, legendY - 2, 16, 3);
      ctx.fillStyle = 'rgba(250,250,249,0.5)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(codeNames[code] || code, x, legendY + 4);
    });

    // 其他金属今日价格
    const otherY = legendY + 40;
    const otherMetals = preciousMetals.filter(m => m.subType && ['AgT+D', 'PT9995'].includes(m.subType));
    otherMetals.forEach((m, i) => {
      const mp = getPrice(m);
      const price = mp?.finalPrice ?? mp?.refPrice ?? mp?.price ?? m.costPerGram ?? 0;
      const x = POSTER_W / 2 - 80 + i * 160;

      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(x - 50, otherY - 12, 100, 38, 6);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fafaf9';
      ctx.font = 'bold 20px "PingFang SC", sans-serif';
      ctx.fillText(`¥${price.toFixed(0)}`, x, otherY + 3);
      ctx.fillStyle = 'rgba(250,250,249,0.45)';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.subType === 'AgT+D' ? '白银/克' : '铂金/克', x, otherY + 22);
    });

    // 底部
    const footerY = POSTER_H - 60;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(120,113,108,0.4)';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(`数据来源: 上海黄金交易所 · ${today}`, POSTER_W / 2, footerY);
    ctx.fillText(`${ourName} · 贵金属行情走势`, POSTER_W / 2, footerY + 18);
  }, [ourName, preciousMetals, marketPrices, trendData, today, codeNames]);

  // ── 所有海报绘制 ──
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      drawPoster1();
      drawPoster2();
      drawPoster3();
    }, 200);
    return () => clearTimeout(timer);
  }, [open, drawPoster1, drawPoster2, drawPoster3]);

  // ── 保存海报 ──
  function handleSave(ref: React.RefObject<HTMLCanvasElement | null>, name: string) {
    const c = ref.current;
    if (!c) { toast.error('海报未就绪'); return; }
    try {
      const link = document.createElement('a');
      link.download = `${name}_${todayISO}.png`;
      link.href = c.toDataURL('image/png');
      link.click();
      toast.success(`${name} 已保存`);
    } catch (err) {
      handleError(err, { title: '保存失败', silent: true });
    }
  }

  const posters = [
    { name: '本日报价', ref: canvas1Ref, desc: '今日贵金属售价一览' },
    { name: '价格优势', ref: canvas2Ref, desc: '本店 vs 主流金店对比' },
    { name: '行情走势', ref: canvas3Ref, desc: '历史走势 + 实时行情' },
  ];

  return (
    <>
      {/* 隐藏的三张海报 Canvas */}
      <canvas ref={canvas1Ref} style={{ display: 'none' }} />
      <canvas ref={canvas2Ref} style={{ display: 'none' }} />
      <canvas ref={canvas3Ref} style={{ display: 'none' }} />

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent className="max-w-md flex flex-col max-h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              📊 每日分享
              <span className="text-xs font-normal text-muted-foreground ml-auto">{today}</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {posters[activeTab].desc}
            </p>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* 海报预览区 */}
            <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg min-h-[240px] relative">
              {/* 切换箭头 */}
              <Button
                size="sm" variant="ghost" className="absolute left-1 z-10 h-8 w-8 p-0"
                disabled={activeTab === 0}
                onClick={() => setActiveTab(prev => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm" variant="ghost" className="absolute right-1 z-10 h-8 w-8 p-0"
                disabled={activeTab === 2}
                onClick={() => setActiveTab(prev => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* 缩略图 */}
              <div
                className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer"
                style={{ width: 180, height: 264 }}
                onClick={() => {
                  const c = posters[activeTab].ref.current;
                  if (c) window.open(c.toDataURL('image/png'), '_blank');
                }}
              >
                <canvas
                  key={activeTab}
                  ref={el => {
                    // 将海报缩小渲染到预览区
                    if (!el) return;
                    const src = posters[activeTab].ref.current;
                    if (!src) return;
                    const dpr = window.devicePixelRatio || 1;
                    el.width = 180 * dpr;
                    el.height = 264 * dpr;
                    el.style.width = '180px';
                    el.style.height = '264px';
                    const ctx2 = el.getContext('2d');
                    if (ctx2) {
                      ctx2.scale(dpr, dpr);
                      ctx2.drawImage(src, 0, 0, 180, 264);
                    }
                  }}
                />
              </div>
            </div>

            {/* 指示器 */}
            <div className="flex items-center justify-center gap-1.5 py-2">
              {posters.map((_, i) => (
                <button
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === activeTab ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                  onClick={() => setActiveTab(i)}
                />
              ))}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-2 pb-2">
              <Button
                size="sm" variant="outline" className="h-8 text-xs"
                onClick={() => {
                  const c = posters[activeTab].ref.current;
                  if (c) window.open(c.toDataURL('image/png'), '_blank');
                }}
              >
                查看大图
              </Button>
              <Button
                size="sm" variant="outline" className="h-8 text-xs"
                onClick={() => handleSave(posters[activeTab].ref, posters[activeTab].name)}
              >
                <Download className="h-3 w-3 mr-1" />
                保存图片
              </Button>
              <Button
                size="sm" className="h-8 text-xs px-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white border-0"
                onClick={() => {
                  // 依次保存三张
                  handleSave(canvas1Ref, '本日报价');
                  setTimeout(() => handleSave(canvas2Ref, '价格优势'), 300);
                  setTimeout(() => handleSave(canvas3Ref, '行情走势'), 600);
                }}
              >
                <Share2 className="h-3 w-3 mr-1" />
                一键保存三张
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
