'use client';

import React, { useState, useEffect } from 'react';
import { restockApi, dictsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, RefreshCw, TrendingUp, Shield, Calendar, DollarSign, Clock, BarChart3 } from 'lucide-react';

const RestockTab: React.FC = () => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('');
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>('');
  const [selectedTurnover, setSelectedTurnover] = useState<string>('');
  const [selectedHeat, setSelectedHeat] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [limit, setLimit] = useState<string>('20');
  const [types, setTypes] = useState<any[]>([]);
  const [priceRanges, setPriceRanges] = useState<any[]>([]);

  // 加载材质列表
  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const [materialsData, typesData, priceRangesData] = await Promise.all([
        dictsApi.getMaterials(),
        dictsApi.getTypes(),
        fetch('/api/dicts/price-ranges').then(res => res.json())
      ]);
      setMaterials(materialsData);
      setTypes(typesData);
      if (priceRangesData.code === 0) {
        setPriceRanges(priceRangesData.data);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 加载入货建议
  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedMaterial) {
        params.materialId = selectedMaterial;
      }
      if (selectedType) {
        params.typeId = selectedType;
      }
      if (selectedPriceRange) {
        params.priceRangeId = selectedPriceRange;
      }
      if (selectedAgeRange) {
        params.ageRange = selectedAgeRange;
      }
      if (selectedTurnover) {
        params.turnover = selectedTurnover;
      }
      if (selectedHeat) {
        params.heat = selectedHeat;
      }
      const data = await restockApi.getRecommendations(params);
      setRecommendations(data);
    } catch (error) {
      console.error('加载入货建议失败:', error);
      setError('加载入货建议失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 生成入货建议
  const generateRecommendations = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await restockApi.generateRecommendations({
        materialId: selectedMaterial ? parseInt(selectedMaterial) : undefined,
        typeId: selectedType ? parseInt(selectedType) : undefined,
        priceRangeId: selectedPriceRange ? parseInt(selectedPriceRange) : undefined,
        ageRange: selectedAgeRange,
        turnover: selectedTurnover,
        heat: selectedHeat,
        budget: budget ? parseFloat(budget) : undefined,
        limit: parseInt(limit),
      });
      setRecommendations(data);
    } catch (error) {
      console.error('生成入货建议失败:', error);
      setError('生成入货建议失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  // 计算置信度颜色
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    if (confidence >= 0.6) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">入货建议</h1>
          <p className="text-muted-foreground">智能分析库存和销售数据，生成精准的入货建议</p>
        </div>
        <Button onClick={loadRecommendations} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              刷新
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新建议
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>生成入货建议</CardTitle>
          <CardDescription>根据销售数据和库存情况，生成智能入货建议</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material">材质</Label>
              <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                <SelectTrigger id="material">
                  <SelectValue placeholder="选择材质" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部材质</SelectItem>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id.toString()}>
                      {material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">器型</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="选择器型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部器型</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceRange">价格带</Label>
              <Select value={selectedPriceRange} onValueChange={setSelectedPriceRange}>
                <SelectTrigger id="priceRange">
                  <SelectValue placeholder="选择价格带" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部价格带</SelectItem>
                  {priceRanges.map((range) => (
                    <SelectItem key={range.id} value={range.id.toString()}>
                      {range.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ageRange">库龄</Label>
              <Select value={selectedAgeRange} onValueChange={setSelectedAgeRange}>
                <SelectTrigger id="ageRange">
                  <SelectValue placeholder="选择库龄" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部库龄</SelectItem>
                  <SelectItem value="0-30">0-30天</SelectItem>
                  <SelectItem value="31-90">31-90天</SelectItem>
                  <SelectItem value="91-180">91-180天</SelectItem>
                  <SelectItem value="180+">180天以上</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="turnover">周转率</Label>
              <Select value={selectedTurnover} onValueChange={setSelectedTurnover}>
                <SelectTrigger id="turnover">
                  <SelectValue placeholder="选择周转率" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部周转率</SelectItem>
                  <SelectItem value="high">高周转</SelectItem>
                  <SelectItem value="medium">中周转</SelectItem>
                  <SelectItem value="low">低周转</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="heat">销售热度</Label>
              <Select value={selectedHeat} onValueChange={setSelectedHeat}>
                <SelectTrigger id="heat">
                  <SelectValue placeholder="选择销售热度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部热度</SelectItem>
                  <SelectItem value="hot">畅销</SelectItem>
                  <SelectItem value="normal">平销</SelectItem>
                  <SelectItem value="cold">滞销</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">预算 (元)</Label>
              <Input
                id="budget"
                type="number"
                placeholder="输入预算"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">建议数量</Label>
              <Input
                id="limit"
                type="number"
                placeholder="输入建议数量"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={generateRecommendations} disabled={generating} className="w-full md:w-auto">
            {generating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                生成建议
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>入货建议列表</CardTitle>
          <CardDescription>基于销售数据和库存情况生成的入货建议</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">暂无入货建议</h3>
              <p className="text-muted-foreground mt-2">点击"生成建议"按钮生成入货建议</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品信息</TableHead>
                    <TableHead className="text-right">当前库存</TableHead>
                    <TableHead className="text-right">安全库存</TableHead>
                    <TableHead className="text-right">建议数量</TableHead>
                    <TableHead className="text-right">预估成本</TableHead>
                    <TableHead className="text-right">预期周期</TableHead>
                    <TableHead className="text-right">置信度</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => (
                    <TableRow key={rec.itemId}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{rec.item?.name || '未知商品'}</div>
                          <div className="text-sm text-muted-foreground">
                            {rec.item?.material?.name} / {rec.item?.type?.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{rec.currentStock}</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Shield className="h-3 w-3 text-emerald-600" />
                          {rec.safetyStock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {rec.recommendedQty}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <DollarSign className="h-3 w-3 text-amber-600" />
                          {rec.estimatedCost.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Calendar className="h-3 w-3 text-sky-600" />
                          {rec.estimatedSalesCycle} 天
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={getConfidenceColor(rec.confidence)}>
                          {(rec.confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>季节性分析</CardTitle>
          <CardDescription>了解不同材质的季节性销售趋势</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seasonal-material">材质</Label>
                <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                  <SelectTrigger id="seasonal-material">
                    <SelectValue placeholder="选择材质" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id.toString()}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={async () => {
              try {
                const data = await restockApi.getSeasonalFactors({ materialId: selectedMaterial });
                console.log('季节性因子:', data);
                // 这里可以添加图表展示
              } catch (error) {
                console.error('获取季节性因子失败:', error);
                setError('获取季节性因子失败，请稍后重试');
              }
            }}>
              <Calendar className="mr-2 h-4 w-4" />
              查看季节性因子
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestockTab;
