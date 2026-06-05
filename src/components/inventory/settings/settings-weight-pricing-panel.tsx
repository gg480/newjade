'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Scale } from 'lucide-react';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { metalApi } from '@/lib/api';
import type { DictMaterial } from '@/lib/api.types';

interface WeightPricingPanelProps {
  /** 非贵金属但有 costPerGram 的材质 */
  materials: DictMaterial[];
  onMaterialsChange: (updater: (prev: DictMaterial[]) => DictMaterial[]) => void;
}

/**
 * 克重定价面板 — 用于非贵金属但按克重定价的材质（翡翠/和田玉等）
 * 直接编辑克价，失焦自动保存
 */
export default function SettingsWeightPricingPanel({
  materials,
  onMaterialsChange,
}: WeightPricingPanelProps) {
  const { handleError } = useErrorHandler();

  // 过滤：非贵金属 + 有 costPerGram
  const weightMaterials = materials.filter(
    (m: DictMaterial) =>
      m.category !== '贵金属' && m.costPerGram != null
  );

  if (weightMaterials.length === 0) {
    return (
      <Card className="border-l-4 border-l-teal-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-teal-500" />
            克重定价
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            暂无配置了克重单价的非贵金属材质。请在字典管理中为材质设置克重单价。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-teal-400 hover:shadow-sm transition-shadow duration-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-teal-500" />
          克重定价
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          非贵金属材质按克重定价，直接编辑克价即可。
        </p>
        <div className="space-y-2">
          {weightMaterials.map((m: DictMaterial) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.category || '未分类'}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <span className="text-sm text-muted-foreground">
                  克价:
                </span>
                <Input
                  type="number"
                  className="w-24 h-8 text-sm"
                  placeholder="元/克"
                  defaultValue={m.costPerGram ?? ''}
                  onBlur={async (e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val < 0) {
                      // 恢复原值
                      e.target.value = String(m.costPerGram ?? '');
                      return;
                    }
                    if (val === m.costPerGram) return;
                    try {
                      await metalApi.updatePrice({
                        materialId: m.id,
                        pricePerGram: val,
                      });
                      onMaterialsChange((ms: DictMaterial[]) =>
                        ms.map((x: DictMaterial) =>
                          x.id === m.id ? { ...x, costPerGram: val } : x
                        )
                      );
                      toast.success(`${m.name} 克价已更新为 ¥${val}/克`);
                    } catch (error) {
                      e.target.value = String(m.costPerGram ?? '');
                      handleError(error, {
                        title: '更新克价失败',
                        silent: true,
                      });
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  元/克
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
