'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChartBar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ============================================================
// 类型定义（与后端 service 输出的格式一致）
// ============================================================

interface CategoryDistItem {
  name: string;
  amount: number;
  count: number;
  ratio: number;
}

interface PriceBandItem {
  band: string;
  count: number;
  amount: number;
}

interface ReportPeriod {
  start: string;
  end: string;
  label: string;
}

interface ReportSummary {
  revenue: number;
  profit: number;
  soldCount: number;
  avgOrderValue: number;
}

interface ChangeRates {
  revenue: number | null;
  profit: number | null;
  soldCount: number | null;
  avgOrderValue: number | null;
}

interface InventorySnapshot {
  startStock: number;
  endStock: number;
  newItems: number;
  soldItems: number;
}

interface WeeklyReportData {
  period: ReportPeriod;
  summary: ReportSummary;
  momChanges: ChangeRates | null;
  materialTop3: CategoryDistItem[];
  typeTop3: CategoryDistItem[];
  priceBands: PriceBandItem[];
  inventory: InventorySnapshot;
}

interface MonthlyReportData {
  period: ReportPeriod;
  summary: ReportSummary;
  yoyChanges: ChangeRates | null;
  materialTop10: CategoryDistItem[];
  typeTop10: CategoryDistItem[];
  priceBands: PriceBandItem[];
  channelDist: { channel: string; amount: number; count: number }[];
  inventory: InventorySnapshot;
  customerStats: {
    newCustomers: number;
    activeCustomers: number;
    topCustomers: { name: string; amount: number; count: number }[];
  };
}

interface NotificationForReport {
  id: number;
  type: 'weekly_report' | 'monthly_report' | string;
  title: string;
  content: string;
  createdAt: string;
}

// ============================================================
// Props
// ============================================================

interface ReportDetailDialogProps {
  open: boolean;
  onClose: () => void;
  notification: NotificationForReport | null;
}

// ============================================================
// 工具函数
// ============================================================

/** 格式化金额 */
function fmtMoney(n: number): string {
  if (n === undefined || n === null) return '--';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** 格式化百分比 */
function fmtPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

/** 渲染变化率箭头 */
function ChangeIndicator({ value, label }: { value: number | null; label: string }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground">--</span>;
  }

  const isUp = value > 0;
  const isDown = value < 0;
  const absValue = Math.abs(value);

  return (
    <div className="flex items-center gap-1">
      {isUp ? (
        <TrendingUp className="h-3 w-3 text-emerald-500" />
      ) : isDown ? (
        <TrendingDown className="h-3 w-3 text-red-500" />
      ) : (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={`text-xs font-medium ${isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-muted-foreground'}`}>
        {isUp ? '+' : ''}{absValue.toFixed(1)}%
      </span>
      <span className="text-[10px] text-muted-foreground ml-1">{label}</span>
    </div>
  );
}

/** 渲染汇总指标卡片 */
function SummaryCard({ title, value, formatter, changeValue, changeLabel }: {
  title: string;
  value: number;
  formatter: (n: number) => string;
  changeValue: number | null;
  changeLabel: string;
}) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-lg font-bold tabular-nums">{formatter(value)}</p>
        <ChangeIndicator value={changeValue} label={changeLabel} />
      </CardContent>
    </Card>
  );
}

