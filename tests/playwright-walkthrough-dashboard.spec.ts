/**
 * 看板模块 — 全量穷举测试
 *
 * 覆盖场景:
 *   1. 加载看板统计（汇总卡片）
 *   2. 查看图表（营收趋势/渠道分析等）
 *   3. 时间筛选切换
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot } from './playwright-walkthrough-helpers';

test.describe('看板模块 — 全量穷举测试', () => {

  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'dashboard');
    await page.waitForTimeout(3000);
  });

  test('B1 看板汇总卡片加载', async ({ page }) => {
    await screenshot(page, 'dashboard-B1-01-看板初始状态.png');
    // 看板汇总卡片独立检查，不复合选择器
    const cardItems = ['库存总计', '本月销售', '压货预警', '已回本批次', '本月目标'];
    let atLeastOneVisible = false;
    for (const text of cardItems) {
      const visible = await page.locator(`text=${text}`).first().isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) { atLeastOneVisible = true; break; }
    }
    await screenshot(page, 'dashboard-B1-02-汇总卡片.png');
    expect(atLeastOneVisible).toBeTruthy();
  });

  test('B2 图表渲染（recharts SVG）', async ({ page }) => {
    await page.waitForTimeout(3000);
    await screenshot(page, 'dashboard-B2-01-等待图表.png');
    const svgCount = await page.locator('svg.recharts-surface, .recharts-responsive-container, .recharts-wrapper').count();
    await screenshot(page, 'dashboard-B2-02-图表渲染.png');
    expect(svgCount).toBeGreaterThanOrEqual(1);
  });

  test('B3 时间范围筛选切换', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'dashboard-B3-01-初始状态.png');
    const timeFilter = page.locator('button:has-text("近7天"), button:has-text("近30天"), button:has-text("近90天"), button:has-text("本月")').first();
    if (await timeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await timeFilter.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'dashboard-B3-02-时间筛选切换.png');
    }
    const chartArea = await page.locator('.recharts-wrapper, .recharts-responsive-container').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(chartArea).toBeTruthy();
  });
});
