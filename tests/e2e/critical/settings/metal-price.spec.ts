/**
 * 关键路径 — 设置域：贵金属行情（端到端业务流）
 *
 * 单场景端到端：登录 → 导航 → 验证全部子功能
 * 使用 globalSetup 预置的 storageState，无需重复登录。
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../../../helpers/index';

test.describe('设置：贵金属行情（端到端业务流）', () => {

  test('行情管理全流程', async ({ page }) => {
    // ── 1. 登录 + 导航到系统设置 ──
    await loginAsAdmin(page);
    const navBtns = page.locator('button:has-text("系统设置")');
    await expect(navBtns.first()).toBeVisible({ timeout: 5000 });
    await navBtns.first().click();
    await page.waitForTimeout(500);
    const menuItem = page.getByRole('menuitem').filter({ hasText: '系统设置' }).first();
    await menuItem.click();
    await page.waitForTimeout(2000);

    // ── 3. 点击贵金属行情 Tab ──
    const metalTab = page.getByRole('tab').filter({ hasText: /贵金属|行情|金价/ }).first();
    await expect(metalTab).toBeVisible({ timeout: 5000 });
    await metalTab.click();
    await page.waitForTimeout(3000);

    // ── 4. 验证行情价 + 最终售价 ──
    const marketPrice = page.locator('text=行情价').first();
    await expect(marketPrice).toBeVisible({ timeout: 5000 });
    const finalPrice = page.locator('text=最终售价').first();
    await expect(finalPrice).toBeVisible({ timeout: 5000 });
    const fpText = await finalPrice.textContent() || '';
    expect(fpText).toMatch(/¥\d+(\.\d+)?\/克/);
    console.log('✅ 行情价 + 最终售价:', fpText.trim());

    // ── 5. 工费编辑 ──
    const laborInput = page.locator('input[type="number"]').first();
    await expect(laborInput).toBeVisible({ timeout: 5000 });
    await laborInput.fill('120');
    await page.waitForTimeout(300);
    const saveBtn = page.locator('button').filter({ hasText: '保存' }).first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
    }
    console.log('✅ 工费编辑完成');

    // ── 6. 行情走势图 ──
    const trendTitle = page.locator('text=行情走势').first();
    await expect(trendTitle).toBeVisible({ timeout: 5000 });
    console.log('✅ 行情走势图可见');

    // ── 7. 价格历史 ──
    const historyBtn = page.locator('button').filter({ hasText: '历史记录' }).first();
    await expect(historyBtn).toBeVisible({ timeout: 5000 });
    await historyBtn.scrollIntoViewIfNeeded();
    await historyBtn.click();
    await page.waitForTimeout(4000);
    // 检测弹窗出现（Dialog 组件或价格历史文字）
    const dialogVisible = await page.locator('[role="dialog"]').isVisible({ timeout: 3000 }).catch(() => false);
    const textVisible = await page.getByText('价格历史', { exact: false }).isVisible({ timeout: 2000 }).catch(() => false);
    expect(dialogVisible || textVisible).toBeTruthy();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('✅ 价格历史');

    // ── 8. 竞品对比 ──
    const competitorBtn = page.locator('button').filter({ hasText: '竞品对比' }).first();
    await expect(competitorBtn).toBeVisible({ timeout: 5000 });
    await competitorBtn.scrollIntoViewIfNeeded();
    await competitorBtn.click();
    await page.waitForTimeout(4000);
    const compTitle = page.getByText('竞品', { exact: false }).first();
    const compVisible = await compTitle.isVisible({ timeout: 5000 }).catch(() => false);
    expect(compVisible).toBeTruthy();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('✅ 竞品对比');

    // ── 9. 每日分享 ──
    const shareBtn = page.locator('button').filter({ hasText: '每日分享' }).first();
    await expect(shareBtn).toBeVisible({ timeout: 5000 });
    await shareBtn.click();
    await page.waitForTimeout(3000);
    const shareDialog = page.locator('[role="dialog"]').filter({ hasText: /每日分享/ }).first();
    await expect(shareDialog).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('✅ 每日分享弹窗');

    // ── 10. 一键同步按钮 ──
    const syncBtn = page.locator('button').filter({ hasText: '一键同步' }).first();
    await expect(syncBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ 一键同步按钮');

    // ── 11. 融通金参考 ──
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const refPanel = page.locator('text=融通金').first();
    await expect(refPanel).toBeVisible({ timeout: 5000 });
    console.log('✅ 融通金参考面板');

    console.log('\n🎉 全流程 11 项验证全部通过');
  });
});
