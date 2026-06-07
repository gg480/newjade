'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertCircle, Share2, Camera, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { metalApi } from '@/lib/api';
import type { CompetitorPrice } from '@/lib/api.types';

interface CompetitorCompareDialogProps {
  open: boolean;
  onClose: () => void;
  ourPrice: number;
  ourName: string;
}

// ── 图表绘制参数（紧凑设计）──
const BAR_HEIGHT = 24;
const BAR_GAP = 6;
const LABEL_WIDTH = 80;
const VALUE_WIDTH = 56;
const PADDING_LEFT = LABEL_WIDTH + 8;
const PADDING_RIGHT = VALUE_WIDTH + 12;
const PADDING_TOP = 28;    // 顶部留出飾金標題行空間
const PADDING_BOTTOM = 12;
const CHART_MIN_HEIGHT = 140;

// ── 海报参数 ──
const POSTER_WIDTH = 750;   // px, 适合手机竖屏分享

export default function CompetitorCompareDialog({
  open,
  onClose,
  ourPrice,
  ourName,
}: CompetitorCompareDialogProps) {
  const { handleError } = useErrorHandler();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const posterCanvasRef = useRef<HTMLCanvasElement>(null);
  const [competitors, setCompetitors] = useState<CompetitorPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // ── 从 API 数据中提取实际数据日期（竞品数据的 date 字段）──
  const dataDate = React.useMemo(() => {
    const dates = competitors
      .map((c) => c.date)
      .filter((d): d is string => !!d && d !== '-');
    if (dates.length === 0) return null;
    // 取出现次数最多的日期
    const counts = new Map<string, number>();
    dates.forEach((d) => counts.set(d, (counts.get(d) || 0) + 1));
    let maxDate = '';
    let maxCount = 0;
    counts.forEach((cnt, dt) => {
      if (cnt > maxCount) { maxCount = cnt; maxDate = dt; }
    });
    return maxDate || null;
  }, [competitors]);

  // ── 加载数据 ──
  async function loadCompetitors() {
    setLoading(true);
    setError(null);
    try {
      const data = await metalApi.getCompetitors();
      setCompetitors(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载竞品数据失败');
      handleError(err, { title: '加载竞品数据失败', silent: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadCompetitors();
  }, [open]);

  function handleClose() {
    onClose();
  }

  // ── 用 ResizeObserver 持续追踪容器宽度 ──
  // 注意：
  //   1. 必须依赖 loading：弹窗先显示 loading（容器未渲染），数据加载完成后才出现
  //   2. 必须依赖 competitors：数据变更后重新测量，确保 canvas 拿到正确宽度
  //   3. requestAnimationFrame 后备：防止弹窗过渡动画导致 clientWidth 为 0
  useEffect(() => {
    if (!open || loading || !containerRef.current) return;
    const el = containerRef.current;

    function doMeasure(w?: number) {
      const width = w ?? el.clientWidth;
      if (width > 0) {
        setChartWidth(Math.floor(width));
      }
    }

    // 初始测量（同步取，可能在布局完成前，宽为 0）
    doMeasure();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        doMeasure(w);
      }
    });
    ro.observe(el);

    // 后备：下一帧再测一次（弹窗过渡动画完成后布局才稳定）
    const raf = requestAnimationFrame(() => doMeasure());

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [open, loading, competitors]);

  // ── 组装条形数据 ──
  const allBars = useCallback(() => {
    const safeOurPrice = Number.isFinite(ourPrice) ? ourPrice : 0;
    return [
      { label: ourName || '兴盛艺珠宝', price: safeOurPrice, isOurs: true },
      ...competitors.map((c) => ({
        label: c.name,
        price: typeof c.gold === 'number' && Number.isFinite(c.gold) ? c.gold : 0,
        isOurs: false,
      })),
    ].sort((a, b) => a.price - b.price);
  }, [ourPrice, ourName, competitors]);

  // ── 计算本店比均价省多少 ──
  const savingsInfo = useCallback(() => {
    const bars = allBars();
    const our = bars.find((b) => b.isOurs);
    const others = bars.filter((b) => !b.isOurs);
    if (!our || others.length === 0) return null;
    const avgOther = others.reduce((s, b) => s + b.price, 0) / others.length;
    const diff = Math.round((avgOther - our.price) * 100) / 100;
    return { avgOther, diff, isCheaper: diff > 0 };
  }, [allBars]);

  // ── 绘制条形图 ──
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartWidth === 0) return;

    const bars = allBars();
    const totalBars = bars.length;
    const chartHeight = Math.max(
      CHART_MIN_HEIGHT,
      PADDING_TOP + totalBars * (BAR_HEIGHT + BAR_GAP) + PADDING_BOTTOM,
    );

    const dpr = window.devicePixelRatio || 1;
    canvas.width = chartWidth * dpr;
    canvas.height = chartHeight * dpr;
    canvas.style.width = `${chartWidth}px`;
    canvas.style.height = `${chartHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // ── 背景 ──
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chartWidth, chartHeight);

    // ── 空数据 ──
    if (bars.length <= 1) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无竞品数据', chartWidth / 2, chartHeight / 2);
      return;
    }

    const maxPrice = Math.max(...bars.map((b) => b.price), 1);
    const chartRight = chartWidth - PADDING_RIGHT;
    const usableWidth = chartRight - PADDING_LEFT - 8;

    // ── 顶部标题行：饰金 + 数据日期 ──
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('饰金零售价（元/克）', PADDING_LEFT, 4);
    if (dataDate) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(dataDate, chartRight + PADDING_RIGHT - 4, 4);
    }

    // ── 绘制每条条形 ──
    bars.forEach((bar, index) => {
      const y = PADDING_TOP + index * (BAR_HEIGHT + BAR_GAP);
      const barW = Math.max((bar.price / maxPrice) * usableWidth, 4);

      // 标签
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bar.isOurs ? '#92400e' : '#6b7280';
      ctx.font = bar.isOurs ? 'bold 12px sans-serif' : '11px sans-serif';
      const label = bar.label.length > 6 ? bar.label.slice(0, 5) + '…' : bar.label;
      ctx.fillText(label, PADDING_LEFT - 6, y + BAR_HEIGHT / 2);

      // 条形本体
      const barX = PADDING_LEFT;
      const barY = y;
      const r = 4;

      ctx.beginPath();
      ctx.moveTo(barX + r, barY);
      ctx.lineTo(barX + barW - r, barY);
      ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + r);
      ctx.lineTo(barX + barW, barY + BAR_HEIGHT - r);
      ctx.quadraticCurveTo(barX + barW, barY + BAR_HEIGHT, barX + barW - r, barY + BAR_HEIGHT);
      ctx.lineTo(barX + r, barY + BAR_HEIGHT);
      ctx.quadraticCurveTo(barX, barY + BAR_HEIGHT, barX, barY + BAR_HEIGHT - r);
      ctx.lineTo(barX, barY + r);
      ctx.quadraticCurveTo(barX, barY, barX + r, barY);
      ctx.closePath();

      if (bar.isOurs) {
        const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, '#d97706');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.25)';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      } else {
        const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        grad.addColorStop(0, '#dbeafe');
        grad.addColorStop(1, '#93c5fd');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // 价格数值
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bar.isOurs ? '#92400e' : '#1e40af';
      ctx.font = bar.isOurs ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.fillText(`¥${bar.price.toFixed(0)}`, barX + barW + 6, y + BAR_HEIGHT / 2);

      // 本店高亮：左侧装饰条
      if (bar.isOurs) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(barX - 3, barY + 3, 2, BAR_HEIGHT - 6);
      }
    });
  }, [chartWidth, allBars, dataDate]);

  // ── 数据或宽度变化时重绘 ──
  useEffect(() => {
    if (!loading && chartWidth > 0 && competitors.length > 0) {
      drawChart();
    }
  }, [loading, chartWidth, drawChart, competitors]);

  // ── 空数据时也重绘（显示"暂无竞品数据"） ──
  useEffect(() => {
    if (!loading && chartWidth > 0 && competitors.length === 0) {
      drawChart();
    }
  }, [loading, chartWidth, drawChart, competitors]);

  // ── 导出图表 ──
  const handleExportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { toast.error('图表未就绪'); return; }
    try {
      const link = document.createElement('a');
      link.download = `竞品对比_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('图片已导出');
    } catch (err) {
      handleError(err, { title: '导出失败', silent: true });
    }
  }, [handleError]);

  // ═══════════════════════════════════════════
  //  朋友圈分享海报（营销视角设计）
  // ═══════════════════════════════════════════
  //
  //  受众分析：朋友圈刷到的朋友，前3秒决定看不看
  //  传达顺序：① 今日金价多少钱 ② 本店更便宜 ③ 省多少
  //  设计调性：精品/温暖/可信赖，像一张精致的金价播报卡
   //
  const generatePoster = useCallback(() => {
    const pc = posterCanvasRef.current;
    if (!pc) return;

    const bars = allBars();
    const info = savingsInfo();
    const W = POSTER_WIDTH;
    // 固定高度：保证每张海报比例一致，视觉干净
    const H = 1100;

    const dpr = window.devicePixelRatio || 1;
    pc.width = W * dpr;
    pc.height = H * dpr;
    pc.style.width = `${W}px`;
    pc.style.height = `${H}px`;

    const ctx = pc.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // ─────────────────────────────────────────
    // 1. 背景：深琥珀→暖白渐变（精品感）
    // ─────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#3d1f0a');
    bgGrad.addColorStop(0.25, '#6b3a1a');
    bgGrad.addColorStop(0.45, '#a67c52');
    bgGrad.addColorStop(0.55, '#d4a84b');
    bgGrad.addColorStop(0.65, '#f5e6d3');
    bgGrad.addColorStop(1, '#fef8f0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── 装饰：细微金点 ──
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * W;
      const y = Math.random() * (H * 0.5);
      const r = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 120, ${0.1 + Math.random() * 0.15})`;
      ctx.fill();
    }

    // ─────────────────────────────────────────
    // 2. 顶部品牌条
    // ─────────────────────────────────────────
    // 顶部金色分隔线
    ctx.fillStyle = 'rgba(212, 168, 75, 0.6)';
    ctx.fillRect(0, 26, W, 1);
    ctx.fillStyle = 'rgba(212, 168, 75, 0.3)';
    ctx.fillRect(0, 28, W, 1);

    // 店名
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef8f0';
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(ourName, W / 2, 14);

    // ─────────────────────────────────────────
    // 3. 核心价格区（视觉焦点）
    // ─────────────────────────────────────────
    // "每日金价" 小标签
    ctx.fillStyle = 'rgba(254, 248, 240, 0.7)';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText('✦ 每日饰金价 ✦', W / 2, 70);

    // 大价格数字（视觉锚点）
    ctx.fillStyle = '#fef8f0';
    ctx.font = 'bold 80px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`¥${ourPrice.toFixed(0)}`, W / 2, 148);

    // 元/克 标签
    ctx.fillStyle = 'rgba(254, 248, 240, 0.6)';
    ctx.font = '16px "PingFang SC", sans-serif';
    ctx.fillText('元 / 克', W / 2, 185);

    // ─────────────────────────────────────────
    // 4. 省钱标签（营销核心信息）
    // ─────────────────────────────────────────
    if (info && info.isCheaper) {
      const badgeY = 220;
      const badgePadding = 16;
      const badgeText = `每克省 ¥${info.diff.toFixed(0)}`;
      ctx.font = 'bold 22px "PingFang SC", sans-serif';
      const tw = ctx.measureText(badgeText).width;
      const badgeW = tw + badgePadding * 2 + 28; // +28 for the fire emoji space
      const badgeX = (W - badgeW) / 2;
      const badgeH = 46;

      // 红色醒目标签
      const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
      badgeGrad.addColorStop(0, '#dc2626');
      badgeGrad.addColorStop(1, '#b91c1c');
      ctx.fillStyle = badgeGrad;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 23);
      ctx.fill();

      // 阴影
      ctx.shadowColor = 'rgba(220, 38, 38, 0.3)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 标签文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🔥 ${badgeText}`, W / 2, badgeY + badgeH / 2);

      // 标签下方小字
      ctx.fillStyle = 'rgba(254, 248, 240, 0.65)';
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.fillText('比各大品牌饰金零售均价更划算', W / 2, badgeY + badgeH + 22);
    }

    // ─────────────────────────────────────────
    // 5. 价格对比条（简化为只显示本店 vs 竞品均价）
    // ─────────────────────────────────────────
    const comparisonY = info && info.isCheaper ? 330 : 260;
    const barLeft = 90;
    const barRight = W - 90;
    const barUsable = barRight - barLeft;

    // 小标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6b3a1a';
    ctx.font = '15px "PingFang SC", sans-serif';
    ctx.fillText('价格对比', W / 2, comparisonY);

    // 分隔线
    ctx.fillStyle = 'rgba(166, 124, 82, 0.2)';
    ctx.fillRect(barLeft, comparisonY + 16, barUsable, 1);

    if (bars.length > 1) {
      // 计算竞品均价
      const competitorsBars = bars.filter((b) => !b.isOurs);
      const avgPrice = competitorsBars.reduce((s, b) => s + b.price, 0) / competitorsBars.length;
      const ourBar = bars.find((b) => b.isOurs)!;
      const maxP = Math.max(ourBar.price, avgPrice, 1);

      // 只画两条：本店 + 竞品均价
      const comparisonBars = [
        { label: ourName, price: ourBar.price, isOurs: true },
        { label: '竞品均价', price: Math.round(avgPrice), isOurs: false },
      ];

      const startY = comparisonY + 36;
      const singleBarH = 40;
      const gap = 16;

      comparisonBars.forEach((bar, i) => {
        const y = startY + i * (singleBarH + gap);
        const barW = Math.max((bar.price / maxP) * barUsable, 10);

        // 标签
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = bar.isOurs ? '#6b3a1a' : '#6b7280';
        ctx.font = bar.isOurs ? 'bold 15px "PingFang SC", sans-serif' : '14px "PingFang SC", sans-serif';
        ctx.fillText(bar.label, barLeft - 10, y + singleBarH / 2);

        // 条
        ctx.beginPath();
        const bx = barLeft;
        const by = y;
        const brr = 6;
        ctx.moveTo(bx + brr, by);
        ctx.lineTo(bx + barW - brr, by);
        ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + brr);
        ctx.lineTo(bx + barW, by + singleBarH - brr);
        ctx.quadraticCurveTo(bx + barW, by + singleBarH, bx + barW - brr, by + singleBarH);
        ctx.lineTo(bx + brr, by + singleBarH);
        ctx.quadraticCurveTo(bx, by + singleBarH, bx, by + singleBarH - brr);
        ctx.lineTo(bx, by + brr);
        ctx.quadraticCurveTo(bx, by, bx + brr, by);
        ctx.closePath();

        if (bar.isOurs) {
          const g = ctx.createLinearGradient(bx, by, bx + barW, by);
          g.addColorStop(0, '#d4a84b');
          g.addColorStop(1, '#b8860b');
          ctx.fillStyle = g;
          ctx.shadowColor = 'rgba(212, 168, 75, 0.3)';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#d1d5db';
          ctx.fill();
        }

        // 价格
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = bar.isOurs ? '#5c2e0a' : '#6b7280';
        ctx.font = bar.isOurs ? 'bold 14px sans-serif' : '14px sans-serif';
        ctx.fillText(`¥${bar.price.toFixed(0)}`, bx + barW + 8, y + singleBarH / 2);
      });

      // 差价箭头标注
      if (info && info.isCheaper) {
        const diffY = startY + 2 * (singleBarH + gap) + 8;
        const arrowStart = barLeft + ((ourBar.price - 10) / maxP) * barUsable;
        const arrowEnd = barLeft + ((avgPrice + 10) / maxP) * barUsable;

        // 差价连线
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(arrowStart, diffY);
        ctx.lineTo(arrowEnd, diffY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 两端箭头
        ctx.fillStyle = 'rgba(220, 38, 38, 0.5)';
        // 左箭头
        ctx.beginPath();
        ctx.moveTo(arrowStart, diffY);
        ctx.lineTo(arrowStart + 6, diffY - 4);
        ctx.lineTo(arrowStart + 6, diffY + 4);
        ctx.closePath();
        ctx.fill();
        // 右箭头
        ctx.beginPath();
        ctx.moveTo(arrowEnd, diffY);
        ctx.lineTo(arrowEnd - 6, diffY - 4);
        ctx.lineTo(arrowEnd - 6, diffY + 4);
        ctx.closePath();
        ctx.fill();

        // 差价数值
        ctx.fillStyle = '#dc2626';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`差价 ¥${info.diff.toFixed(0)}`, (arrowStart + arrowEnd) / 2, diffY - 14);
      }
    } else {
      // 只有本店，无竞品数据
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText('暂无竞品对比数据', W / 2, comparisonY + 50);
    }

    // ─────────────────────────────────────────
    // 6. 底部信息区（干净简洁）
    // ─────────────────────────────────────────
    const footerY = H - 40;

    // 底线装饰
    ctx.fillStyle = 'rgba(212, 168, 75, 0.3)';
    ctx.fillRect(W / 2 - 60, footerY - 14, 120, 1);

    // 日期
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(107, 58, 26, 0.5)';
    ctx.font = '13px "PingFang SC", sans-serif';
    ctx.fillText(
      `数据 · ${dataDate || new Date().toLocaleDateString('zh-CN')}`,
      W / 2,
      footerY,
    );

    // 信任提示小字
    ctx.fillStyle = 'rgba(107, 58, 26, 0.3)';
    ctx.font = '11px sans-serif';
    ctx.fillText('数据来源：各品牌官方饰金零售价', W / 2, footerY + 20);
  }, [allBars, savingsInfo, ourName, ourPrice, dataDate]);

  // ── 保存海报到本地 ──
  const handleSavePoster = useCallback(() => {
    const pc = posterCanvasRef.current;
    if (!pc) { toast.error('海报生成中，请稍候'); return; }
    try {
      generatePoster();
      // 给 Canvas 渲染一点时间
      setTimeout(() => {
        const link = document.createElement('a');
        link.download = `金价对比_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = pc.toDataURL('image/png');
        link.click();
        toast.success('分享海报已生成，快去发朋友圈吧！');
      }, 100);
    } catch (err) {
      handleError(err, { title: '生成海报失败', silent: true });
    }
  }, [generatePoster, handleError]);

  // ── 预览海报（在新标签页打开） ──
  const handlePreviewPoster = useCallback(() => {
    const pc = posterCanvasRef.current;
    if (!pc) { toast.error('海报生成中，请稍候'); return; }
    try {
      generatePoster();
      setTimeout(() => {
        const dataUrl = pc.toDataURL('image/png');
        window.open(dataUrl, '_blank');
      }, 100);
    } catch (err) {
      handleError(err, { title: '预览失败', silent: true });
    }
  }, [generatePoster, handleError]);

  // ── 计算高度 ──
  const totalBars = 1 + (competitors ? competitors.length : 0);
  const dynamicHeight = Math.max(CHART_MIN_HEIGHT, PADDING_TOP + totalBars * (BAR_HEIGHT + BAR_GAP) + PADDING_BOTTOM);

  const info = savingsInfo();

  return (
    <>
      {/* 隐藏的海报 Canvas */}
      <canvas ref={posterCanvasRef} style={{ display: 'none' }} />

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[80vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="text-amber-500">📊</span>
              竞品饰金价对比
              {dataDate && (
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {dataDate}
                </span>
              )}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              数据来源：探数API · 各品牌饰金零售价
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">加载竞品数据中...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground bg-gray-50 rounded-lg">
              <AlertCircle className="h-6 w-6 mb-2 text-red-400" />
              <span className="text-sm mb-2">{error}</span>
              <Button variant="link" size="sm" onClick={loadCompetitors}>
                重新加载
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* ── 省多少钱提示条 ── */}
              {info && info.isCheaper && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-4 bg-gradient-to-r from-amber-50 via-amber-100 to-amber-50 rounded-lg border border-amber-200">
                  <span className="text-base">🎉</span>
                  <span className="text-sm font-medium text-amber-900">
                    兴盛艺珠宝比竞品均价 <span className="text-red-600 font-bold">每克省 ¥{info.diff.toFixed(2)}</span>
                  </span>
                </div>
              )}

              {/* ── 条形图 ── */}
              <div
                ref={containerRef}
                className="overflow-hidden bg-white border border-gray-100 rounded-xl shadow-sm"
              >
                <canvas
                  ref={canvasRef}
                  style={{ width: chartWidth || 1, height: dynamicHeight }}
                  className="rounded-xl block"
                />
              </div>

              {/* ── 操作栏 ── */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-r from-amber-400 to-amber-600" />
                    兴盛艺珠宝
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-r from-blue-300 to-blue-400" />
                    竞品
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleExportImage}>
                    <Download className="h-3 w-3 mr-1" />
                    图表
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-amber-700 border-amber-200 hover:bg-amber-50" onClick={handlePreviewPoster}>
                    <Camera className="h-3 w-3 mr-1" />
                    预览
                  </Button>
                  <Button size="sm" className="h-7 text-xs px-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white border-0" onClick={handleSavePoster}>
                    <Share2 className="h-3 w-3 mr-1" />
                    分享
                  </Button>
                </div>
              </div>

              {/* ── 竞品详情表格（可折叠）── */}
              {competitors.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowDetails((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium">
                      查看各品牌详细数据（{competitors.length} 家）
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showDetails && (
                    <div className="overflow-x-auto max-h-56 overflow-y-auto border-t">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/80 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium w-28">店铺</th>
                            <th className="text-right px-3 py-2 font-medium w-24">饰金价</th>
                            <th className="text-right px-3 py-2 font-medium w-20">金条</th>
                            <th className="text-right px-3 py-2 font-medium w-20">铂金</th>
                            <th className="text-right px-3 py-2 font-medium w-20">日期</th>
                          </tr>
                        </thead>
                        <tbody>
                          {competitors.map((c, i) => (
                            <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-1.5 font-medium truncate max-w-[100px]">{c.name}</td>
                              <td className="px-3 py-1.5 text-right font-mono">¥{c.gold.toFixed(0)}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                {c.goldbar && c.goldbar !== '-' ? `¥${c.goldbar}` : '-'}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                {c.platinum && c.platinum !== '-' ? `¥${c.platinum}` : '-'}
                              </td>
                              <td className="px-3 py-1.5 text-right text-muted-foreground">{c.date || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {competitors.length === 0 && !loading && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  暂无竞品数据
                </div>
              )}
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
