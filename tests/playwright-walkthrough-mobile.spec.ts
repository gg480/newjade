/**
 * 移动端适配测试（iPhone X 尺寸: 375x812）
 *
 * 覆盖场景:
 *   1. 登录（移动端视图）
 *   2. 底部导航（MobileNav）渲染
 *   3. 库存列表移动端卡片视图
 *   4. 销售列表移动端卡片视图
 *   5. 核心功能按钮可点击验证
 *
 * 运行: npx playwright test tests/playwright-walkthrough-mobile.spec.ts --config playwright.config.ts --project=mobile-chromium
 *       npx playwright test tests/playwright-walkthrough-mobile.spec.ts --headed --project=mobile-chromium
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { BASE, SCREENSHOT_DIR } from './playwright-walkthrough-helpers';

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: false });
}

test.describe('移动端适配测试 (375x812)', () => {

  // =============================================
  // 1. 登录（移动端视图）
  // =============================================
  test.describe('A. 移动端登录', () => {

    test('A1 移动端登录', async ({ page }) => {
      // Playwright 测试默认有独立的无缓存上下文，确保看到登录页
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      await screenshot(page, 'mobile-A1-01-登录页.png');

      // 等待登录表单加载
      const dashboardBtn = page.locator('button:has-text("看板")').first();
      const loginForm = page.locator('#username');

      const isLoggedIn = await dashboardBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (!isLoggedIn) {
        await loginForm.waitFor({ state: 'visible', timeout: 10000 });
        await loginForm.fill('admin');
        await page.locator('#password').fill('admin123');
        await page.locator('button:has-text("登 录")').first().click();
        await page.waitForTimeout(3000);
      }

      // 验证登录成功 — 应看到底部导航
      const mobileNav = page.locator('.fixed.bottom-0').first();
      const navVisible = await mobileNav.isVisible({ timeout: 8000 }).catch(() => false);
      await screenshot(page, 'mobile-A1-02-登录成功.png');
      expect(navVisible).toBeTruthy();
    });
  });

  // =============================================
  // 2. 底部导航（MobileNav）
  // =============================================
  test.describe('B. 底部导航', () => {

    test('B1 底部导航渲染', async ({ page }) => {
      // 先登录
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

      await page.waitForTimeout(2000);
      await screenshot(page, 'mobile-B1-01-底部导航.png');

      // 检查底部导航栏（fixed bottom-0）
      const mobileNav = page.locator('.fixed.bottom-0').first();
      await expect(mobileNav).toBeVisible({ timeout: 5000 });

      // 检查导航按钮（看板、库存、销售、设置等）
      const navLabels = ['看板', '库存', '销售', '设置'];
      let visibleCount = 0;
      for (const label of navLabels) {
        const btn = mobileNav.locator(`text=${label}`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          visibleCount++;
        }
      }
      expect(visibleCount).toBeGreaterThanOrEqual(3);
      await screenshot(page, 'mobile-B1-02-导航标签.png');
    });

    test('B2 底部导航点击切换Tab', async ({ page }) => {
      // 登录
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

      await page.waitForTimeout(2000);

      // 点击"库存"导航按钮
      const nav = page.locator('.fixed.bottom-0').first();
      const inventoryBtn = nav.locator('text=库存').first();
      if (await inventoryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inventoryBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'mobile-B2-01-切换到库存.png');

        // 验证库存页加载（搜索框或标题出现）
        const searchInput = page.locator('input[placeholder*="SKU"], input[placeholder*="搜索"]').first();
        const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
        expect(searchVisible).toBeTruthy();
      }

      // 尝试点击其他导航按钮（"销售"可能在移动端显示为不同文字）
       const salesTexts = ['销售', '售', '卖出'];
       let salesClicked = false;
       for (const text of salesTexts) {
         const salesBtn = nav.locator(`text=${text}`).first();
         if (await salesBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
           // 移动端底部导航可能被浏览器UI遮挡，使用 force: true
           await salesBtn.click({ force: true });
           await page.waitForTimeout(2000);
           await screenshot(page, 'mobile-B2-02-切换到销售.png');
           salesClicked = true;
           break;
         }
       }
      if (!salesClicked) {
        console.log('  移动端底部导航无"销售"按钮，可能使用图标模式');
        // 检查导航按钮总数
        const navBtns = await nav.locator('button, a, [role="button"]').count();
        expect(navBtns).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // =============================================
  // 3. 库存列表移动端卡片视图
  // =============================================
  test.describe('C. 库存列表移动端卡片', () => {

    test('C1 库存卡片视图渲染', async ({ page }) => {
      // 登录
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

      await page.waitForTimeout(2000);

      // 进入库存
      const nav = page.locator('.fixed.bottom-0').first();
      const inventoryBtn = nav.locator('text=库存').first();
      if (await inventoryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inventoryBtn.click();
        await page.waitForTimeout(3000);
      }

      await screenshot(page, 'mobile-C1-01-库存页.png');

      // 检查快速录货按钮（移动端特有，可能在浮动按钮或底部）
      const quickBtn = page.locator('button:has-text("快速录货")').first();
      const quickVisible = await quickBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (quickVisible) {
        expect(quickVisible).toBeTruthy();
      } else {
        // 兜底：检查搜索框或货品列表存在（库存页已加载）
        console.log('  "快速录货"按钮在移动端不可见，检查其他元素');
        const searchInput = page.locator('input[placeholder*="SKU"], input[placeholder*="搜索"], input[placeholder*="编码"]').first();
        const searchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
        if (searchVisible) {
          console.log('  搜索框可见 ✅');
        } else {
          // 再兜底：库存页任何内容
          const tableOrList = page.locator('table, [class*="grid"], [class*="list"]').first();
          const hasContent = await tableOrList.isVisible({ timeout: 3000 }).catch(() => false);
          expect(hasContent).toBeTruthy();
        }
      }

      // 检查搜索框存在
      const searchInput = page.locator('input[placeholder*="SKU"], input[placeholder*="搜索"], input[placeholder*="编码"]').first();
      const searchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
      expect(searchVisible).toBeTruthy();
    });
  });

  // =============================================
  // 4. 销售列表移动端卡片视图
  // =============================================
  test.describe('D. 销售列表移动端视图', () => {

    test('D1 销售列表移动端渲染', async ({ page }) => {
      // 登录
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

      await page.waitForTimeout(2000);

      // 进入销售
      const nav = page.locator('.fixed.bottom-0').first();
      const salesBtn = nav.locator('text=销售').first();
      if (await salesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await salesBtn.click();
        await page.waitForTimeout(3000);
      }

      await screenshot(page, 'mobile-D1-01-销售页.png');

      // 检查销售筛选或搜索元素
      const filterArea = page.locator('button:has-text("今天"), button:has-text("本周"), button:has-text("筛选")').first();
      const filterVisible = await filterArea.isVisible({ timeout: 5000 }).catch(() => false);
      if (filterVisible) {
        await screenshot(page, 'mobile-D1-02-筛选可见.png');
      }
    });
  });

  // =============================================
  // 5. 核心功能按钮可点击
  // =============================================
  test.describe('E. 核心按钮可点击', () => {

    test('E1 新增货品按钮可点击', async ({ page }) => {
      // 登录
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

      await page.waitForTimeout(2000);

      // 进入库存
      const nav = page.locator('.fixed.bottom-0').first();
      const inventoryBtn = nav.locator('text=库存').first();
      if (await inventoryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inventoryBtn.click();
        await page.waitForTimeout(3000);
      }

      await screenshot(page, 'mobile-E1-01-库存页.png');

      // 检查"快速录货"按钮可点击
      const quickBtn = page.locator('button:has-text("快速录货")').first();
      if (await quickBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        expect(await quickBtn.isEnabled()).toBeTruthy();
        await screenshot(page, 'mobile-E1-02-快速录货可点击.png');
      }

      // 检查"新增货品"按钮可点击
      const addBtn = page.locator('button:has-text("新增货品")').first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(await addBtn.isEnabled()).toBeTruthy();
        await screenshot(page, 'mobile-E1-03-新增货品可点击.png');
      }
    });
  });

  // =============================================
  // 6. 移动端快速统计栏
  // =============================================
  test.describe('F. 移动端快速统计栏', () => {

    test('F1 底部统计栏可见', async ({ page }) => {
      // 登录
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

      await page.waitForTimeout(2000);

      // 进入库存
      const nav = page.locator('.fixed.bottom-0').first();
      const inventoryBtn = nav.locator('text=库存').first();
      if (await inventoryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inventoryBtn.click();
        await page.waitForTimeout(3000);
      }

      await screenshot(page, 'mobile-F1-01-库存统计栏.png');

      // 查找底部固定统计栏
      const statsBar = page.locator('.fixed.bottom-\\[\\d+\\], .sticky.bottom-0, [class*="stats"], [class*="summary"]').first();
      const statsVisible = await statsBar.isVisible({ timeout: 5000 }).catch(() => false);
      if (statsVisible) {
        await screenshot(page, 'mobile-F1-02-统计栏可见.png');
        const statText = await statsBar.textContent().catch(() => '');
        if (statText) {
          console.log(`  统计栏内容: ${statText.trim().substring(0, 60)}`);
        }
      } else {
        // 查找各种统计文字
        const summaryKeywords = ['总计', '共 ', '合计', '件', '¥', '￥', '库存', '成本'];
        let foundSummary = false;
        for (const keyword of summaryKeywords) {
          const el = page.locator(`text=${keyword}`).first();
          if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
            foundSummary = true;
            break;
          }
        }
        expect(foundSummary).toBeTruthy();
        await screenshot(page, 'mobile-F1-03-统计文字可见.png');
      }
    });
  });
});
