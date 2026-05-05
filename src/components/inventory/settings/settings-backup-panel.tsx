'use client';

import React, { RefObject } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Download,
  Upload,
  Database,
  AlertTriangle,
  Loader2,
  Clock,
  Grid,
  Package,
  ShoppingCart,
  Users,
  Layers,
  Trash2,
} from 'lucide-react';
import { formatRelativeTime } from '../settings-tab';

interface BackupPanelProps {
  dataStats: {
    itemsCount: number | null;
    salesCount: number | null;
    customersCount: number | null;
    batchesCount: number | null;
  };
  dbSizeLoading: boolean;
  lastBackupFromStorage: string | null;
  restoreFileInputRef: RefObject<HTMLInputElement | null>;
  restoring: boolean;
  deletedItemsCount: number;
  oldLogsCount: number;
  cleanupLoading: string | null;
  onDownloadBackup: () => void;
  onRestoreFileSelect: (f: File) => void;
  onCleanupDeleted: () => void;
  onCleanupOldLogs: () => void;
}

export default function SettingsBackupPanel({
  dataStats,
  dbSizeLoading,
  lastBackupFromStorage,
  restoreFileInputRef,
  restoring,
  deletedItemsCount,
  oldLogsCount,
  cleanupLoading,
  onDownloadBackup,
  onRestoreFileSelect,
  onCleanupDeleted,
  onCleanupOldLogs,
}: BackupPanelProps) {
  return (
    <div className="space-y-4">
      {/* Data Statistics Card */}
      <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid className="h-4 w-4 text-emerald-500" />
            数据统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Package className="h-3.5 w-3.5" />
                <span className="text-xs">货品总数</span>
              </div>
              <p className="text-lg font-bold">
                {dbSizeLoading ? '...' : (dataStats.itemsCount ?? '...')}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="text-xs">销售总数</span>
              </div>
              <p className="text-lg font-bold">
                {dbSizeLoading ? '...' : (dataStats.salesCount ?? '...')}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">客户总数</span>
              </div>
              <p className="text-lg font-bold">
                {dbSizeLoading ? '...' : (dataStats.customersCount ?? '...')}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Layers className="h-3.5 w-3.5" />
                <span className="text-xs">批次总数</span>
              </div>
              <p className="text-lg font-bold">
                {dbSizeLoading ? '...' : (dataStats.batchesCount ?? '...')}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center col-span-2 md:col-span-1">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Database className="h-3.5 w-3.5" />
                <span className="text-xs">数据库</span>
              </div>
              <p className="text-sm font-medium">SQLite</p>
              {lastBackupFromStorage && (
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  上次备份: {lastBackupFromStorage}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download backup */}
      <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-red-500" />
            备份数据库
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            下载当前数据库文件（SQLite），可用于数据迁移或定期备份。
          </p>
          {/* 最近备份时间卡片 */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">最近备份时间</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {lastBackupFromStorage ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-foreground">
                    {formatRelativeTime(lastBackupFromStorage)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({lastBackupFromStorage})
                  </span>
                </span>
              ) : (
                <span className="italic">尚未备份</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={onDownloadBackup}
            >
              <Download className="h-4 w-4 mr-2" />
              下载数据库备份
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Restore backup */}
      <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-red-500" />
            恢复数据库
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            从备份文件恢复数据库。恢复前会自动保存当前数据库为安全副本。
          </p>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 mb-4">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              ⚠️ 恢复操作将覆盖当前所有数据，请谨慎操作！
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={restoreFileInputRef}
              type="file"
              accept=".db,.sqlite,.sqlite3,application/octet-stream"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onRestoreFileSelect(f);
                e.currentTarget.value = '';
              }}
              className="hidden"
            />
            <Button
              variant="outline"
              className="h-9"
              onClick={() => restoreFileInputRef.current?.click()}
              disabled={restoring}
            >
              <Upload className="h-4 w-4 mr-2" />
              上传备份文件
            </Button>
            {restoring && (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-red-400" />
            数据说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              • 数据库为 SQLite
              单文件，包含所有业务数据（货品、销售、客户等）
            </p>
            <p>
              • 图片文件需单独备份（
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                public/images/
              </code>{' '}
              目录）
            </p>
            <p>
              • Docker 部署时，数据和图片已挂载到本地{' '}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                ./data/
              </code>{' '}
              目录
            </p>
            <p>• 建议定期下载备份，特别是进行大批量操作前</p>
          </div>
        </CardContent>
      </Card>

      {/* Data Cleanup Section */}
      <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            数据清理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            清理不必要的数据，释放数据库空间。此操作不可撤销，请谨慎执行。
          </p>
          <div className="space-y-3">
            {/* Clear deleted items */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">清除已删除货品</p>
                  <p className="text-xs text-muted-foreground">
                    彻底删除标记为删除的货品记录
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {deletedItemsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  >
                    {deletedItemsCount} 条
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                  disabled={
                    deletedItemsCount === 0 || cleanupLoading === 'deleted'
                  }
                  onClick={onCleanupDeleted}
                >
                  {cleanupLoading === 'deleted' ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  清除
                </Button>
              </div>
            </div>
            {/* Clear old logs */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">清除操作日志(30天前)</p>
                  <p className="text-xs text-muted-foreground">
                    删除超过30天的历史操作日志
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {oldLogsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    {oldLogsCount} 条
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                  disabled={oldLogsCount === 0 || cleanupLoading === 'logs'}
                  onClick={onCleanupOldLogs}
                >
                  {cleanupLoading === 'logs' ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  清除
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
