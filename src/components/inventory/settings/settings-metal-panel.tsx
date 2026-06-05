'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Calculator, History, Activity, TrendingUp, Database, ChevronDown } from 'lucide-react';
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
import { metalApi } from '@/lib/api';
import type { DictMaterial, MarketPriceItem } from '@/lib/api.types';
import CompetitorCompareDialog from './competitor-compare-dialog';
import LocalReferencePanel from './local-reference-panel';

interface MetalPanelProps {
  materials: DictMaterial[];
  onMaterialsChange: (updater: (prev: DictMaterial[]) => DictMaterial[]) => void;
  onPreviewReprice: (materialId: number, newPrice: number) => void;
  onPriceHistory: (materialId: number, materialName: string) => void;
}

export default function SettingsMetalPanel({
  materials,
  onMaterialsChange,
  onPreviewReprice,
  onPriceHistory,
}: MetalPanelProps) {
  const { handleError } = useErrorHandler();

  // 行情价数据（页面加载时获取，用户可手动刷新）
  const [marketPrices, setMarketPrices] = useState<MarketPriceItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'auto' | 'gzjn168' | 'tanshu'>('auto');

  // 竞品对比弹窗状态（页面级，不绑定具体材质）
  const [competitorOpen, setCompetitorOpen] = useState(false);
  const [competitorOurPrice, setCompetitorOurPrice] = useState<number>(0);
  const [competitorOurName, setCompetitorOurName] = useState<string>('本店');

  // 工费编辑状态：materialId -> 输入框中的值（字符串）
  const [laborInputs, setLaborInputs] = useState<Record<number, string>>({});

  // 过滤：只显示 category === '贵金属' 且有 subType（行情码）的材质
  const preciousMetals = materials.filter(
    (m: DictMaterial) => m.category === '贵金属' && m.subType
  );

  // 页面加载时获取行情价
  const fetchMarketPrices = async (source?: 'auto' | 'gzjn168' | 'tanshu') => {
    setMarketLoading(true);
    try {
      const actualSource = source || dataSource;
      const prices = await metalApi.getMarketPrices(actualSource);
      setMarketPrices(prices || []);
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

  // 根据 subType 匹配行情价，返回匹配的 MarketPriceItem（优先匹配 materialId）
  function getMarketPrice(m: DictMaterial): MarketPriceItem | undefined {
    return (
      marketPrices.find((p) => p.materialId === m.id) ||
      marketPrices.find((p) => p.code === m.subType)
    );
  }

  // 计算最终售价 = 行情价 * marketRatio + 工费
  function calcFinalPrice(m: DictMaterial, mp?: MarketPriceItem): number | null {
    const laborCost =
      laborInputs[m.id] !== undefined
        ? parseFloat(laborInputs[m.id])
        : m.laborCostPerGram;
    const marketPrice = mp ? mp.price : 0;
    const ratio = m.marketRatio ?? 1;
    if (!marketPrice || isNaN(marketPrice)) return null;
    const metalCost = Math.round(marketPrice * ratio * 100) / 100;
    const labor = (laborCost && !isNaN(laborCost)) ? laborCost : 0;
    return Math.round((metalCost + labor) * 100) / 100;
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
      onMaterialsChange((ms: DictMaterial[]) =>
        ms.map((x: DictMaterial) =>
          x.id === m.id ? { ...x, laborCostPerGram: val } : x
        )
      );
      toast.success(`${m.name} 工费已更新为 ¥${val}/克`);
    } catch (error) {
      handleError(error, { title: '保存工费失败', silent: true });
    }
  }

  // 获取行情价并填充到输入框
  async function handleFetchMarket(m: DictMaterial) {
    try {
      // 先刷新行情数据（使用当前选中的数据源）
      const prices = await metalApi.getMarketPrices(dataSource);
      setMarketPrices(prices || []);
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
  function handlePreviewRepriceClick(m: DictMaterial) {
    const mp = getMarketPrice(m);
    const finalPrice = calcFinalPrice(m, mp);
    if (!finalPrice) {
      toast.error('无法计算售价，请先获取行情价');
      return;
    }
    onPreviewReprice(m.id, finalPrice);
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
                onClick={() => fetchMarketPrices(dataSource)}
                disabled={marketLoading}
              >
                <Activity className="h-3 w-3 mr-1" />
                刷新行情
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
                variant="outline"
                className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                onClick={() => {
                  // 用第一个有行情价材质的售价作为参考
                  const firstMetal = preciousMetals[0];
                  if (firstMetal) {
                    const mp = getMarketPrice(firstMetal);
                    const fp = calcFinalPrice(firstMetal, mp);
                    setCompetitorOurPrice(fp ?? 0);
                    setCompetitorOurName(firstMetal.name);
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
          <p className="text-sm text-muted-foreground mb-4">
            管理贵金属材质的实时行情价、工费和最终克重售价。
          </p>
          {dataSource !== 'auto' && (
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
                      <span className="text-xs text-muted-foreground">
                        更新于 {mp.updatedAt}
                      </span>
                    )}
                  </div>

                  {/* 行情价 + 工费 + 最终售价 */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    {/* 行情价 */}
                    <span className="text-muted-foreground">
                      行情价:{' '}
                      <span className="font-medium text-foreground">
                        {mp
                          ? `¥${mp.price.toFixed(2)}/克`
                          : marketLoading
                            ? '加载中...'
                            : '等待获取'}
                      </span>
                      {mp && m.marketRatio && m.marketRatio !== 1 && (
                        <span className="text-xs text-amber-600 ml-1">
                          (×{m.marketRatio}={((mp.price * m.marketRatio * 100) / 100).toFixed(2)})
                        </span>
                      )}
                    </span>

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
                      onClick={() => handlePreviewRepriceClick(m)}
                    >
                      <Calculator className="h-3 w-3 mr-1" />
                      预览调价
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onPriceHistory(m.id, m.name)}
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

      {/* 本地参考行情 */}
      <div className="mt-4">
        <LocalReferencePanel />
      </div>

      {/* 竞品对比弹窗（页面级） */}
      <CompetitorCompareDialog
        open={competitorOpen}
        onClose={() => {
          setCompetitorOpen(false);
        }}
        ourPrice={competitorOurPrice}
        ourName={competitorOurName}
      />
    </>
  );
}
