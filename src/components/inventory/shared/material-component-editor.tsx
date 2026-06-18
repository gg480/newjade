'use client';

import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { DictMaterial, MaterialComponentInput } from '@/lib/api.types';
import { MATERIAL_CATEGORIES } from '@/lib/constants';

// ============================================================
// 类型定义
// ============================================================

interface MaterialComponentEditorProps {
  /** 货品类型：inlay / composite */
  compositeType: 'inlay' | 'composite';
  /** 当前组件列表 */
  components: MaterialComponentInput[];
  /** 组件变更回调 */
  onChange: (components: MaterialComponentInput[]) => void;
  /** 材质字典 */
  materials: DictMaterial[];
}

// 角色标签映射
const ROLE_LABELS: Record<string, string> = {
  main_stone: '主石',
  setting_material: '镶材',
  companion_stone: '伴石',
  component: '组件',
};

// ============================================================
// 内部组件：单行材质组件编辑器
// ============================================================

interface ComponentRowProps {
  component: MaterialComponentInput;
  index: number;
  materials: DictMaterial[];
  /** 是否可删除（镶嵌型主石+镶材不可删，伴石可删） */
  canDelete: boolean;
  /** 是否可修改角色 */
  canChangeRole: boolean;
  onChange: (c: MaterialComponentInput) => void;
  onDelete: () => void;
}

