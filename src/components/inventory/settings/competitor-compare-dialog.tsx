'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertCircle } from 'lucide-react';
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

// 条形图绘制参数
const CHART_MIN_HEIGHT = 260;
const BAR_HEIGHT = 28;
const BAR_GAP = 10;
const PADDING_LEFT = 80;
const PADDING_RIGHT = 60;
const PADDING_TOP = 16;

export default function CompetitorCompareDialog({
  open,
  onClose,
  ourPrice,
  ourName,
}: CompetitorCompareDialogProps) {
  const { handleError } = useErrorHandler();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [competitors, setCompetitors] = useState<CompetitorPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

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

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartWidth === 0) return;

    const allBars: { label: string; price: number; isOurs: boolean }[] = [
      { label: ourName || '本店', price: ourPrice, isOurs: true },
      ...competitors.map((c) => ({
        label: c.name,
        price: c.gold,
        isOurs: false,
      })),
    ].sort((a, b) => b.price - a.price);

    const totalBars = allBars.length;
    const chartHeight = Math.max(
      CHART_MIN_HEIGHT,
      PADDING_TOP + totalBars * (BAR_HEIGHT + BAR_GAP) + 24
    );

    const dpr = window.devicePixelRatio || 1;
    canvas.width = chartWidth * dpr;
    canvas.height = chartHeight * dpr;
    canvas.style.width = `${chartWidth}px`;
    canvas.style.height = `${chartHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 白底
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chartWidth, chartHeight);

    // 空数据提示
    if (allBars.length === 1 && competitors.length === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无竞品数据，请先配置竞品信息', chartWidth / 2, chartHeight / 2);
      return;
    }

    const chartAreaRight = chartWidth - PADDING_RIGHT;
    const maxPrice = Math.max(...allBars.map((b) => b.price), 1);

    // 绘制标题行
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('店铺', PADDING_LEFT - 8, PADDING_TOP - 4);
    ctx.textAlign = 'left';
    ctx.fillText('金价(元/克)', PADDING_LEFT, PADDING_TOP - 4);

    // 绘制每条条形
    allBars.forEach((bar, index) => {
      const y = PADDING_TOP + 8 + index * (BAR_HEIGHT + BAR_GAP);
      const maxBarWidth = chartAreaRight - PADDING_LEFT - 52;
      const barWidth = Math.max((bar.price / maxPrice) * maxBarWidth, 4);

      // 标签
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      if (bar.isOurs) {
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 13px sans-serif';
      } else {
        ctx.fillStyle = '#4b5563';
        ctx.font = '12px sans-serif';
      }
      // 截断过长店名
      const label = bar.label.length > 8 ? bar.label.slice(0, 7) + '…' : bar.label;
      ctx.fillText(label, PADDING_LEFT - 8, y + BAR_HEIGHT / 2);

      // 条形
      const barX = PADDING_LEFT;
      const barY = y;
      const radius = 4;

      ctx.beginPath();
      ctx.moveTo(barX + radius, barY);
      ctx.lineTo(barX + barWidth - radius, barY);
      ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
      ctx.lineTo(barX + barWidth, barY + BAR_HEIGHT - radius);
      ctx.quadraticCurveTo(barX + barWidth, barY + BAR_HEIGHT, barX + barWidth - radius, barY + BAR_HEIGHT);
      ctx.lineTo(barX + radius, barY + BAR_HEIGHT);
      ctx.quadraticCurveTo(barX, barY + BAR_HEIGHT, barX, barY + BAR_HEIGHT - radius);
      ctx.lineTo(barX, barY + radius);
      ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
      ctx.closePath();

      if (bar.isOurs) {
        const grad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, '#d97706');
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        grad.addColorStop(0, '#93c5fd');
        grad.addColorStop(1, '#60a5fa');
        ctx.fillStyle = grad;
      }
      ctx.fill();

      // 价格数值
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bar.isOurs ? '#92400e' : '#1e40af';
      ctx.font = bar.isOurs ? 'bold 12px sans-serif' : '12px sans-serif';
      ctx.fillText(
        `¥${bar.price.toFixed(0)}`,
        barX + barWidth + 8,
        y + BAR_HEIGHT / 2
      );
    });
  }, [ourPrice, ourName, competitors, chartWidth]);

  // 测量容器宽度
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0 && w !== chartWidth) {
          setChartWidth(w);
        }
      }
    };
    // 弹窗打开后延迟测量，等待 DOM 渲染完成
    const timer = setTimeout(measure, 100);
    return () => clearTimeout(timer);
  }, [open]);

  // 宽度变化后重绘
  useEffect(() => {
    if (chartWidth > 0) {
      const timer = setTimeout(drawChart, 50);
      return () => clearTimeout(timer);
    }
  }, [chartWidth, drawChart]);

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

  const totalBars = 1 + (competitors ? competitors.length : 0);
  const dynamicHeight = Math.max(CHART_MIN_HEIGHT, PADDING_TOP + totalBars * (BAR_HEIGHT + BAR_GAP) + 24);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-amber-500">📊</span>
            竞品金价对比
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            数据来源：探数API · 各品牌金店零售金价
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">加载竞品数据中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground bg-gray-50 rounded-lg">
            <AlertCircle className="h-6 w-6 mb-2 text-red-400" />
            <span className="text-sm mb-2">{error}</span>
            <Button variant="link" size="sm" onClick={loadCompetitors}>
              重新加载
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 条形图 */}
            <div className="overflow-hidden bg-gray-50/50 rounded-lg" ref={containerRef}>
              <canvas
                ref={canvasRef}
                style={{ width: chartWidth || 1, height: dynamicHeight }}
                className="rounded-md shadow-sm block"
              />
            </div>

            {/* 图例 + 导出 */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
                  本店价格
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />
                  竞品金价
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleExportImage}
              >
                <Download className="h-3 w-3 mr-1" />
                导出图片
              </Button>
            </div>

            {/* 竞品详情表格 */}
            {competitors.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/80 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium w-28">店铺</th>
                        <th className="text-right px-3 py-2 font-medium w-24">金价</th>
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
              </div>
            )}

            {competitors.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无竞品数据
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