/** 渲染分布表格 */
function DistributionTable({ title, items, totalAmount }: {
  title: string;
  items: CategoryDistItem[];
  totalAmount: number;
}) {
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader className="py-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent className="p-3 text-sm text-muted-foreground">暂无数据</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">名称</TableHead>
              <TableHead className="text-xs text-right">销售额</TableHead>
              <TableHead className="text-xs text-right">件数</TableHead>
              <TableHead className="text-xs text-right">占比</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{item.name}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{fmtMoney(item.amount)}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{item.count}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{item.ratio}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** 渲染价格带表格 */
function PriceBandTable({ items }: { items: PriceBandItem[] }) {
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader className="py-2"><CardTitle className="text-sm">价格带分布</CardTitle></CardHeader>
        <CardContent className="p-3 text-sm text-muted-foreground">暂无数据</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="text-sm">价格带分布</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">价格带</TableHead>
              <TableHead className="text-xs text-right">件数</TableHead>
              <TableHead className="text-xs text-right">销售额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((b, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{b.band}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{b.count}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{fmtMoney(b.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** 渲染库存变化 */
function InventoryCard({ inventory }: { inventory: InventorySnapshot }) {
  const change = inventory.endStock - inventory.startStock;

  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="text-sm">库存变化</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">期初库存：</span>
            <span className="font-medium tabular-nums">{inventory.startStock} 件</span>
          </div>
          <div>
            <span className="text-muted-foreground">期末库存：</span>
            <span className="font-medium tabular-nums">{inventory.endStock} 件</span>
          </div>
          <div>
            <span className="text-muted-foreground">新增：</span>
            <span className="font-medium text-blue-600 tabular-nums">+{inventory.newItems}</span>
          </div>
          <div>
            <span className="text-muted-foreground">售出：</span>
            <span className="font-medium text-emerald-600 tabular-nums">-{inventory.soldItems}</span>
          </div>
          <div className="col-span-2 pt-1 border-t">
            <span className="text-muted-foreground">净变化：</span>
            <span className={`font-medium tabular-nums ${change >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change} 件
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 周报渲染
// ============================================================

function WeeklyReportView({ data }: { data: WeeklyReportData }) {
  const { summary, momChanges, materialTop3, typeTop3, priceBands, inventory, period } = data;
  const totalRevenue = summary.revenue || 0;

  return (
    <div className="space-y-4">
      {/* 时间范围 */}
      <div className="text-xs text-muted-foreground">
        {period.start} ~ {period.end} | {period.label}
      </div>

      {/* 汇总指标 */}
      <div className="flex flex-wrap gap-2">
        <SummaryCard
          title="销售额"
          value={summary.revenue}
          formatter={fmtMoney}
          changeValue={momChanges?.revenue ?? null}
          changeLabel="环比"
        />
        <SummaryCard
          title="利润"
          value={summary.profit}
          formatter={fmtMoney}
          changeValue={momChanges?.profit ?? null}
          changeLabel="环比"
        />
        <SummaryCard
          title="销量"
          value={summary.soldCount}
          formatter={n => `${n} 件`}
          changeValue={momChanges?.soldCount ?? null}
          changeLabel="环比"
        />
        <SummaryCard
          title="客单价"
          value={summary.avgOrderValue}
          formatter={fmtMoney}
          changeValue={momChanges?.avgOrderValue ?? null}
          changeLabel="环比"
        />
      </div>

      {/* 材质分布 */}
      <DistributionTable title="材质分布 Top3" items={materialTop3} totalAmount={totalRevenue} />

      {/* 器型分布 */}
      <DistributionTable title="器型分布 Top3" items={typeTop3} totalAmount={totalRevenue} />

      {/* 价格带 */}
      <PriceBandTable items={priceBands} />

      {/* 库存变化 */}
      <InventoryCard inventory={inventory} />
    </div>
  );
}

// ============================================================
// 月报渲染
// ============================================================

function MonthlyReportView({ data }: { data: MonthlyReportData }) {
  const { summary, yoyChanges, materialTop10, typeTop10, priceBands, channelDist, inventory, customerStats, period } = data;
  const totalRevenue = summary.revenue || 0;

  return (
    <div className="space-y-4">
      {/* 时间范围 */}
      <div className="text-xs text-muted-foreground">
        {period.start} ~ {period.end} | {period.label}
      </div>

      {/* 汇总指标（同比） */}
      <div className="flex flex-wrap gap-2">
        <SummaryCard
          title="销售额"
          value={summary.revenue}
          formatter={fmtMoney}
          changeValue={yoyChanges?.revenue ?? null}
          changeLabel="同比"
        />
        <SummaryCard
          title="利润"
          value={summary.profit}
          formatter={fmtMoney}
          changeValue={yoyChanges?.profit ?? null}
          changeLabel="同比"
        />
        <SummaryCard
          title="销量"
          value={summary.soldCount}
          formatter={n => `${n} 件`}
          changeValue={yoyChanges?.soldCount ?? null}
          changeLabel="同比"
        />
        <SummaryCard
          title="客单价"
          value={summary.avgOrderValue}
          formatter={fmtMoney}
          changeValue={yoyChanges?.avgOrderValue ?? null}
          changeLabel="同比"
        />
      </div>

      {/* 材质分布 */}
      <DistributionTable title="材质分布 Top10" items={materialTop10} totalAmount={totalRevenue} />

      {/* 器型分布 */}
      <DistributionTable title="器型分布 Top10" items={typeTop10} totalAmount={totalRevenue} />

      {/* 价格带 */}
      <PriceBandTable items={priceBands} />

      {/* 渠道分布 */}
      {channelDist && channelDist.length > 0 && (
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">渠道分布</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">渠道</TableHead>
                  <TableHead className="text-xs text-right">销售额</TableHead>
                  <TableHead className="text-xs text-right">件数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelDist.map((ch, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {ch.channel === 'store' ? '门店' : ch.channel === 'wechat' ? '微信' : ch.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmtMoney(ch.amount)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{ch.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 库存变化 */}
      <InventoryCard inventory={inventory} />

      {/* 客户统计 */}
      {customerStats && (
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">客户统计</CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">新增客户：</span>
                <span className="font-medium text-blue-600 tabular-nums">{customerStats.newCustomers}</span>
              </div>
              <div>
                <span className="text-muted-foreground">活跃客户：</span>
                <span className="font-medium text-emerald-600 tabular-nums">{customerStats.activeCustomers}</span>
              </div>
            </div>

            {customerStats.topCustomers.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">消费 Top10</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">客户</TableHead>
                      <TableHead className="text-xs text-right">消费额</TableHead>
                      <TableHead className="text-xs text-right">次数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerStats.topCustomers.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmtMoney(c.amount)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{c.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function ReportDetailDialog({ open, onClose, notification }: ReportDetailDialogProps) {
  // 解析报表数据
  let reportType: 'weekly_report' | 'monthly_report' | 'unknown' = 'unknown';
  let weeklyData: WeeklyReportData | null = null;
  let monthlyData: MonthlyReportData | null = null;
  let parseError: string | null = null;

  if (notification) {
    try {
      const content = JSON.parse(notification.content);
      if (notification.type === 'weekly_report') {
        reportType = 'weekly_report';
        weeklyData = content as WeeklyReportData;
      } else if (notification.type === 'monthly_report') {
        reportType = 'monthly_report';
        monthlyData = content as MonthlyReportData;
      } else {
        parseError = `不支持的通知类型: ${notification.type}`;
      }
    } catch {
      parseError = '报表数据解析失败，content 不是有效的 JSON';
    }
  }

  const title = notification?.title || '报表详情';
  const isWeekly = reportType === 'weekly_report';
  const isMonthly = reportType === 'monthly_report';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0" showCloseButton={true}>
        {/* 头部 */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {isWeekly ? (
              <ChartBar className="h-5 w-5 text-blue-500" />
            ) : isMonthly ? (
              <TrendingUp className="h-5 w-5 text-purple-500" />
            ) : null}
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* 内容区 */}
        <ScrollArea className="flex-1 max-h-[calc(85vh-80px)]">
          <div className="px-4 sm:px-6 py-4">
            {!notification && (
              <div className="text-center text-muted-foreground py-8">
                没有可显示的报表数据
              </div>
            )}

            {parseError && (
              <div className="text-center py-8">
                <p className="text-sm text-red-500 mb-1">数据解析失败</p>
                <p className="text-xs text-muted-foreground">{parseError}</p>
              </div>
            )}

            {isWeekly && weeklyData && <WeeklyReportView data={weeklyData} />}
            {isMonthly && monthlyData && <MonthlyReportView data={monthlyData} />}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
