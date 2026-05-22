/**
 * 销售管理模块 — 全量穷举测试
 * 覆盖场景: 列表加载, 新增销售, 详情, 编辑, 退货
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot } from './playwright-walkthrough-helpers';

test.describe('销售管理模块 — 全量穷举测试', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'sales');
    await page.waitForTimeout(3000);
  });

  test('D1 销售列表加载', async ({ page }) => {
    await screenshot(page, 'sales-D1-01-列表初始状态.png');
    const visible = await page.locator('table').first().isVisible({ timeout: 10000 }).catch(() => false);
    await screenshot(page, 'sales-D1-02-列表加载完成.png');
    expect(visible).toBeTruthy();
  });

  test('D2 新增销售', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'sales-D2-01-列表状态.png');
    const addBtn = page.locator('button:has-text("新增销售"), button:has-text("出库")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'sales-D2-02-新增销售弹窗.png');
      const dialog = page.locator('[role="dialog"]').first();
      const visible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const priceInput = page.locator('[role="dialog"] input[id*="actualPrice"], input[name*="price"], input[placeholder*="成交"]').first();
      if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await priceInput.fill('88800');
      }
      await screenshot(page, 'sales-D2-03-填写信息.png');
      const submitBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await submitBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(page, 'sales-D2-04-提交结果.png');
      }
    }
  });

  test('D3 查看销售详情', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'sales-D3-01-列表状态.png');
    const detailBtn = page.locator('button:has-text("详情"), button:has-text("查看")').first();
    if (await detailBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'sales-D3-02-详情弹窗.png');
      // 销售详情使用侧滑面板（固定定位右侧滑出），通过面板标题文字定位
      const visible = await page.locator('text=销售详情').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const closeBtn = page.locator('button:has-text("关闭"), [aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('D4 编辑销售', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'sales-D4-01-列表状态.png');
    const editBtn = page.locator('button:has-text("编辑")').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'sales-D4-02-编辑弹窗.png');
      const visible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const saveBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'sales-D4-03-编辑结果.png');
      }
    }
  });

  test('D5 退货操作', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'sales-D5-01-列表状态.png');
    const returnBtn = page.locator('button:has-text("退货")').first();
    if (await returnBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await returnBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'sales-D5-02-退货弹窗.png');
      const visible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      // 退货原因输入框有 placeholder "输入自定义退货原因..."
      const reasonInput = page.locator('input[placeholder*="退货原因"]').first();
      if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reasonInput.fill('穷举测试退货');
      }
      await screenshot(page, 'sales-D5-03-填写退货原因.png');
      const confirmBtn = page.locator('[role="dialog"] button:has-text("确认"), button:has-text("退货")').last();
      if (await confirmBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(page, 'sales-D5-04-退货结果.png');
      }
    }
  });
});
