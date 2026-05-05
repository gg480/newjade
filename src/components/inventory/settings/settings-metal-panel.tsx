'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Calculator, History } from 'lucide-react';
import { toast } from 'sonner';
import { metalApi } from '@/lib/api';

interface MetalPanelProps {
  materials: any[];
  onMaterialsChange: (updater: (prev: any[]) => any[]) => void;
  onPreviewReprice: (materialId: number, newPrice: number) => void;
  onPriceHistory: (materialId: number, materialName: string) => void;
}

export default function SettingsMetalPanel({
  materials,
  onMaterialsChange,
  onPreviewReprice,
  onPriceHistory,
}: MetalPanelProps) {
  const metalMaterials = materials.filter((m: any) => m.costPerGram);

  if (metalMaterials.length === 0) {
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
            暂无配置了克重单价的材质。请先在字典管理中为材质设置克重单价。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-amber-400 hover:shadow-sm transition-shadow duration-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-500" />
          贵金属市价管理
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          当前配置了克重单价的材质，市价变动时可批量重算在库货品零售价。
        </p>
        <div className="space-y-3">
          {metalMaterials.map((m: any) => (
            <div key={m.id} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">
                    {m.name}{m.subType ? ` (${m.subType})` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    当前: ¥{m.costPerGram}/克
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-28 h-8 text-sm"
                    placeholder="新单价"
                    id={`metal-price-${m.id}`}
                    onBlur={async (e) => {
                      const val = parseFloat(e.target.value);
                      if (val && val !== m.costPerGram) {
                        try {
                          await metalApi.updatePrice({
                            materialId: m.id,
                            pricePerGram: val,
                          });
                          onMaterialsChange((ms: any[]) =>
                            ms.map((x: any) =>
                              x.id === m.id ? { ...x, costPerGram: val } : x
                            )
                          );
                          toast.success(`${m.name}市价已更新为 ¥${val}/克`);
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    const input = document.getElementById(
                      `metal-price-${m.id}`
                    ) as HTMLInputElement;
                    const val = input ? parseFloat(input.value) : 0;
                    if (val && val > 0) {
                      onPreviewReprice(m.id, val);
                    } else {
                      toast.error('请先输入新单价');
                    }
                  }}
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
