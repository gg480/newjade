'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Calculator, History, Activity, TrendingUp, Database, ChevronDown, Loader2, ChartArea, Share2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { metalApi, dictsApi } from '@/lib/api';
import type { DictMaterial, MarketPriceItem, MetalPrice } from '@/lib/api.types';
import { formatPrice } from '../shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CompetitorCompareDialog from './competitor-compare-dialog';
import DailyShareDialog from './daily-share-dialog';
import LocalReferencePanel from './local-reference-panel';
import { useSettings } from './settings-context';

export default function SettingsMetalPanel() {
  const { materials, refreshMaterials } = useSettings();
  const { handleError } = useErrorHandler();

  // 行情价数据（页面加载时获取，用户可手动刷新）
  const [marketPrices, setMarketPrices] = useState<MarketPriceItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLastFetch, setMarketLastFetch] = useState<number>(0);
  const [dataSource, setDataSource] = useState<'auto' | 'gzjn168' | 'tanshu'>('auto');

  // 竞品对比弹窗状态（页面级，不绑定具体材质）
  const [competitorOpen, setCompetitorOpen] = useState(false);
  const [competitorOurPrice, setCompetitorOurPrice] = useState<number>(0);
  const [competitorOurName, setCompetitorOurName] = useState<string>('兴盛艺珠宝');
  const [dailyShareOpen, setDailyShareOpen] = useState(false);
  const [competitorsForShare, setCompetitorsForShare] = useState<Array<{ name: string; gold: number }>>([]);

  // 打开每日分享时自动加载竞品数据
  const handleOpenDailyShare = useCallback(async () => {
    setDailyShareOpen(true);
    try {
      const data = await metalApi.getCompetitors();
      setCompetitorsForShare(data || []);
    } catch {
      // 竞品数据非必需，静默失败
    }
  }, []);

  // 工费编辑状态：materialId -> 输入框中的值（字符串）
  const [laborInputs, setLaborInputs] = useState<Record<number, string>>({});

  // Reprice preview & price history state（原 settings-tab 中定义，现迁入）
  const [repricePreview, setRepricePreview] = useState<{
    materialId?: number;
    newPrice?: number;
    affectedItems: Array<{ itemId: number; skuCode: string; name: string | null; oldPrice: number; newPrice: number }>;
    oldPrice?: number;
  } | null>(null);

  const [priceHistory, setPriceHistory] = useState<MetalPrice[]>([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [priceHistoryMaterial, setPriceHistoryMaterial] = useState('');
  const [priceHistoryPage, setPriceHistoryPage] = useState(1);
  const [priceHistoryTotal, setPriceHistoryTotal] = useState(0);
  const [priceHistoryMaterialId, setPriceHistoryMaterialId] = useState<number>(0);

  // 贵金属行情走势图数据
  const [trendData, setTrendData] = useState<Record<string, Array<{ date: string; price: number }>>>({});
  const [trendRange, setTrendRange] = useState<7 | 30 | 90 | 365>(30);
  const [trendLoading, setTrendLoading] = useState(false);
  const trendColors: Record<string, string> = { Au9999: '#f59e0b', 'AgT+D': '#6b7280', PT9995: '#06b6d4' };

  // 标准行情码：上海黄金交易所可查询的品种
  const STANDARD_MARKET_CODES = new Set(['Au9999', 'PT9995', 'AgT+D']);

  // 过滤：只显示 category === '贵金属' 且有标准行情码的材质
  const preciousMetals = materials.filter(
    (m: DictMaterial) => m.category === '贵金属' && m.subType && STANDARD_MARKET_CODES.has(m.subType)
  );

  // 页面加载时获取行情价（force=true 时强制刷新缓存）
  const fetchMarketPrices = async (source?: 'auto' | 'gzjn168' | 'tanshu', force = false) => {
    setMarketLoading(true);
    try {
      const actualSource = source || dataSource;
      const prices = force
        ? await metalApi.refreshMarketPrices(actualSource)
        : await metalApi.getMarketPrices(actualSource);
      setMarketPrices(prices || []);
      setMarketLastFetch(Date.now());
    } catch (error) {
      handleError(error, { title: '获取行情价失败', silent: true });
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    if (preciousMetals.length > 0) {
      fetchMarketPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动刷新行情价：每5分钟检查一次，9:00/12:00/18:00 窗口内强制刷新
  useEffect(() => {
    if (preciousMetals.length === 0) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const scheduledHours = [9, 12, 18];
      const inWindow = scheduledHours.some(h => hour >= h && hour < h + 1);
      const isStale = Date.now() - marketLastFetch > 5 * 60 * 1000;
      // 在定时窗口内或数据陈旧超过5分钟时自动刷新
      if (inWindow || isStale) {
        fetchMarketPrices(dataSource);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preciousMetals.length, dataSource, marketLastFetch]);
  function getMarketPrice(m: DictMaterial): MarketPriceItem | undefined {
    return (
      marketPrices.find((p) => p.materialId === m.id) ||
      marketPrices.find((p) => p.code === m.subType)
    );
  }

  // 计算最终售价 = 行情价 * marketRatio + 工费
  // 优先使用 API 返回的 finalPrice，行情价不可用时降级到已保存的 costPerGram
  function calcFinalPrice(m: DictMaterial, mp?: MarketPriceItem): number | null {
    // 优先使用 API 已计算好的 finalPrice
    if (mp?.finalPrice != null) return mp.finalPrice;
    // 如果有行情价但没 finalPrice，手动计算
    if (mp && mp.price > 0) {
      const ratio = m.marketRatio ?? 1;
      const laborCost =
        laborInputs[m.id] !== undefined
          ? parseFloat(laborInputs[m.id])
          : m.laborCostPerGram;
      const labor = (laborCost && !isNaN(laborCost)) ? laborCost : 0;
      return Math.round((mp.price * ratio + labor) * 100) / 100;
    }
    // 行情价不可用时，降级到已保存的克价
    if (m.costPerGram != null) return m.costPerGram;
    return null;
  }

  // 保存工费
  async function handleSaveLaborCost(m: DictMaterial) {
    const val = parseFloat(laborInputs[m.id]);
    if (isNaN(val) || val < 0) {
      toast.error('请输入有效的工费');
      return;
    }
    try {
      await metalApi.updateLaborCost({
        materialId: m.id,
        laborCostPerGram: val,
      });
      await refreshMaterials();
      toast.success(`${m.name} 工费已更新为 ¥${val}/克`);
    } catch (error) {
      handleError(error, { title: '保存工费失败', silent: true });
    }
  }

  // 获取行情价并显示到输入框（点击单个材质"获取行情价"按钮时调用）
  async function handleFetchMarket(m: DictMaterial) {
    try {
      const isStale = Date.now() - marketLastFetch > 5 * 60 * 1000;
      let prices = marketPrices;
      // 数据陈旧时强制刷新缓存，确保拿到最新行情
      if (isStale || marketPrices.length === 0) {
        prices = await metalApi.refreshMarketPrices(dataSource);
        setMarketPrices(prices || []);
        setMarketLastFetch(Date.now());
      }
      const match =
        prices.find((p) => p.materialId === m.id) ||
        prices.find((p) => p.code === m.subType);
      if (!match) {
        toast.error(`未找到行情码「${m.subType}」的行情价`);
        return;
      }
      const refPrice = match.refPrice ?? Math.round(match.price * (m.marketRatio ?? 1) * 100) / 100;
      toast.success(
        `已获取行情价：¥${refPrice}/克${m.marketRatio && m.marketRatio !== 1 ? `（${match.code} ¥${match.price} × ${m.marketRatio}）` : ''}`,
      );
    } catch (error) {
      handleError(error, { title: '获取行情价失败', silent: true });
    }
  }

  // 预览调价：行情价 * marketRatio + 工费 作为新克价
  async function handlePreviewReprice(materialId: number, newPrice: number) {
    try {
      const result = await metalApi.previewReprice({ materialId, newPricePerGram: newPrice });
      setRepricePreview({ ...result, materialId, newPrice });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '预览失败');
    }
  }

  async function handleConfirmReprice() {
    if (!repricePreview) return;
    try {
      await metalApi.confirmReprice({ materialId: repricePreview.materialId!, newPricePerGram: repricePreview.newPrice! });
      toast.success('调价已确认，相关货品已更新');
      setRepricePreview(null);
      await refreshMaterials();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '确认调价失败');
    }
  }

  async function handlePriceHistory(materialId: number, materialName: string, page = 1) {
    try {
      const h = await metalApi.getPriceHistory({ material_id: String(materialId), page, pageSize: 20 });
      setPriceHistory(h?.items || []);
      setPriceHistoryMaterial(materialName);
      setPriceHistoryMaterialId(materialId);
      setPriceHistoryPage(page);
      setPriceHistoryTotal(h?.pagination?.total || 0);
      setShowPriceHistory(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载历史失败');
    }
  }

  // 加载贵金属行情走势数据
  async function fetchTrendData(days: number) {
    if (preciousMetals.length === 0) return;
    setTrendLoading(true);
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const start = new Date();
      start.setDate(start.getDate() - days);
      const startDate = start.toISOString().slice(0, 10);
      const ids = preciousMetals.map((m: DictMaterial) => m.id);

      const res = await metalApi.getPriceHistory({
        material_ids: ids.join(','),
        start_date: startDate,
        end_date: endDate,
        pageSize: Math.max(days * 2, 60),
      });

      const items = res?.items || [];
      // 按行情码分组，每组转换为 { date, price } 数组（按日期升序）
      const grouped: Record<string, Array<{ date: string; price: number }>> = {};
      for (const item of items) {
        const mat = preciousMetals.find((m: DictMaterial) => m.id === item.materialId);
        const code = mat?.subType || 'other';
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push({ date: item.effectiveDate, price: item.pricePerGram });
      }
      // 每个分组按日期升序排列
      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => a.date.localeCompare(b.date));
      }
      setTrendData(grouped);
    } catch {
      // 静默失败，走势图为辅助功能
    } finally {
      setTrendLoading(false);
    }
  }

  // 走势图数据加载（依赖变化时重新拉取）
  useEffect(() => {
    if (preciousMetals.length > 0) {
      fetchTrendData(trendRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preciousMetals, trendRange]);

  // 预览调价按钮点击：先计算最终克价，再调用预览API
  function onClickPreviewReprice(m: DictMaterial) {
    const mp = getMarketPrice(m);
    const finalPrice = calcFinalPrice(m, mp);
    if (!finalPrice) {
      toast.error('无法计算售价，请先获取行情价');
      return;
    }
    handlePreviewReprice(m.id, finalPrice);
  }

  // 一键同步：将所有材质 costPerGram 更新为当前行情价
  async function handleBatchSyncMarketPrice() {
    if (marketPrices.length === 0) {
      toast.error('请先获取行情价');
      return;
    }
    let synced = 0;
    for (const m of preciousMetals) {
      const mp = getMarketPrice(m);
      if (!mp || !mp.price) continue;
      try {
        await metalApi.updatePrice({ materialId: m.id, pricePerGram: mp.price });
        synced++;
      } catch {
        // 单个失败不影响其他的
      }
    }
    if (synced > 0) {
      toast.success(`已同步 ${synced} 个材质的行情价`);
      await refreshMaterials();
    } else {
      toast.error('没有可同步的材质');
    }
  }

  if (preciousMetals.length === 0) {
    return (
      <Card className="border-l-4 border-l-amber-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500" />
            贵金属市价管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            暂无贵金属类别且配置了行情码的材质。请先在字典管理中为贵金属材质设置分类和行情码（subType）。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-l-4 border-l-amber-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              贵金属市价管理
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => fetchMarketPrices(dataSource, true)}
                disabled={marketLoading}
              >
                <Activity className="h-3 w-3 mr-1" />
                刷新行情
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={handleBatchSyncMarketPrice}
                disabled={marketPrices.length === 0}
                title="将所有贵金属材质的克价同步为当前行情价"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                一键同步
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Database className="h-3 w-3" />
                    {dataSource === 'auto' ? '自动' : dataSource === 'gzjn168' ? '融通金' : '探数API'}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuLabel className="text-xs">行情数据源</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={dataSource} onValueChange={(v) => {
                    const source = v as 'auto' | 'gzjn168' | 'tanshu';
                    setDataSource(source);
                    fetchMarketPrices(source);
                  }}>
                    <DropdownMenuRadioItem value="auto" className="text-xs">
                      自动（优先融通金）
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="gzjn168" className="text-xs">
                      融通金 gzjn168.com
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="tanshu" className="text-xs">
                      探数API
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                className="h-7 text-xs px-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white border-0"
                onClick={handleOpenDailyShare}
              >
                <Share2 className="h-3 w-3 mr-1" />
                每日分享
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                onClick={() => {
                  // 用第一个有行情价材质的售价作为参考
                  const firstMetal = preciousMetals[0];
                  if (firstMetal) {
                    const mp = getMarketPrice(firstMetal);
                    const fp = calcFinalPrice(firstMetal, mp);
                    setCompetitorOurPrice(fp ?? 0);
                    // 不覆盖店名：条形图用固定店名，不用材质名
                  }
                  setCompetitorOpen(true);
                }}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                竞品对比
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            管理贵金属材质的实时行情价、工费和最终克重售价。
          </p>
          {/* 行情数据新鲜度指示器 */}
          {marketPrices.length > 0 && (
            <div className="flex items-center gap-2 mb-3 text-xs">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  Date.now() - marketLastFetch < 5 * 60 * 1000
                    ? 'bg-green-500'
                    : Date.now() - marketLastFetch < 30 * 60 * 1000
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                }`}
              />
              <span className="text-muted-foreground">
                {Date.now() - marketLastFetch < 5 * 60 * 1000
                  ? '数据新鲜（5分钟内）'
                  : Date.now() - marketLastFetch < 30 * 60 * 1000
                    ? `数据较新（${Math.floor((Date.now() - marketLastFetch) / 60000)}分钟前）`
                    : '数据可能已过时，建议刷新'}
              </span>
              {dataSource !== 'auto' && (
                <span className="text-muted-foreground/60 ml-auto">
                  源: {dataSource === 'gzjn168' ? '融通金' : '探数API'}
                </span>
              )}
            </div>
          )}
          {dataSource !== 'auto' && marketPrices.length === 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              行情源: {dataSource === 'gzjn168' ? '融通金 gzjn168.com' : '探数API tanshuapi.com'}
            </p>
          )}
          <div className="space-y-3">
            {preciousMetals.map((m: DictMaterial) => {
              const mp = getMarketPrice(m);
              const finalPrice = calcFinalPrice(m, mp);
              const laborVal =
                laborInputs[m.id] !== undefined
                  ? laborInputs[m.id]
                  : (m.laborCostPerGram != null ? String(m.laborCostPerGram) : '');

              return (
                <div
                  key={m.id}
                  className="p-3 bg-muted/50 rounded-lg space-y-2"
                >
                  {/* 标题行：材质名 + 行情码 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {m.name}
                        {m.subType && (
                          <span className="ml-1 text-xs text-amber-600 font-mono">
                            ({m.subType})
                          </span>
                        )}
                      </p>
                    </div>
                    {mp && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" title="数据新鲜" />
                        更新于 {mp.updatedAt}
                      </span>
                    )}
                  </div>

                  {/* 行情价 + 工费 + 最终售价 */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    {/* 行情价 + 日变动 */}
                    <span className="text-muted-foreground">
                      行情价:{' '}
                      <span className="font-medium text-foreground">
                        {mp
                          ? `¥${mp.price.toFixed(2)}/克`
                          : marketLoading
                            ? '加载中...'
                            : '等待获取'}
                      </span>
                      {/* 与上次记录价的变动指示 */}
                      {mp && m.costPerGram && m.costPerGram > 0 && mp.price !== m.costPerGram && (
                        <span className={`ml-1.5 text-xs font-medium ${
                          mp.price > m.costPerGram ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {mp.price > m.costPerGram ? '↑' : '↓'}
                          ¥{Math.abs(mp.price - m.costPerGram).toFixed(2)}
                        </span>
                      )}
                      {mp && m.marketRatio && m.marketRatio !== 1 && (
                        <span className="text-xs text-amber-600 ml-1">
                          (×{m.marketRatio}={((mp.price * m.marketRatio * 100) / 100).toFixed(2)})
                        </span>
                      )}
                    </span>

                    {/* 上次调价 + 偏离预警 */}
                    {m.costPerGram && m.costPerGram > 0 && (
                      <>
                        <span className="text-muted-foreground/30">|</span>
                        <span className="text-muted-foreground text-xs">
                          上次调价:{' '}
                          <span className="font-medium text-foreground">
                            ¥{m.costPerGram.toFixed(2)}/克
                          </span>
                          {mp && mp.price > 0 && (
                            (() => {
                              const pctDiff = ((mp.price - m.costPerGram!) / m.costPerGram! * 100);
                              if (Math.abs(pctDiff) >= 2) {
                                return (
                                  <span className={`ml-1 text-xs font-medium ${pctDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    ({pctDiff > 0 ? '行情偏高' : '行情偏低'} {Math.abs(pctDiff).toFixed(1)}%)
                                  </span>
                                );
                              }
                              return null;
                            })()
                          )}
                        </span>
                      </>
                    )}

                    {/* 分隔 */}
                    <span className="text-muted-foreground/30">|</span>

                    {/* 工费 */}
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      工费:
                      <Input
                        type="number"
                        className="w-20 h-7 text-xs"
                        placeholder="0"
                        value={laborVal}
                        onChange={(e) =>
                          setLaborInputs((prev) => ({
                            ...prev,
                            [m.id]: e.target.value,
                          }))
                        }
                        step="0.01"
                        min="0"
                      />
                      元/克
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => handleSaveLaborCost(m)}
                      >
                        保存
                      </Button>
                    </span>

                    {/* 分隔 */}
                    <span className="text-muted-foreground/30">|</span>

                    {/* 最终售价 */}
                    <span className="text-muted-foreground">
                      最终售价:{' '}
                      <span className="font-bold text-amber-600">
                        {finalPrice != null
                          ? `¥${finalPrice.toFixed(2)}/克`
                          : '--'}
                      </span>
                    </span>
                  </div>

                  {/* 操作按钮行 */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-sky-600 border-sky-200 hover:bg-sky-50"
                      onClick={() => handleFetchMarket(m)}
                    >
                      <Activity className="h-3 w-3 mr-1" />
                      获取行情价
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onClickPreviewReprice(m)}
                      disabled={!mp}
                      title={!mp ? '请先获取行情价' : '预览按当前行情价调价后的影响'}
                    >
                      <Calculator className="h-3 w-3 mr-1" />
                      预览调价
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handlePriceHistory(m.id, m.name)}
                    >
                      <History className="h-3 w-3 mr-1" />
                      历史记录
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 贵金属行情走势图 */}
      {preciousMetals.length > 0 && (
        <Card className="border-l-4 border-l-purple-400 hover:shadow-sm transition-shadow duration-200 mt-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ChartArea className="h-4 w-4 text-purple-500" />
                贵金属行情走势
              </CardTitle>
              <div className="flex items-center gap-1">
                {([7, 30, 90, 365] as const).map((days) => (
                  <Button
                    key={days}
                    size="sm"
                    variant={trendRange === days ? 'default' : 'outline'}
                    className={`h-7 text-xs px-2 ${trendRange === days ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    onClick={() => setTrendRange(days)}
                  >
                    {days === 365 ? '1年' : `${days}天`}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                加载走势数据...
              </div>
            ) : Object.keys(trendData).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无足够的价格历史数据绘制走势图
              </p>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        allowDuplicatedCategory={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => `¥${v}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [`¥${value.toFixed(2)}/克`, '']}
                        labelFormatter={(label) => `日期: ${label}`}
                      />
                      {Object.entries(trendData).map(([code, data]) => {
                        const nameMap: Record<string, string> = {
                          Au9999: '黄金 Au9999',
                          'AgT+D': '白银 Ag(T+D)',
                          PT9995: '铂金 Pt9995',
                        };
                        return (
                          <Line
                            key={code}
                            data={data}
                            type="monotone"
                            dataKey="price"
                            name={nameMap[code] || code}
                            stroke={trendColors[code] || '#888'}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* 图例 */}
                <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
                  {Object.entries(trendData).map(([code]) => {
                    const nameMap: Record<string, string> = {
                      Au9999: '黄金 Au9999',
                      'AgT+D': '白银 Ag(T+D)',
                      PT9995: '铂金 Pt9995',
                    };
                    return (
                      <span key={code} className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-3 h-0.5 rounded"
                          style={{ backgroundColor: trendColors[code] || '#888' }}
                        />
                        {nameMap[code] || code}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 本地参考行情 */}
      <div className="mt-4">
        <LocalReferencePanel />
      </div>

      {/* 每日分享弹窗（三张营销海报） */}
      <DailyShareDialog
        open={dailyShareOpen}
        onClose={() => setDailyShareOpen(false)}
        ourName={competitorOurName}
        preciousMetals={preciousMetals}
        marketPrices={marketPrices}
        trendData={trendData}
        competitors={competitorsForShare}
      />

      {/* 竞品对比弹窗（页面级） */}
      <CompetitorCompareDialog
        open={competitorOpen}
        onClose={() => {
          setCompetitorOpen(false);
        }}
        ourPrice={competitorOurPrice}
        ourName={competitorOurName}
      />

      {/* Reprice Preview Dialog */}
      <Dialog open={repricePreview !== null} onOpenChange={open => { if (!open) setRepricePreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>调价预览</DialogTitle><DialogDescription>以下货品将受影响</DialogDescription></DialogHeader>
          {repricePreview && (
            <div className="space-y-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-sm">
                <p>新单价: <span className="font-bold text-emerald-600">¥{repricePreview.newPrice}/克</span></p>
                <p>影响货品: <span className="font-bold">{repricePreview.affectedItems?.length || 0} 件</span></p>
              </div>
              {repricePreview.affectedItems && repricePreview.affectedItems.length > 0 ? (
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>名称</TableHead><TableHead className="text-right">原价</TableHead><TableHead className="text-right">新价</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {repricePreview.affectedItems.map((item: { itemId: number; skuCode: string; name: string | null; oldPrice: number; newPrice: number }) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="font-mono text-xs">{item.skuCode}</TableCell>
                          <TableCell className="text-sm">{item.name || '-'}</TableCell>
                          <TableCell className="text-right text-sm">{formatPrice(item.oldPrice)}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-emerald-600">{formatPrice(item.newPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">没有受影响的在库货品</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepricePreview(null)}>取消</Button>
            <Button onClick={handleConfirmReprice} className="bg-emerald-600 hover:bg-emerald-700" disabled={!repricePreview?.affectedItems?.length}>确认调价</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={showPriceHistory} onOpenChange={setShowPriceHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>价格历史 - {priceHistoryMaterial}</DialogTitle></DialogHeader>
          {priceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无历史记录</p>
          ) : (
            <>
              {priceHistory.length > 1 && (
                <div className="h-48 mb-4">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <ChartArea className="h-3 w-3" />
                    价格趋势
                  </p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...priceHistory].reverse().map(h => ({ date: (h.effectiveDate || h.createdAt)?.slice(0, 10), price: h.pricePerGram }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip />
                      <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="单价" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader><TableRow><TableHead>日期</TableHead><TableHead className="text-right">单价(元/克)</TableHead><TableHead className="text-right">涨跌</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {priceHistory.map((h: MetalPrice, i: number) => {
                      // 计算与前一条（更新的）记录的差价
                      const prev = i > 0 ? priceHistory[i - 1] : null;
                      const diff = prev ? h.pricePerGram - prev.pricePerGram : 0;
                      return (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{h.effectiveDate || h.createdAt?.slice(0, 10) || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">¥{h.pricePerGram}</TableCell>
                        <TableCell className="text-right text-sm">
                          {prev ? (
                            diff > 0 ? (
                              <span className="text-red-500">↑¥{diff.toFixed(2)}</span>
                            ) : diff < 0 ? (
                              <span className="text-green-500">↓¥{Math.abs(diff).toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">最新</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                            title="删除此记录"
                            onClick={async () => {
                              if (!h.id || !confirm(`确定删除 ${h.effectiveDate || h.createdAt?.slice(0, 10)} 的价格记录吗？`)) return;
                              try {
                                await metalApi.deletePriceRecord(h.id);
                                toast.success('价格记录已删除');
                                handlePriceHistory(priceHistoryMaterialId, priceHistoryMaterial, priceHistoryPage);
                              } catch (e: unknown) {
                                toast.error(e instanceof Error ? e.message : '删除失败');
                              }
                            }}
                          >
                            ×
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* 分页控件 */}
              {priceHistoryTotal > 20 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                  <span>共 {priceHistoryTotal} 条记录</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs px-2"
                      disabled={priceHistoryPage <= 1}
                      onClick={() => handlePriceHistory(priceHistoryMaterialId, priceHistoryMaterial, priceHistoryPage - 1)}
                    >
                      上一页
                    </Button>
                    <span className="px-2">
                      {priceHistoryPage} / {Math.ceil(priceHistoryTotal / 20)}
                    </span>
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs px-2"
                      disabled={priceHistoryPage >= Math.ceil(priceHistoryTotal / 20)}
                      onClick={() => handlePriceHistory(priceHistoryMaterialId, priceHistoryMaterial, priceHistoryPage + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowPriceHistory(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
