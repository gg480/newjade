'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { metalApi } from '@/lib/api';
import type { LocalReferencePriceItem } from '@/lib/api.types';

// ============================================================
// 本地参考行情面板（gzjn168.com 融通金）
// 蓝色左边框卡片，展示5大贵金属回购价/销售价
// ============================================================

/** 5 大品类颜色映射 */
const METAL_COLORS: Record<string, string> = {
  '黄金': 'bg-amber-100 text-amber-800',
  '白银': 'bg-gray-100 text-gray-600',
  '铂金': 'bg-slate-100 text-slate-700',
  '钯金': 'bg-cyan-100 text-cyan-700',
  '港金': 'bg-rose-100 text-rose-700',
};

export default function LocalReferencePanel() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [items, setItems] = useState<LocalReferencePriceItem[]>([]);
  const [message, setMessage] = useState('');
  const [lastFetch, setLastFetch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await metalApi.getLocalReference();
      setAvailable(res.available);
      setItems(res.available ? res.items : []);
      setMessage(res.available ? '' : (res.message || '行情源暂时不可用'));
      setLastFetch(res.fetchedAt
        ? new Date(res.fetchedAt).toLocaleTimeString('zh-CN', { hour12: false })
        : '');
    } catch (err) {
      setAvailable(false);
      setItems([]);
      setMessage('行情源暂时不可用');
    } finally {
      setLoading(false);
    }
  }, []); // 仅组件挂载时获取一次，handleError 不在依赖中避免无限循环

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card className="border-l-4 border-l-blue-400 mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            本地参考行情 · 融通金
            {lastFetch && !loading && available && (
              <span className="text-xs font-normal text-muted-foreground">
                {lastFetch}
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1">{loading ? '刷新中' : '刷新'}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 加载中 */}
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        )}

        {/* 不可用 */}
        {!loading && !available && (
          <div className="flex flex-col items-center py-4 text-muted-foreground bg-gray-50 rounded-md">
            <AlertCircle className="h-5 w-5 mb-1" />
            <span className="text-sm">{message || '当前无法获取融通金行情数据'}</span>
            <Button variant="link" size="sm" onClick={fetchData} className="mt-1">
              重新获取
            </Button>
          </div>
        )}

        {/* 数据表格 */}
        {available && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">商品</th>
                  <th className="text-right py-2 font-medium">回购价</th>
                  <th className="text-right py-2 font-medium">销售价</th>
                  <th className="text-right py-2 font-medium">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${METAL_COLORS[item.name] || 'bg-gray-100 text-gray-600'}`}>
                        {item.name}
                      </span>
                    </td>
                    <td className={`py-2 text-right font-mono ${item.buyPrice === 0 ? 'text-muted-foreground' : ''}`}>
                      {item.buyPrice > 0 ? item.buyPrice.toFixed(2) : '--'}
                    </td>
                    <td className={`py-2 text-right font-mono ${item.sellPrice === 0 ? 'text-muted-foreground' : ''}`}>
                      {item.sellPrice > 0 ? item.sellPrice.toFixed(2) : '--'}
                    </td>
                    <td className="py-2 text-right text-muted-foreground font-mono text-xs">
                      {item.updatedAt || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 脚注 */}
        {available && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            数据来源：融通金(gzjn168.com) · 仅供参考
          </p>
        )}
      </CardContent>
    </Card>
  );
}
