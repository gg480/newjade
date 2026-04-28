'use client';

import React, { useState, useEffect } from 'react';
import { itemsApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice } from './shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, CalendarDays, User, FileText } from 'lucide-react';

interface PriceChangeLogsDialogProps {
  itemId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function PriceChangeLogsDialog({ itemId, open, onOpenChange }: PriceChangeLogsDialogProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);

  useEffect(() => {
    if (open && itemId) {
      fetchLogs();
    }
  }, [open, itemId, page, size]);

  const fetchLogs = async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const data = await itemsApi.getPriceChangeLogs(itemId, { page, size });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error('加载调价记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (logs.length === size) setPage(page + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>调价记录</DialogTitle>
        </DialogHeader>
        
        <div className="py-2">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无调价记录
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[60vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          <TableHead>原价格</TableHead>
                          <TableHead>新价格</TableHead>
                          <TableHead>调整幅度</TableHead>
                          <TableHead>调整百分比</TableHead>
                          <TableHead>原因</TableHead>
                          <TableHead>操作人</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-sm">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>{formatPrice(log.oldPrice)}</TableCell>
                            <TableCell className="font-medium">
                              {formatPrice(log.newPrice)}
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${log.changeAmount > 0 ? 'text-emerald-600' : log.changeAmount < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {log.changeAmount > 0 ? '+' : ''}{formatPrice(log.changeAmount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${log.changePercent > 0 ? 'text-emerald-600' : log.changePercent < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {log.changePercent > 0 ? '+' : ''}{log.changePercent.toFixed(2)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{log.reason}</TableCell>
                            <TableCell>{log.operator}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {total} 条记录，第 {page} 页
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handlePrevPage}
                        disabled={page === 1}
                      >
                        上一页
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleNextPage}
                        disabled={logs.length < size}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PriceChangeLogsDialog;