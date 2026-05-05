'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload,
  FileDown,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  Download,
  Settings,
} from 'lucide-react';

interface ImportDataPanelProps {
  importType: 'items' | 'sales';
  setImportType: (v: 'items' | 'sales') => void;
  importFile: File | null;
  importing: boolean;
  importResult: any;
  autoCreate: boolean;
  setAutoCreate: (v: boolean) => void;
  skipExisting: boolean;
  setSkipExisting: (v: boolean) => void;
  previewData: { headers: string[]; rows: string[][] } | null;
  onFileSelect: (file: File) => void;
  onImport: () => void;
  downloadTemplateUrl: string;
}

export default function SettingsImportDataPanel({
  importType,
  setImportType,
  importFile,
  importing,
  importResult,
  autoCreate,
  setAutoCreate,
  skipExisting,
  setSkipExisting,
  previewData,
  onFileSelect,
  onImport,
  downloadTemplateUrl,
}: ImportDataPanelProps) {
  return (
    <div className="space-y-4">
      {/* Import type selector */}
      <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-red-500" />
            数据批量导入
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            上传CSV文件批量导入库存或销售数据。支持自动创建缺失的材质/器型/标签。
          </p>
          <div className="flex items-center gap-4 mb-4">
            <Label className="text-sm font-medium">导入类型</Label>
            <Select value={importType} onValueChange={(v: 'items' | 'sales') => setImportType(v)}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="items">库存数据</SelectItem>
                <SelectItem value="sales">销售数据</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 text-xs" asChild>
              <a href={downloadTemplateUrl} download>
                <FileDown className="h-3.5 w-3.5 mr-1" />下载模板
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File upload area */}
      <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-red-500" />选择文件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('import-file-input')?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              const f = e.dataTransfer.files[0];
              if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) onFileSelect(f);
            }}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">点击或拖拽CSV文件到此处上传</p>
            <p className="text-xs text-muted-foreground">支持 .csv 格式（UTF-8编码）</p>
            <input
              id="import-file-input"
              type="file" accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
            />
          </div>
          {importFile && (
            <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">{importFile.name}</span>
                <span className="text-xs text-muted-foreground">({(importFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => onFileSelect(null as any)}>×</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data preview */}
      {previewData && (
        <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileDown className="h-4 w-4 text-red-500" />数据预览（前5行）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    {previewData.headers.map((h, i) => (
                      <TableHead key={i} className="text-xs whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell className="text-xs text-center text-muted-foreground">{ri + 1}</TableCell>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="text-xs whitespace-nowrap max-w-32 truncate">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options */}
      <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-red-500" />导入选项
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={autoCreate} onCheckedChange={(checked) => setAutoCreate(!!checked)} />
              <div>
                <p className="text-sm font-medium">自动创建缺失的材质/器型/标签</p>
                <p className="text-xs text-muted-foreground">关闭后，遇到不存在的材质或器型时将跳过该行</p>
              </div>
            </label>
            {importType === 'items' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={skipExisting} onCheckedChange={(checked) => setSkipExisting(!!checked)} />
                <div>
                  <p className="text-sm font-medium">SKU已存在时跳过</p>
                  <p className="text-xs text-muted-foreground">关闭后，遇到已存在的SKU将更新该货品信息</p>
                </div>
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import button */}
      <div className="flex items-center gap-3">
        <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!importFile || importing} onClick={onImport}>
          {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {importing ? '正在导入...' : '开始导入'}
        </Button>
        {importFile && !importing && (
          <p className="text-sm text-muted-foreground">
            即将导入 <span className="font-medium text-foreground">{importType === 'items' ? '库存' : '销售'}</span> 数据
          </p>
        )}
      </div>

      {/* Import result */}
      {importResult && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">导入结果</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">成功: {importResult.successCount}条</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">失败: {importResult.failCount}条</span>
              </div>
              <div className="p-2 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">总计: {importResult.total}条</span>
              </div>
            </div>
            {importResult.results && importResult.results.filter((r: any) => !r.success).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-red-600">失败详情：</p>
                <div className="max-h-64 overflow-y-auto border rounded-lg custom-scrollbar">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-14">行号</TableHead><TableHead>SKU</TableHead><TableHead>名称</TableHead><TableHead>失败原因</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {importResult.results.filter((r: any) => !r.success).map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-center">{r.row}</TableCell>
                          <TableCell className="text-xs font-mono">{r.skuCode || '-'}</TableCell>
                          <TableCell className="text-xs">{r.name || '-'}</TableCell>
                          <TableCell className="text-xs text-red-600">{r.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => {
                  const failed = importResult.results.filter((r: any) => !r.success);
                  const csv = ['行号,SKU,名称,失败原因', ...failed.map((r: any) => `${r.row},${r.skuCode || ''},${r.name || ''},${r.error || ''}`)].join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `导入失败记录_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click(); URL.revokeObjectURL(url);
                }}><Download className="h-3 w-3 mr-1" />下载失败记录</Button>
              </div>
            )}
            {importResult.results && importResult.results.filter((r: any) => r.success).length > 0 && (
              <details className="mt-3">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  查看成功记录（{importResult.results.filter((r: any) => r.success).length}条）
                </summary>
                <div className="max-h-48 overflow-y-auto border rounded-lg mt-2 custom-scrollbar">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-14">行号</TableHead><TableHead>SKU</TableHead><TableHead>名称</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {importResult.results.filter((r: any) => r.success).map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-center">{r.row}</TableCell>
                          <TableCell className="text-xs font-mono">{r.skuCode || '-'}</TableCell>
                          <TableCell className="text-xs">{r.name || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-600" />导入说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• 请先下载模板，按模板格式填写数据后再上传</p>
            <p>• CSV文件需使用 <code className="px-1 py-0.5 bg-muted rounded text-xs">UTF-8</code> 编码，Excel另存为CSV时选择"CSV UTF-8"</p>
            <p>• <b>库存导入</b>必填字段：名称；选填数量(默认1)、材质、器型、成本价(单价)、匹配码等；材质/器型可从名称自动推断</p>
            <p>• <b>销售导入</b>必填字段：名称或SKU编号、成交价；如SKU不存在则按匹配码→名称+成本价匹配，匹配不到自动创建已售货品</p>
            <p>• <b>匹配码</b>用于关联库存和销售数据：在库存CSV和销售CSV中使用相同的匹配码，系统自动关联</p>
            <p>• 开启"自动创建"后，系统会自动创建CSV中提到但字典中不存在的材质、器型</p>
            <p>• 名称+成本价+证书号相同的库存货品自动跳过不重复导入</p>
            <p>• 建议先少量测试导入，确认无误后再大批量导入</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
