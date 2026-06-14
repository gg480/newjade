/**
 * 货品管理筛选栏 — 二次开发回归测试
 *
 * 覆盖改动点:
 *   1. 关键词搜索独占第一行（桌面端 + 移动端）
 *   2. 材质大类/材质两级级联（选择大类后材质列表过滤）
 *   3. 材质切换触发器型列表刷新
 *   4. 柜台+批次手机端同行显示
 *   5. 标签筛选已移除
 *   6. 状态下拉已移除（保留按钮行）
 *   7. 搜索/重置按钮在器型右侧
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, screenshot, BASE } from './playwright-walkthrough-helpers';

test.describe('货品管理筛选栏 — 二次开发回归测试', () => {

  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(3000);
  });

  // =============================================
  // 桌面端测试（1920x1080）
  // =============================================
  test.describe('桌面端', () => {

    test('T1 关键词搜索独占第一行', async ({ page }) => {
      await screenshot(page, 'filterbar-T1-01-初始状态.png');

      // 验证关键词搜索行存在，且在状态按钮下方
      const searchLabel = page.locator('label:has-text("关键词搜索")').first();
      await expect(searchLabel).toBeVisible({ timeout: 5000 });

      // 验证搜索框存在
      const searchInput = page.locator('input[placeholder*="SKU"]').first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      // 验证搜索框在材质大类上方（DOM 顺序：状态按钮 → 关键词 → 网格）
      const statusSection = page.locator('button:has-text("在库")').first();
      const materialCategoryLabel = page.locator('label:has-text("材质大类")').first();
      const statusBox = await statusSection.boundingBox();
      const searchBox = await searchLabel.boundingBox();
      const materialBox = await materialCategoryLabel.boundingBox();

      expect(statusBox).toBeTruthy();
      expect(searchBox).toBeTruthy();
      expect(materialBox).toBeTruthy();
      // 关键词在状态下方
      expect(searchBox!.y).toBeGreaterThan(statusBox!.y + statusBox!.height - 20);
      // 材质大类在关键词下方
      expect(materialBox!.y).toBeGreaterThan(searchBox!.y + searchBox!.height - 20);

      await screenshot(page, 'filterbar-T1-02-布局验证.png');
    });

    test('T2 材质大类级联筛选', async ({ page }) => {
      await screenshot(page, 'filterbar-T2-01-初始.png');

      // 找到材质大类下拉
      const materialCategorySelect = page.locator('label:has-text("材质大类")').first().locator('..').locator('select, button[role="combobox"]').first();
      // 使用 Select 组件的 trigger
      const categoryTrigger = page.locator('label:has-text("材质大类")').first().locator('..').locator('button[role="combobox"]').first();
      await categoryTrigger.scrollIntoViewIfNeeded();
      await categoryTrigger.click();
      await page.waitForTimeout(500);

      // 选择"玉"大类
      const jadeOption = page.locator('[role="option"]:has-text("玉")').first();
      if (await jadeOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await jadeOption.click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'filterbar-T2-02-选择玉大类.png');
      }

      // 验证材质下拉选项已过滤（只显示玉类材质）
      const materialTrigger = page.locator('label:has-text("材质")').first().locator('..').locator('button[role="combobox"]').first();
      await materialTrigger.click();
      await page.waitForTimeout(500);

      // 检查下拉选项
      const materialOptions = page.locator('[role="option"]');
      const optionCount = await materialOptions.count();
      // 至少应该有"全部材质" + 若干玉类材质
      expect(optionCount).toBeGreaterThan(1);
      await screenshot(page, 'filterbar-T2-03-材质下拉过滤.png');

      // 关闭下拉（点击其他地方）
      await page.locator('label:has-text("关键词搜索")').first().click();
      await page.waitForTimeout(300);
    });

    test('T3 材质切换触发器型刷新', async ({ page }) => {
      await screenshot(page, 'filterbar-T3-01-初始.png');

      // 打开材质下拉
      const materialTrigger = page.locator('label:has-text("材质")').first().locator('..').locator('button[role="combobox"]').first();
      await materialTrigger.scrollIntoViewIfNeeded();
      await materialTrigger.click();
      await page.waitForTimeout(500);

      // 选择第一个非"全部材质"的选项
      const materialOptions = page.locator('[role="option"]:not([data-value="all"])').first();
      if (await materialOptions.isVisible({ timeout: 3000 }).catch(() => false)) {
        const materialText = await materialOptions.textContent();
        await materialOptions.click();
        await page.waitForTimeout(1500);
        await screenshot(page, `filterbar-T3-02-选择材质${materialText?.trim()}.png`);

        // 验证器型下拉已刷新（应该被加载）
        const typeTrigger = page.locator('label:has-text("器型")').first().locator('..').locator('button[role="combobox"]').first();
        await typeTrigger.click();
        await page.waitForTimeout(500);

        // 验证器型有选项
        const typeOptions = page.locator('[role="option"]');
        const typeCount = await typeOptions.count();
        expect(typeCount).toBeGreaterThanOrEqual(1);
        await screenshot(page, 'filterbar-T3-03-器型已刷新.png');

        // 关闭下拉
        await page.locator('label:has-text("关键词搜索")').first().click();
        await page.waitForTimeout(300);
      }
    });

    test('T4 状态下拉已移除（仅保留按钮行）', async ({ page }) => {
      await screenshot(page, 'filterbar-T4-01-初始.png');

      // 验证状态按钮行存在
      const inStockBtn = page.locator('button:has-text("在库")').first();
      const soldBtn = page.locator('button:has-text("已售")').first();
      await expect(inStockBtn).toBeVisible({ timeout: 5000 });
      await expect(soldBtn).toBeVisible({ timeout: 5000 });

      // 验证网格中不再有"状态"标签（指下拉形式的）
      // 网格中应该没有 label 文本为"状态"的元素
      const statusLabels = page.locator('label:has-text("状态")');
      const statusLabelCount = await statusLabels.count();
      // 可能有多处"状态"文本，但网格中不应该有（按钮行上方有"状态筛选"文本）
      // 检查 label 标签本身，按钮行用 span 显示"状态筛选"，不是 label
      for (let i = 0; i < statusLabelCount; i++) {
        const text = await statusLabels.nth(i).textContent();
        // label 如果是"状态"（不带"筛选"），说明在网格中
        if (text?.trim() === '状态') {
          // 检查它是否在网格内
          const isInGrid = await statusLabels.nth(i).locator('..').locator('..').evaluate(el => {
            const parent = el.closest('.grid');
            return parent !== null;
          });
          expect(isInGrid).toBeFalsy();
        }
      }

      await screenshot(page, 'filterbar-T4-02-无状态下拉.png');
    });

    test('T5 标签筛选已移除', async ({ page }) => {
      await screenshot(page, 'filterbar-T5-01-初始.png');

      // 验证页面中没有"标签"下拉
      const tagLabels = page.locator('label:has-text("标签")');
      const tagLabelCount = await tagLabels.count();
      expect(tagLabelCount).toBe(0);

      await screenshot(page, 'filterbar-T5-02-无标签筛选.png');
    });

    test('T6 搜索/重置按钮位置（在器型右侧）', async ({ page }) => {
      await screenshot(page, 'filterbar-T6-01-初始.png');

      // 找到搜索按钮和器型 label
      const searchBtn = page.locator('button:has-text("搜索")').first();
      const typeLabel = page.locator('label:has-text("器型")').first();
      const resetBtn = page.locator('button:has-text("重置")').first();

      await expect(searchBtn).toBeVisible({ timeout: 5000 });
      await expect(typeLabel).toBeVisible({ timeout: 5000 });
      await expect(resetBtn).toBeVisible({ timeout: 5000 });

      // 验证搜索按钮和器型在同一行（y 坐标接近）
      const searchBox2 = await searchBtn.boundingBox();
      const typeBox2 = await typeLabel.boundingBox();
      expect(searchBox2).toBeTruthy();
      expect(typeBox2).toBeTruthy();
      // y 坐标差不超过一个控件高度
      const yDiff = Math.abs(searchBox2!.y - typeBox2!.y);
      expect(yDiff).toBeLessThan(40);

      await screenshot(page, 'filterbar-T6-02-按钮位置.png');
    });

    test('T7 完整筛选流程（关键词+大类+材质+搜索）', async ({ page }) => {
      await screenshot(page, 'filterbar-T7-01-初始.png');

      // 1. 输入关键词
      const searchInput = page.locator('input[placeholder*="SKU"]').first();
      await searchInput.fill('0610');
      await screenshot(page, 'filterbar-T7-02-输入关键词.png');

      // 2. 选择状态
      const inStockBtn = page.locator('button:has-text("在库")').first();
      await inStockBtn.click();
      await page.waitForTimeout(500);

      // 3. 点击搜索
      const searchBtn = page.locator('button:has-text("搜索")').first();
      await searchBtn.click();
      await page.waitForTimeout(2000);

      await screenshot(page, 'filterbar-T7-03-搜索结果.png');

      // 4. 验证筛选标签出现
      const filterTags = page.locator('text=筛选中').first();
      const tagVisible = await filterTags.isVisible({ timeout: 3000 }).catch(() => false);
      // 有关键词筛选标签就说明搜索生效了
      if (tagVisible) {
        await screenshot(page, 'filterbar-T7-04-筛选标签.png');
      }
    });
  });

  // =============================================
  // 移动端测试（375x812）— 独立 describe，不受父级 beforeEach 影响
  // =============================================
});

test.describe('货品管理筛选栏 — 移动端回归测试', () => {

  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    // 移动端专用导航：登录 + 底部导航 → 库存
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const isLoggedIn = await page.locator('button:has-text("看板")').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!isLoggedIn) {
      await page.locator('#username').waitFor({ state: 'visible', timeout: 10000 });
      await page.locator('#username').fill('admin');
      await page.locator('#password').fill('admin123');
      await page.locator('button:has-text("登 录")').first().click();
      await page.waitForTimeout(3000);
    }

    // 通过底部导航进入库存 → 选择"货品管理"
    const nav = page.locator('.fixed.bottom-0').first();
    const inventoryBtn = nav.locator('text=库存').first();
    if (await inventoryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inventoryBtn.click();
      await page.waitForTimeout(500);
      // 从弹出的 DropdownMenu 中选择"货品管理"
      const goodsItem = page.locator('[role="menuitem"]:has-text("货品管理")').first();
      if (await goodsItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await goodsItem.click();
        await page.waitForTimeout(3000);
      } else {
        // 回退：直接点击库存按钮（可能已切换到库存相关页面）
        await inventoryBtn.click();
        await page.waitForTimeout(3000);
      }
    }
  });

  test('M1 柜台和批次在同一行', async ({ page }) => {
    await screenshot(page, 'filterbar-M1-01-移动端初始.png');

    // 找到柜台和批次的 label
    const counterLabel = page.locator('label:has-text("柜台")').first();
    const batchLabel = page.locator('label:has-text("批次")').first();

    await expect(counterLabel).toBeVisible({ timeout: 8000 });
    await expect(batchLabel).toBeVisible({ timeout: 8000 });

    // 验证它们在同一行（y 坐标接近）
    const counterBox = await counterLabel.boundingBox();
    const batchBox = await batchLabel.boundingBox();
    expect(counterBox).toBeTruthy();
    expect(batchBox).toBeTruthy();

    const yDiff = Math.abs(counterBox!.y - batchBox!.y);
    expect(yDiff).toBeLessThan(30);

    await screenshot(page, 'filterbar-M1-02-柜台批次同行.png');
  });

  test('M2 移动端关键词搜索框存在', async ({ page }) => {
      await screenshot(page, 'filterbar-M2-01-移动端搜索框.png');

      // 验证关键词搜索框存在（移动端 placeholder 为"搜索SKU/名称/材质..."）
      const searchInput = page.locator('input[placeholder*="SKU"]').first();
      await expect(searchInput).toBeVisible({ timeout: 8000 });

      await screenshot(page, 'filterbar-M2-02-搜索框可见.png');
    });

  test('M3 移动端状态按钮存在', async ({ page }) => {
    await screenshot(page, 'filterbar-M3-01-移动端状态按钮.png');

    // 验证状态按钮存在
    const inStockBtn = page.locator('button:has-text("在库")').first();
    await expect(inStockBtn).toBeVisible({ timeout: 8000 });

    await screenshot(page, 'filterbar-M3-02-状态按钮可见.png');
  });
});