function ComponentRow({ component, index, materials, canDelete, canChangeRole, onChange, onDelete }: ComponentRowProps) {
  // 本地 UI 状态：大类和子类选择（未选材质时使用）
  const [localCategory, setLocalCategory] = useState('');
  const [localSubType, setLocalSubType] = useState('');

  // 按当前材质的大类筛选（用于级联显示）
  const currentMaterial = materials.find(m => m.id === component.materialId);
  // 已选材质时从材质对象取大类，否则用本地 state
  const currentCategory = currentMaterial?.category || localCategory;

  // 派生：当前大类下的子类
  const subTypes = useMemo(() => {
    const set = new Set<string>();
    materials
      .filter(m => !currentCategory || m.category === currentCategory)
      .forEach(m => { if (m.subType) set.add(m.subType); });
    return Array.from(set).sort();
  }, [materials, currentCategory]);

  // 派生：当前大类+子类下的材质
  const filteredMaterials = useMemo(() => {
    if (!currentCategory) return materials;
    const effectiveSubType = currentMaterial?.subType || localSubType;
    if (!effectiveSubType) return materials.filter(m => m.category === currentCategory);
    return materials.filter(m => m.category === currentCategory && m.subType === effectiveSubType);
  }, [materials, currentCategory, currentMaterial, localSubType]);

  const handleCategoryChange = (category: string) => {
    // 切换大类时清空材质选择和本地子类
    onChange({ ...component, materialId: 0 });
    setLocalCategory(category);
    setLocalSubType('');
  };

  const handleMaterialChange = (materialIdStr: string) => {
    const materialId = parseInt(materialIdStr, 10);
    onChange({ ...component, materialId });
  };

  const handleWeightChange = (val: string) => {
    const num = val === '' ? null : parseFloat(val);
    onChange({ ...component, weight: num });
  };

  const handleCostPriceChange = (val: string) => {
    const num = val === '' ? null : parseFloat(val);
    onChange({ ...component, costPrice: num });
  };

  const handleSellingPriceChange = (val: string) => {
    const num = val === '' ? null : parseFloat(val);
    onChange({ ...component, sellingPrice: num });
  };

  // 镶材的售价由系统按 MetalPrice 动态计算，不手动录入
  const isSettingMaterial = component.role === 'setting_material';
  // 组合型组件不需要售价字段
  const showSellingPrice = component.role !== 'component';

  return (
    <div className="rounded-md border border-border p-3 space-y-2 bg-card/50">
      {/* 角色标签 + 删除按钮 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {ROLE_LABELS[component.role] || component.role}
        </span>
        {canDelete && (
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>

      {/* 材质三级级联选择 */}
      <div className="grid grid-cols-3 gap-2">
        <Select
          value={currentCategory}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="大类" />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentMaterial?.subType || localSubType}
          onValueChange={(subType) => {
            // 切换子类时清空材质选择
            onChange({ ...component, materialId: 0 });
            setLocalSubType(subType);
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="子类" />
          </SelectTrigger>
          <SelectContent>
            {subTypes.map(st => (
              <SelectItem key={st} value={st}>{st}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={component.materialId ? String(component.materialId) : ''}
          onValueChange={handleMaterialChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="材质" />
          </SelectTrigger>
          <SelectContent>
            {filteredMaterials.map(m => (
              <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 重量 + 成本价 + 售价 */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">重量(g)</Label>
          <Input
            type="number"
            step="0.01"
            className="h-8 text-xs"
            value={component.weight ?? ''}
            onChange={(e) => handleWeightChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">成本(元)</Label>
          <Input
            type="number"
            step="0.01"
            className="h-8 text-xs"
            value={component.costPrice ?? ''}
            onChange={(e) => handleCostPriceChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
        {showSellingPrice && (
          <div>
            <Label className="text-xs text-muted-foreground">
              {isSettingMaterial ? '售价(动态)' : '售价(元)'}
            </Label>
            <Input
              type="number"
              step="0.01"
              className="h-8 text-xs"
              value={isSettingMaterial ? '' : (component.sellingPrice ?? '')}
              onChange={(e) => handleSellingPriceChange(e.target.value)}
              placeholder={isSettingMaterial ? '按市价计算' : '0.00'}
              disabled={isSettingMaterial}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export function MaterialComponentEditor({
  compositeType,
  components,
  onChange,
  materials,
}: MaterialComponentEditorProps) {
  // 镶嵌型：固定三角色（主石+镶材必填，伴石可选）
  // 组合型：可增删的 component 列表

  const updateComponent = (index: number, c: MaterialComponentInput) => {
    const next = [...components];
    next[index] = c;
    onChange(next);
  };

  const deleteComponent = (index: number) => {
    const next = components.filter((_, i) => i !== index);
    onChange(next);
  };

  const addCompanionStone = () => {
    onChange([...components, {
      materialId: 0,
      role: 'companion_stone',
      weight: null,
      costPrice: null,
      sellingPrice: null,
      sortOrder: components.length,
    }]);
  };

  const addCompositeComponent = () => {
    onChange([...components, {
      materialId: 0,
      role: 'component',
      weight: null,
      costPrice: null,
      sellingPrice: null,
      sortOrder: components.length,
    }]);
  };

  if (compositeType === 'inlay') {
    // 镶嵌型：components 已由父组件初始化为 [主石, 镶材]，伴石可选
    const hasCompanionStone = components.some(c => c.role === 'companion_stone');

    return (
      <div className="space-y-2">
        {components.map((c, idx) => {
          const isCompanionStone = c.role === 'companion_stone';
          // 主石和镶材不可删除，伴石可删除
          const canDelete = isCompanionStone;
          return (
            <ComponentRow
              key={c.role}
              component={c}
              index={idx}
              materials={materials}
              canDelete={canDelete}
              canChangeRole={false}
              onChange={(updated) => updateComponent(idx, updated)}
              onDelete={() => deleteComponent(idx)}
            />
          );
        })}
        {!hasCompanionStone && (
          <Button type="button" variant="outline" size="sm" onClick={addCompanionStone}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加伴石（可选）
          </Button>
        )}
      </div>
    );
  }

  // 组合型
  return (
    <div className="space-y-2">
      {components.map((c, idx) => (
        <ComponentRow
          key={idx}
          component={c}
          index={idx}
          materials={materials}
          canDelete={true}
          canChangeRole={false}
          onChange={(updated) => updateComponent(idx, updated)}
          onDelete={() => deleteComponent(idx)}
        />
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addCompositeComponent}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        添加组件
      </Button>
    </div>
  );
}
