'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileDown,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ImportCsvPanelProps {
  csvFile: File | null;
  setCsvFile: (f: File | null) => void;
  csvImporting: boolean;
  csvResult: {
    success: number;
    skipped: number;
    duplicated?: number;
    errors: string[];
    autoCreated?: { materials: string[]; types: string[] };
    inferred?: { row: number; field: string; value: string }[];
  } | null;
  csvDragOver: boolean;
  setCsvDragOver: (v: boolean) => void;
  onDownloadCsvTemplate: () => void;
  onCsvImport: () => void;
}

export default function SettingsImportCsvPanel({
  csvFile,
  setCsvFile,
  csvImporting,
  csvResult,
  csvDragOver,
  setCsvDragOver,
  onDownloadCsvTemplate,
  onCsvImport,
}: ImportCsvPanelProps) {
  return (
    <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-emerald-500" />
          CSV批量导入货品
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs"
          >
            推荐
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          快速导入存量货品。<b>必填列: 名称</b>
          。选填列:
          数量(默认1,同一货品创建N件)、SKU(留空自动生成)、材质(按名称匹配,不存在则自动创建)、器型(按名称匹配,不存在则自动创建)、成本价(单价)、零售价、柜台、采购日期、产地、证书号、匹配码(用于关联销售导入)、备注。名称+成本价+证书号相同的货品自动跳过不重复导入。
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={onDownloadCsvTemplate}
          >
            <FileDown className="h-3.5 w-3.5 mr-1" />
            模板下载
          </Button>
        </div>
        {/* Drag & Drop Upload Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            csvDragOver
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 scale-[1.01]'
              : 'border-muted-foreground/25 hover:border-emerald-300 hover:bg-muted/30'
          }`}
          onClick={() =>
            document.getElementById('csv-import-input')?.click()
          }
          onDragOver={(e) => {
            e.preventDefault(); e.stopPropagation();
            setCsvDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault(); e.stopPropagation();
            setCsvDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation();
            setCsvDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f && f.name.endsWith('.csv')) setCsvFile(f);
          }}
        >
          <Upload
            className={`h-10 w-10 mx-auto mb-3 transition-colors ${
              csvDragOver ? 'text-emerald-500' : 'text-muted-foreground/50'
            }`}
          />
          <p className="text-sm font-medium mb-1">
            拖拽CSV文件到此处或点击上传
          </p>
          <p className="text-xs text-muted-foreground">
            仅支持 .csv 格式（UTF-8编码，含BOM）
          </p>
          <input
            id="csv-import-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCsvFile(f);
            }}
          />
        </div>
        {/* Selected file info */}
        {csvFile && (
          <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">{csvFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(csvFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <Button
              size="sm" variant="ghost"
              className="h-6 w-6 p-0 text-red-500"
              onClick={() => setCsvFile(null)}
            >×</Button>
          </div>
        )}
        {/* Import button */}
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={!csvFile || csvImporting}
          onClick={onCsvImport}
        >
          {csvImporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {csvImporting ? '正在导入...' : '开始导入'}
        </Button>
        {/* Import results */}
        {csvResult && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium">导入结果</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  成功: {csvResult.success}件
                </span>
              </div>
              {(csvResult.duplicated ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    重复跳过: {csvResult.duplicated}件
                  </span>
                </div>
              )}
              {csvResult.skipped > 0 && (
                <div className="flex items-center gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    跳过: {csvResult.skipped}行
                  </span>
                </div>
              )}
              {csvResult.errors.length > 0 && (
                <div className="flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    错误: {csvResult.errors.length}行
                  </span>
                </div>
              )}
            </div>
            {/* Auto-created materials/types */}
            {csvResult.autoCreated &&
              (csvResult.autoCreated.materials.length > 0 ||
                csvResult.autoCreated.types.length > 0) && (
                <div className="p-2 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                  <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-1">
                    自动创建的字典项
                  </p>
                  {csvResult.autoCreated.materials.length > 0 && (
                    <p className="text-xs text-violet-600">
                      材质: {csvResult.autoCreated.materials.join('、')}
                    </p>
                  )}
                  {csvResult.autoCreated.types.length > 0 && (
                    <p className="text-xs text-violet-600">
                      器型: {csvResult.autoCreated.types.join('、')}
                    </p>
                  )}
                </div>
              )}
            {/* Inferred fields */}
            {csvResult.inferred && csvResult.inferred.length > 0 && (
              <div className="p-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg">
                <p className="text-xs font-medium text-sky-700 dark:text-sky-300 mb-1">
                  从名称推断的字段 (共{csvResult.inferred.length}处)
                </p>
                <div className="max-h-20 overflow-y-auto">
                  {csvResult.inferred.slice(0, 10).map((inf, i) => (
                    <p key={i} className="text-xs text-sky-600">
                      第{inf.row}行: 推断{inf.field}={inf.value}
                    </p>
                  ))}
                  {csvResult.inferred.length > 10 && (
                    <p className="text-xs text-muted-foreground">
                      ...还有 {csvResult.inferred.length - 10} 处
                    </p>
                  )}
                </div>
              </div>
            )}
            {csvResult.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                <div className="space-y-1">
                  {csvResult.errors.slice(0, 20).map((err, i) => (
                    <p
                      key={i}
                      className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded px-2 py-1"
                    >{err}</p>
                  ))}
                  {csvResult.errors.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ...还有 {csvResult.errors.length - 20} 条错误
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
