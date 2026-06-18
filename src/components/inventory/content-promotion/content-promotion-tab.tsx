'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Lightbulb, FileText, Megaphone, BarChart3, Settings,
} from 'lucide-react';
import TopicsTab from './topics-tab';
import ContentsTab from './contents-tab';
import PromotionsTab from './promotions-tab';
import MetricsTab from './metrics-tab';
import AIConfigTab from './ai-config-tab';

type SubTab = 'topics' | 'contents' | 'promotions' | 'metrics' | 'config';

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ElementType }> = [
  { id: 'topics', label: '选题中心', icon: Lightbulb },
  { id: 'contents', label: '文案工坊', icon: FileText },
  { id: 'promotions', label: '推广管理', icon: Megaphone },
  { id: 'metrics', label: '反馈追踪', icon: BarChart3 },
  { id: 'config', label: 'AI配置', icon: Settings },
];

export default function ContentPromotionTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('topics');

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
      {activeSubTab === 'topics' && <TopicsTab />}
      {activeSubTab === 'contents' && <ContentsTab />}
      {activeSubTab === 'promotions' && <PromotionsTab />}
      {activeSubTab === 'metrics' && <MetricsTab />}
      {activeSubTab === 'config' && <AIConfigTab />}
    </div>
  );
}
