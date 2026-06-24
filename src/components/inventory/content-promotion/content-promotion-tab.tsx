'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sparkles, Lightbulb, FileText, Megaphone, BarChart3,
} from 'lucide-react';
import SelectionTab from './selection-tab';
import TopicsTab from './topics-tab';
import ContentsTab from './contents-tab';
import PromotionsTab from './promotions-tab';
import MetricsTab from './metrics-tab';

/**
 * 内容推广子 Tab 导航（工作流顺序：选品→选题→文案→推广→反馈）
 * AI配置已迁移至系统设置 Tab
 */
type SubTab = 'selection' | 'topics' | 'contents' | 'promotions' | 'metrics';

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ElementType }> = [
  { id: 'selection', label: '选品', icon: Sparkles },
  { id: 'topics', label: '选题中心', icon: Lightbulb },
  { id: 'contents', label: '文案工坊', icon: FileText },
  { id: 'promotions', label: '推广管理', icon: Megaphone },
  { id: 'metrics', label: '反馈追踪', icon: BarChart3 },
];

export default function ContentPromotionTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('selection');

  return (
    <div className="space-y-4">
      {/* 子 Tab 导航 */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveSubTab(tab.id)}
              className={cn('gap-2', !isActive && 'text-muted-foreground')}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* 子 Tab 内容 */}
      {activeSubTab === 'selection' && <SelectionTab />}
      {activeSubTab === 'topics' && <TopicsTab onSwitchTab={(tab) => setActiveSubTab(tab as SubTab)} />}
      {activeSubTab === 'contents' && <ContentsTab />}
      {activeSubTab === 'promotions' && <PromotionsTab />}
      {activeSubTab === 'metrics' && <MetricsTab />}
    </div>
  );
}
