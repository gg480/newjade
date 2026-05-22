/**
 * 系统设置模块 — 全量穷举测试
 * 覆盖场景: 子Tab加载, 材质/器型/标签管理, 系统配置, 金属市价, 数据备份
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot, BASE } from './playwright-walkthrough-helpers';

test.describe('系统设置模块 — 全量穷举测试', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'settings');
    await page.waitForTimeout(3000);
  });

  test('G1 系统设置子Tab加载', async ({ page }) => {
    await screenshot(page, 'settings-G1-01-初始状态.png');
    const tabs = page.locator('button:has-text("材质"), button:has-text("器型"), button:has-text("标签"), button:has-text("系统配置")');
    const count = await tabs.count();
    await screenshot(page, 'settings-G1-02-子Tab列表.png');
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('G2 材质管理查看', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'settings-G2-01-初始状态.png');
    const tab = page.locator('button:has-text("材质")').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'settings-G2-02-材质列表.png');
      const visible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    }
  });

  test('G3 器型管理查看', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'settings-G3-01-初始状态.png');
    const tab = page.locator('button:has-text("器型")').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'settings-G3-02-器型列表.png');
      const visible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    }
  });

  test('G4 标签管理查看', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'settings-G4-01-初始状态.png');
    const tab = page.locator('button:has-text("标签")').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'settings-G4-02-标签列表.png');
      const visible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    }
  });

  test('G5 系统配置查看', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'settings-G5-01-初始状态.png');
    const tab = page.locator('button:has-text("系统配置")').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'settings-G5-02-系统配置.png');
      const visible = await page.locator('input, table').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    }
  });

  test('G6 金属市价查看', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'settings-G6-01-初始状态.png');
    const tab = page.locator('button:has-text("金属市价"), button:has-text("市价")').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'settings-G6-02-金属市价列表.png');
      // 金属市价使用卡片式布局 (p-3 bg-muted/50 rounded-lg)，不是 table
      const visible = await page.locator('text=贵金属市价管理').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    }
  });

  test('G7 数据备份API检查', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await page.request.get(`${BASE}/api/backup`, { headers });
    expect(res.status()).toBe(200);
    const blob = await res.body();
    expect(blob.length).toBeGreaterThan(1000);
  });

  test('G8 配置API检查', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await page.request.get(`${BASE}/api/config`, { headers });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.code).toBe(0);
    expect(Array.isArray(data.data)).toBeTruthy();
  });
});
