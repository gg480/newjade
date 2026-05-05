'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPrice, StatusBadge, PaybackBar } from '../shared';

import {
  Eye, Pencil, Trash2, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

// ========== Batches Table Props ==========
interface BatchesTableProps {
  filteredBatches: any[];
  onViewDetail: (id: number) => void;
  onEdit: (batch: any) => void;
  onDelete: (batch: any) => void;
  onAllocate: (id: number) => void;
  allocMethodLabels: Record<string, string>;
}

export function BatchesTable({
  filteredBatches, onViewDetail, onEdit, onDelete, onAllocate, allocMethodLabels,
}: BatchesTableProps) {
  return (
    <>
      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次编号</TableHead><TableHead>材质</TableHead><TableHead className="text-right">总成本</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">数量</TableHead><TableHead className="text-right">已录入</TableHead><TableHead>分摊方式</TableHead><TableHead className="text-right">已售</TableHead>
                  <TableHead className="text-right">已回款</TableHead><TableHead className="text-right">利润</TableHead><TableHead>回本进度</TableHead><TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map(b => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onViewDetail(b.id)}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-1.5">
                        {b.batchCode}
                        {(b.itemsCount || 0) > 0 ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">已关联货品</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">未录入</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{b.materialName}</TableCell>
                    <TableCell className="text-right">{formatPrice(b.totalCost)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {b.quantity > 0 ? formatPrice(b.totalCost / b.quantity) : '-'}
                      {b.soldCount > 0 && (() => {
                        const avgSellingPrice = (b.revenue || 0) / b.soldCount;
                        return <span className="text-[10px] block text-emerald-600">均售价¥{Math.round(avgSellingPrice).toLocaleString()}</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-right">{b.quantity}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const itemsCount = b.itemsCount || 0;
                        const quantity = b.quantity || 0;
                        const pct = quantity > 0 ? Math.round((itemsCount / quantity) * 100) : 0;
                        const barColor = pct === 0 ? 'bg-gray-300 dark:bg-gray-600' : pct <= 50 ? 'bg-amber-500' : pct < 100 ? 'bg-sky-500' : 'bg-emerald-500';
                        const isInProgress = pct > 0 && pct < 100;
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">进度</span>
                              <span className={itemsCount >= quantity ? 'text-emerald-600 font-medium text-xs' : itemsCount > 0 ? 'text-amber-600 text-xs' : 'text-muted-foreground text-xs'}>
                                {itemsCount}/{quantity} {pct}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${barColor} ${isInProgress ? 'animate-pulse' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell><Badge variant="outline">{allocMethodLabels[b.costAllocMethod] || b.costAllocMethod}</Badge></TableCell>
                    <TableCell className="text-right">{b.soldCount}/{b.quantity}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(b.revenue)}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const profit = (b.revenue || 0) - (b.totalCost || 0);
                        const margin = (b.revenue || 0) > 0 ? (profit / (b.revenue || 0)) * 100 : 0;
                        return (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {profit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {formatPrice(profit)}
                            </span>
                            <span className={`text-[10px] tabular-nums ${margin >= 0 ? 'text-emerald-500 dark:text-emerald-400/70' : 'text-red-500 dark:text-red-400/70'}`}>
                              {margin.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell><PaybackBar rate={b.paybackRate} /></TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onViewDetail(b.id)} title="查看详情"><Eye className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600" onClick={() => onEdit(b)} title="编辑"><Pencil className="h-3 w-3" /></Button>
                        {b.itemsCount === b.quantity && b.soldCount === 0 && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAllocate(b.id)}>分摊</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => onDelete(b)} title="删除"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredBatches.map(b => (
          <Card key={b.id} className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onClick={() => onViewDetail(b.id)}>
            <CardContent className="p-4 space-y-2">
              {/* Header: batch code + status */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium">{b.batchCode}</span>
                <StatusBadge status={b.status} />
              </div>
              {/* Material + entry progress */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{b.materialName}</span>
                {(() => {
                  const itemsCount = b.itemsCount || 0;
                  const quantity = b.quantity || 0;
                  const pct = quantity > 0 ? Math.round((itemsCount / quantity) * 100) : 0;
                  const barColor = pct === 0 ? 'bg-gray-300 dark:bg-gray-600' : pct <= 50 ? 'bg-amber-500' : pct < 100 ? 'bg-sky-500' : 'bg-emerald-500';
                  const isInProgress = pct > 0 && pct < 100;
                  return (
                    <div className="flex-1 ml-3 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">进度</span>
                        <span className={`text-xs ${itemsCount >= quantity ? 'text-emerald-600 font-medium' : itemsCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {itemsCount}/{quantity}件 {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor} ${isInProgress ? 'animate-pulse' : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* Cost + Revenue + Profit row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">总成本</p>
                  <p className="font-medium">{formatPrice(b.totalCost)}</p>
                  {b.quantity > 0 && <p className="text-xs text-muted-foreground">单价 {formatPrice(b.totalCost / b.quantity)}</p>}
                  {b.soldCount > 0 && (() => {
                    const avgSellingPrice = (b.revenue || 0) / b.soldCount;
                    return <p className="text-xs text-emerald-600">均售价 {formatPrice(avgSellingPrice)}</p>;
                  })()}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">已回款</p>
                  <p className="font-medium text-emerald-600">{formatPrice(b.revenue)}</p>
                </div>
              </div>
              {/* Profit row */}
              {(() => {
                const profit = (b.revenue || 0) - (b.totalCost || 0);
                const margin = (b.revenue || 0) > 0 ? (profit / (b.revenue || 0)) * 100 : 0;
                return (
                  <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40 rounded-lg">
                    <span className="text-xs text-muted-foreground">利润</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium tabular-nums ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {profit >= 0 ? '+' : ''}{formatPrice(profit)}
                      </span>
                      <span className={`text-xs tabular-nums ${margin >= 0 ? 'text-emerald-500 dark:text-emerald-400/70' : 'text-red-500 dark:text-red-400/70'}`}>
                        {margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
              {/* Payback bar */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>回本进度</span>
                  <span>{(b.paybackRate * 100).toFixed(1)}%</span>
                </div>
                <PaybackBar rate={b.paybackRate} />
              </div>
              {/* Sold count */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>已售 {b.soldCount}/{b.quantity}</span>
                {b.purchaseDate && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.purchaseDate}</span>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-1 pt-1 border-t" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={() => onViewDetail(b.id)}><Eye className="h-3 w-3 mr-1" />详情</Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-amber-600" onClick={() => onEdit(b)}><Pencil className="h-3 w-3" /></Button>
                {b.itemsCount === b.quantity && b.soldCount === 0 && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onAllocate(b.id)}>分摊</Button>
                )}
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={() => onDelete(b)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
