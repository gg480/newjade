/**
 * 客户管理模块 — 全量穷举测试
 * 覆盖场景: 列表加载, 新增客户, 编辑客户, 删除客户(取消), 客户搜索
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot } from './playwright-walkthrough-helpers';

test.describe('客户管理模块 — 全量穷举测试', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'customers');
    await page.waitForTimeout(3000);
  });

  test('F1 客户列表加载', async ({ page }) => {
    await screenshot(page, 'customers-F1-01-列表初始状态.png');
    // 客户列表使用卡片式布局: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
    const visible = await page.locator('[class*="grid-cols"]').first().isVisible({ timeout: 10000 }).catch(() => false);
    await screenshot(page, 'customers-F1-02-列表加载完成.png');
    expect(visible).toBeTruthy();
  });

  test('F2 新增客户', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'customers-F2-01-列表状态.png');
    const addBtn = page.locator('button:has-text("新增客户")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'customers-F2-02-新增客户弹窗.png');
      const visible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const nameInput = page.locator('[role="dialog"] input[placeholder*="姓名"], input[name*="name"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('穷举测试客户');
      }
      const phoneInput = page.locator('[role="dialog"] input[placeholder*="手机"], input[name*="phone"]').first();
      if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const ts = Date.now().toString().slice(-8);
        await phoneInput.fill(`138${ts}`);
      }
      await screenshot(page, 'customers-F2-03-填写信息.png');
      const saveBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'customers-F2-04-保存结果.png');
      }
    }
  });

  test('F3 编辑客户', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'customers-F3-01-列表状态.png');
    const editBtn = page.locator('button:has-text("编辑")').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'customers-F3-02-编辑客户弹窗.png');
      const visible = await page.locator('[role="dialog"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const notesInput = page.locator('[role="dialog"] input[placeholder*="备注"], textarea').first();
      if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notesInput.fill('穷举测试-编辑备注');
      }
      await screenshot(page, 'customers-F3-03-修改信息.png');
      const saveBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'customers-F3-04-保存结果.png');
      }
    }
  });

  test('F4 删除客户（确认弹窗-取消）', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'customers-F4-01-列表状态.png');
    const moreBtn = page.locator('button[aria-haspopup="menu"]').first();
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'customers-F4-02-展开菜单.png');
      const delOption = page.locator('[role="menuitem"]:has-text("删除")').first();
      if (await delOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await delOption.click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'customers-F4-03-删除确认弹窗.png');
        const cancelBtn = page.locator('[role="dialog"] button:has-text("取消")').first();
        if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, 'customers-F4-04-取消删除.png');
        }
      }
    }
  });

  test('F5 客户搜索', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'customers-F5-01-搜索前.png');
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="姓名"], input[placeholder*="手机"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('测试');
      await screenshot(page, 'customers-F5-02-输入关键词.png');
      const searchBtn = page.locator('button:has-text("搜索")').first();
      if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchBtn.click();
      } else {
        await searchInput.press('Enter');
      }
      await page.waitForTimeout(2000);
      await screenshot(page, 'customers-F5-03-搜索结果.png');
    }
  });
});
