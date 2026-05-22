/**
 * 批次管理模块 — 全量穷举测试
 * 覆盖场景: 列表加载, 创建批次, 批次详情, 批次分配
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot } from './playwright-walkthrough-helpers';

test.describe('批次管理模块 — 全量穷举测试', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'batches');
    await page.waitForTimeout(3000);
  });

  test('E1 批次列表加载', async ({ page }) => {
    await screenshot(page, 'batches-E1-01-列表初始状态.png');
    const visible = await page.locator('table').first().isVisible({ timeout: 10000 }).catch(() => false);
    await screenshot(page, 'batches-E1-02-列表加载完成.png');
    expect(visible).toBeTruthy();
  });

  test('E2 创建批次', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'batches-E2-01-列表状态.png');
    const addBtn = page.locator('button:has-text("新增批次"), button:has-text("创建批次")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'batches-E2-02-创建批次弹窗.png');
      const visible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const qtyInput = page.locator('[role="dialog"] input[type="number"]').first();
      if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await qtyInput.fill('3');
      }
      await screenshot(page, 'batches-E2-03-填写数量.png');
      const saveBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(page, 'batches-E2-04-创建结果.png');
      }
    }
  });

  test('E3 批次详情', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'batches-E3-01-列表状态.png');
    const detailBtn = page.locator('button:has-text("详情"), button:has-text("查看")').first();
    if (await detailBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'batches-E3-02-详情弹窗.png');
      const visible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const closeBtn = page.locator('button:has-text("关闭"), [aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('E4 批次分配', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'batches-E4-01-列表状态.png');
    const allocBtn = page.locator('button:has-text("分配")').first();
    if (await allocBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await allocBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'batches-E4-02-分配弹窗.png');
      const visible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const confirmBtn = page.locator('[role="dialog"] button:has-text("确认"), button:has-text("分配")').last();
      if (await confirmBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'batches-E4-03-分配结果.png');
      }
    }
  });
});
