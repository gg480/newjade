'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet } from 'lucide-react';
import SettingsImportCsvPanel from './settings-import-csv-panel';
import SettingsImportDataPanel from './settings-import-data-panel';

type ImportMode = 'csv' | 'standard';

interface UnifiedImportPanelProps {
  // CSV 导入 props
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

  // 标准导入 props
  importType: 'items' | 'sales';
  setImportType: (t: 'items' | 'sales') => void;
  importFile: File | null;
  importing: boolean;
  importResult: { successCount: number; failCount: number; total: number; results: { success: boolean; row: number; skuCode: string | null; name: string | null; error: string | null }[] } | null;
  autoCreate: boolean;
  setAutoCreate: (v: boolean) => void;
  skipExisting: boolean;
  setSkipExisting: (v: boolean) => void;
  previewData: { headers: string[]; rows: string[][] } | null;
  onFileSelect: (file: File | null) => void;
  onImport: () => void;
  downloadTemplateUrl: string;
}

export default function SettingsImportPanel(props: UnifiedImportPanelProps) {
  const [mode, setMode] = useState<ImportMode>('csv');

  return (
    <div className="mt-4 space-y-4">
      {/* 模式切换 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg w-fit">
            <Button
              variant={mode === 'csv' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setMode('csv')}
            >
              <Upload className="h-3.5 w-3.5" />
              快速导入
            </Button>
            <Button
              variant={mode === 'standard' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setMode('standard')}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              标准导入
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 根据模式渲染对应的子面板 */}
      {mode === 'csv' ? (
        <SettingsImportCsvPanel
          csvFile={props.csvFile}
          setCsvFile={props.setCsvFile}
          csvImporting={props.csvImporting}
          csvResult={props.csvResult}
          csvDragOver={props.csvDragOver}
          setCsvDragOver={props.setCsvDragOver}
          onDownloadCsvTemplate={props.onDownloadCsvTemplate}
          onCsvImport={props.onCsvImport}
        />
      ) : (
        <SettingsImportDataPanel
          importType={props.importType}
          setImportType={props.setImportType}
          importFile={props.importFile}
          importing={props.importing}
          importResult={props.importResult}
          autoCreate={props.autoCreate}
          setAutoCreate={props.setAutoCreate}
          skipExisting={props.skipExisting}
          setSkipExisting={props.setSkipExisting}
          previewData={props.previewData}
          onFileSelect={props.onFileSelect}
          onImport={props.onImport}
          downloadTemplateUrl={props.downloadTemplateUrl}
        />
      )}
    </div>
  );
}
