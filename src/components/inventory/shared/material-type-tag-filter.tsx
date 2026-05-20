'use client';

import React, { useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface MaterialTypeTagFilterProps {
  /** 当前选中的材质 ID（string，'all' 表示全部） */
  materialId: string
  /** 当前选中的器型 ID */
  typeId: string
  /** 当前选中的标签 ID（可选） */
  tagId?: string
  /** 材质变化回调 */
  onMaterialChange: (v: string) => void
  /** 器型变化回调 */
  onTypeChange: (v: string) => void
  /** 标签变化回调（不传时隐藏标签下拉） */
  onTagChange?: (v: string) => void
  /** 是否显示标签筛选（默认 true） */
  showTag?: boolean
  /** 是否显示器型筛选（默认 true） */
  showType?: boolean
  /** 紧凑模式（缩小控件高度） */
  compact?: boolean
  /** 材质列表数据 */
  materials: { id: number; name: string }[]
  /** 器型列表数据 */
  types: { id: number; name: string }[]
  /** 标签列表数据 */
  tags: { id: number; name: string }[]
  /** 根据材质 ID 加载器型列表（mid=undefined 时加载全部） */
  onLoadTypes: (materialId?: number) => void
  /** 根据材质 ID 加载标签列表（mid=undefined 时加载全部） */
  onLoadTags: (materialId?: number) => void
}

/**
 * 材质/器型/标签三级联动筛选组件
 *
 * - 切换材质时自动重新加载器型和标签列表
 * - 当已有器型/标签不在新列表中时自动复位为"全部"
 * - 支持隐藏器型或标签维度
 */
const MaterialTypeTagFilter: React.FC<MaterialTypeTagFilterProps> = ({
  materialId,
  typeId,
  tagId = 'all',
  onMaterialChange,
  onTypeChange,
  onTagChange,
  showTag = true,
  showType = true,
  compact = false,
  materials,
  types,
  tags,
  onLoadTypes,
  onLoadTags,
}) => {
  /** 材质切换：通知父组件 + 重新加载器型和标签 */
  const handleMaterialChange = useCallback(
    (v: string) => {
      onMaterialChange(v);
      const mid = v === 'all' ? undefined : parseInt(v, 10);
      onLoadTypes(mid);
      onLoadTags(mid);
    },
    [onMaterialChange, onLoadTypes, onLoadTags],
  );

  // 器型列表更新后，检查当前 typeId 是否在选项内，不在则复位
  useEffect(() => {
    if (!showType || typeId === 'all' || types.length === 0) return;
    const validIds = new Set(types.map((t) => t.id.toString()));
    if (!validIds.has(typeId)) {
      onTypeChange('all');
    }
  }, [types, typeId, onTypeChange, showType]);

  // 标签列表更新后，检查当前 tagId 是否在选项内，不在则复位
  useEffect(() => {
    if (!showTag || !onTagChange || tagId === 'all' || tags.length === 0) return;
    const validIds = new Set(tags.map((t) => t.id.toString()));
    if (!validIds.has(tagId)) {
      onTagChange('all');
    }
  }, [tags, tagId, onTagChange, showTag]);

  const triggerClass = compact ? 'h-8 text-xs' : '';
  const labelClass = compact ? 'text-xs' : 'text-sm font-medium';

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* 材质 */}
      <div className="space-y-1.5">
        <Label className={labelClass}>材质</Label>
        <Select value={materialId} onValueChange={handleMaterialChange}>
          <SelectTrigger className={triggerClass}>
            <SelectValue placeholder="选择材质" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部材质</SelectItem>
            {materials.map((m) => (
              <SelectItem key={m.id} value={m.id.toString()}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 器型 */}
      {showType && (
        <div className="space-y-1.5">
          <Label className={labelClass}>器型</Label>
          <Select value={typeId} onValueChange={onTypeChange}>
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder="选择器型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部器型</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 标签 */}
      {showTag && onTagChange && (
        <div className="space-y-1.5">
          <Label className={labelClass}>标签</Label>
          <Select value={tagId} onValueChange={onTagChange}>
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder="选择标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部标签</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 当 showTag=true 但没传 onTagChange 时，用占位格保持网格对齐 */}
      {showTag && !onTagChange && <div />}
    </div>
  );
};

export default MaterialTypeTagFilter;
