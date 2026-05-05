'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Gem, Box, Tag, Hash, Layers, Crown } from 'lucide-react';
import { formatSpecFieldsDisplay } from '../settings-tab';

interface DictsPanelProps {
  materials: any[];
  types: any[];
  tags: any[];
  tagGroups: Record<string, any[]>;
  tagGroupFilter: string;
  setTagGroupFilter: (v: string) => void;
  tagMaterialFilter: string;
  setTagMaterialFilter: (v: string) => void;
  onShowCreateMaterial: () => void;
  onOpenEditMaterial: (m: any) => void;
  onToggleMaterialActive: (id: number, isActive: boolean) => void;
  onShowCreateType: () => void;
  onOpenEditType: (t: any) => void;
  onToggleType: (id: number) => void;
  onShowCreateTag: () => void;
  onOpenEditTag: (tag: any) => void;
  onToggleTagActive: (id: number, isActive: boolean) => void;
}

export default function SettingsDictsPanel({
  materials,
  types,
  tags,
  tagGroups,
  tagGroupFilter,
  setTagGroupFilter,
  tagMaterialFilter,
  setTagMaterialFilter,
  onShowCreateMaterial,
  onOpenEditMaterial,
  onToggleMaterialActive,
  onShowCreateType,
  onOpenEditType,
  onToggleType,
  onShowCreateTag,
  onOpenEditTag,
  onToggleTagActive,
}: DictsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Materials */}
      <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Gem className="h-4 w-4 text-emerald-500" />
              材质 ({materials.length})
            </CardTitle>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
              onClick={onShowCreateMaterial}
            >
              <Plus className="h-3 w-3 mr-1" />
              新增材质
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Material Statistics Info Bar */}
          {(() => {
            const activeMaterials = materials.filter((m: any) => m.isActive);
            const materialsWithSubType = activeMaterials.filter(
              (m: any) => m.subType
            ).length;
            const categoryCount = new Set(
              activeMaterials.map((m: any) => m.category).filter(Boolean)
            ).size;
            return (
              <div className="mb-3 p-3 bg-muted/30 rounded-lg flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-muted-foreground">材质总数</span>
                  <span className="font-bold">{activeMaterials.length}种</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-sky-600" />
                  <span className="text-muted-foreground">有子类</span>
                  <span className="font-bold">
                    {materialsWithSubType}种
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-muted-foreground">大类</span>
                  <span className="font-bold">{categoryCount}个</span>
                </div>
              </div>
            );
          })()}
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>大类</TableHead>
                  <TableHead>子类</TableHead>
                  <TableHead>产地</TableHead>
                  <TableHead className="text-right">克重单价</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m: any) => (
                  <TableRow
                    key={m.id}
                    className={!m.isActive ? 'opacity-50' : ''}
                  >
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.category || '-'}</TableCell>
                    <TableCell>{m.subType || '-'}</TableCell>
                    <TableCell>{m.origin || '-'}</TableCell>
                    <TableCell className="text-right">
                      {m.costPerGram ? `¥${m.costPerGram}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={m.isActive ? 'default' : 'secondary'}
                        className={
                          m.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : ''
                        }
                      >
                        {m.isActive ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-amber-600"
                          onClick={() => onOpenEditMaterial(m)}
                          title="编辑"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            onToggleMaterialActive(m.id, m.isActive)
                          }
                        >
                          {m.isActive ? '停用' : '启用'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Types */}
      <Card className="border-l-4 border-l-blue-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Box className="h-4 w-4 text-blue-500" />
              器型 ({types.length})
            </CardTitle>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
              onClick={onShowCreateType}
            >
              <Plus className="h-3 w-3 mr-1" />
              新增器型
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>规格字段</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t: any) => (
                  <TableRow
                    key={t.id}
                    className={!t.isActive ? 'opacity-50' : ''}
                  >
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatSpecFieldsDisplay(t.specFields)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={t.isActive ? 'default' : 'secondary'}
                        className={
                          t.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : ''
                        }
                      >
                        {t.isActive ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-amber-600"
                          onClick={() => onOpenEditType(t)}
                          title="编辑"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => onToggleType(t.id)}
                        >
                          {t.isActive ? '停用' : '启用'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card className="border-l-4 border-l-purple-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-500" />
              标签 ({tags.length})
            </CardTitle>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
              onClick={onShowCreateTag}
            >
              <Plus className="h-3 w-3 mr-1" />
              新增标签
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Material + Group filters */}
          <div className="mb-3 flex gap-2 flex-wrap">
            <Select
              value={tagMaterialFilter}
              onValueChange={(v) =>
                setTagMaterialFilter(v === '_all' ? '' : v)
              }
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="全部材质" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部材质</SelectItem>
                {materials
                  .filter((m: any) => m.isActive)
                  .map((m: any) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {Object.keys(tagGroups).length > 1 && (
              <Select
                value={tagGroupFilter}
                onValueChange={(v) =>
                  setTagGroupFilter(v === '_all' ? '' : v)
                }
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="全部分组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">全部分组</SelectItem>
                  {Object.keys(tagGroups).map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-3">
            {Object.entries(tagGroups)
              .filter(
                ([group]) => !tagGroupFilter || group === tagGroupFilter
              )
              .map(([group, groupTags]: [string, any]) => (
                <div key={group}>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(groupTags as any[]).map((tag: any) => (
                      <div key={tag.id} className="group relative">
                        <Badge
                          variant={tag.isActive ? 'default' : 'secondary'}
                          className={`${
                            tag.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'opacity-50'
                          } cursor-pointer pr-6`}
                          onClick={() => onOpenEditTag(tag)}
                          title="点击编辑"
                        >
                          {tag.name}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute -top-1 -right-1 h-4 w-4 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTagActive(tag.id, tag.isActive);
                          }}
                          title={tag.isActive ? '停用' : '启用'}
                        >
                          {tag.isActive ? (
                            <span className="text-[10px]">✕</span>
                          ) : (
                            <span className="text-[10px]">✓</span>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
