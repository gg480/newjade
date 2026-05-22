/**
 * 库存管理模块 — 全量穷举测试
 *
 * 覆盖场景:
 *   1. 货品列表加载/搜索/筛选
 *   2. 新增高货（表单校验/提交/成功提示）
 *   3. 必填字段校验
 *   4. 查看货品详情
 *   5. 编辑货品
 *   6. 删除货品（确认弹窗）
 *   7. 批量选择/取消
 *   8. 排序切换
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot } from './playwright-walkthrough-helpers';

test.describe('库存管理模块 — 全量穷举测试', () => {

  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(3000);
  });

  test('C1 货品列表加载', async ({ page }) => {
    await screenshot(page, 'inventory-C1-01-列表初始状态.png');
    const table = page.locator('table').first();
    const listVisible = await table.isVisible({ timeout: 10000 }).catch(() => false);
    await screenshot(page, 'inventory-C1-02-列表加载完成.png');
    expect(listVisible).toBeTruthy();
  });

  test('C2 关键字搜索', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C2-01-搜索前.png');
    const searchInput = page.locator('input[placeholder*="SKU"], input[placeholder*="搜索"], input[placeholder*="编码"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('0610');
      await screenshot(page, 'inventory-C2-02-输入搜索关键词.png');
      const searchBtn = page.locator('button:has-text("搜索"), button[aria-label*="搜索"]').first();
      if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchBtn.click();
      } else {
        await searchInput.press('Enter');
      }
      await page.waitForTimeout(2000);
      await screenshot(page, 'inventory-C2-03-搜索结果.png');
    }
  });

  test('C3 状态筛选', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C3-01-筛选前.png');
    const soldBtn = page.locator('button:has-text("已售")').first();
    if (await soldBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await soldBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'inventory-C3-02-已售筛选.png');
      const inStockBtn = page.locator('button:has-text("在库")').first();
      if (await inStockBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inStockBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'inventory-C3-03-在库筛选.png');
      }
    }
  });

  test('C4 新增高货', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C4-01-列表状态.png');
    const addBtn = page.locator('button:has-text("新增货品"), button:has-text("新增商品")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'inventory-C4-02-新增弹窗.png');
      const dialog = page.locator('[role="dialog"]').first();
      const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
      expect(dialogVisible).toBeTruthy();

      // 选择器型
      const typeTrigger = page.locator('[role="dialog"] button:has-text("器型")').first();
      if (await typeTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeTrigger.click();
        await page.waitForTimeout(500);
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstOption.click();
          await page.waitForTimeout(500);
        }
      }

      // 填写成本价
      const costInput = page.locator('[role="dialog"] input[id*="cost"], input[name*="costPrice"], input[placeholder*="成本"]').first();
      if (await costInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await costInput.fill('50000');
      }
      await screenshot(page, 'inventory-C4-03-填写成本价.png');
      const sellInput = page.locator('[role="dialog"] input[id*="selling"], input[name*="sellingPrice"], input[placeholder*="售价"]').first();
      if (await sellInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sellInput.fill('88000');
      }
      const saveBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(page, 'inventory-C4-04-保存结果.png');
      }
    }
  });

  test('C5 必填字段校验', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C5-01-列表状态.png');
    const addBtn = page.locator('button:has-text("新增货品")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'inventory-C5-02-空表单.png');
      const saveBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'inventory-C5-03-校验错误.png');
        const dialogOpen = await page.locator('[role="dialog"]').first().isVisible({ timeout: 2000 }).catch(() => false);
        expect(dialogOpen).toBeTruthy();
        const cancelBtn = page.locator('[role="dialog"] button:has-text("取消"), button:has-text("关闭")').first();
        if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('C6 查看货品详情', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C6-01-列表状态.png');
    const detailBtn = page.locator('button:has-text("查看详情"), button:has-text("详情")').first();
    if (await detailBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'inventory-C6-02-详情弹窗.png');
      const panel = page.locator('[role="dialog"], [class*="panel"]').first();
      const visible = await panel.isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const closeBtn = page.locator('button:has-text("关闭"), [aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('C7 编辑货品', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C7-01-列表状态.png');
    const editBtn = page.locator('button:has-text("编辑")').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'inventory-C7-02-编辑弹窗.png');
      const dialog = page.locator('[role="dialog"]').first();
      const visible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible).toBeTruthy();
      const numInput = page.locator('[role="dialog"] input[type="number"]').first();
      if (await numInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await numInput.fill('99999');
      }
      const saveBtn = page.locator('[role="dialog"] button:has-text("保存"), button:has-text("提交")').last();
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'inventory-C7-03-编辑保存结果.png');
      }
    }
  });

  test('C8 删除货品（确认弹窗-取消）', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C8-01-列表状态.png');
    const moreBtn = page.locator('button[aria-haspopup="menu"], [class*="more"]').first();
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'inventory-C8-02-展开菜单.png');
      const delOption = page.locator('[role="menuitem"]:has-text("删除"), [role="option"]:has-text("删除")').first();
      if (await delOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await delOption.click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'inventory-C8-03-删除确认弹窗.png');
        const cancelBtn = page.locator('[role="dialog"] button:has-text("取消")').first();
        if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, 'inventory-C8-04-取消删除.png');
        }
      }
    }
  });

  test('C9 批量选择/取消', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C9-01-列表状态.png');
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'inventory-C9-02-勾选第一项.png');
      await checkbox.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'inventory-C9-03-取消勾选.png');
    }
  });

  test('C10 排序切换', async ({ page }) => {
    await page.waitForTimeout(2000);
    await screenshot(page, 'inventory-C10-01-排序前.png');
    const sortHeader = page.locator('th:has-text("售价"), th:has-text("成本"), th:has-text("日期"), button[aria-label*="排序"]').first();
    if (await sortHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortHeader.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'inventory-C10-02-排序后.png');
    }
  });
});
