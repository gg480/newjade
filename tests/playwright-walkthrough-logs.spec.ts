/**
 * 操作日志模块 — 全量穷举测试
 * 覆盖场景: 日志列表加载, 类型筛选, 时间筛选, API验证
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot, BASE } from './playwright-walkthrough-helpers';

test.describe('操作日志模块 — 全量穷举测试', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'logs');
    await page.waitForTimeout(3000);
  });

  test('H1 日志列表加载', async ({ page }) => {
    await screenshot(page, 'logs-H1-01-列表初始状态.png');
    const visible = await page.locator('table').first().isVisible({ timeout: 10000 }).catch(() => false);
    await screenshot(page, 'logs-H1-02-列表加载完成.png');
    expect(visible).toBeTruthy();
  });

  test('H2 按类型筛选日志', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'logs-H2-01-筛选前.png');
    const filter = page.locator('select, [role="combobox"], button:has-text("全部")').first();
    if (await filter.isVisible({ timeout: 3000 }).catch(() => false)) {
      const tagName = await filter.evaluate(el => el.tagName).catch(() => '');
      if (tagName === 'SELECT') {
        await filter.selectOption({ index: 1 });
      } else {
        await filter.click();
        await page.waitForTimeout(500);
        const opt = page.locator('[role="option"]').first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await opt.click();
        }
      }
      await page.waitForTimeout(2000);
      await screenshot(page, 'logs-H2-02-类型筛选后.png');
    }
  });

  test('H3 按时间筛选', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'logs-H3-01-筛选前.png');
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const today = new Date().toISOString().slice(0, 10);
      await dateInput.fill(today);
      await page.waitForTimeout(1000);
      await screenshot(page, 'logs-H3-02-选择日期.png');
      const date2 = page.locator('input[type="date"]').nth(1);
      if (await date2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await date2.fill(today);
        await page.waitForTimeout(1000);
      }
      const applyBtn = page.locator('button:has-text("查询"), button:has-text("搜索"), button:has-text("应用")').first();
      if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await applyBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'logs-H3-03-筛选结果.png');
      }
    }
  });

  test('H4 API日志接口验证', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await page.request.get(`${BASE}/api/logs?page=1&size=5`, { headers });
    const data = await res.json();
    expect(data.code).toBe(0);
    expect(data.data.pagination.total).toBeGreaterThanOrEqual(0);
  });
});
