/**
 * 扫码功能冒烟测试
 *
 * 验证：
 * 1. 货品管理页面加载无运行时错误
 * 2. "扫描枪已启用"提示显示
 * 3. 模拟扫描枪快速输入触发 SKU 查询（HID 模式）
 *
 * 注意：摄像头扫码需要真实硬件，无法自动化测试
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo, BASE } from '../../helpers/index';

test.describe('扫码功能冒烟测试', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('货品管理页显示扫描枪已启用提示', async ({ page }) => {
    await navigateTo(page, 'inventory');
    // 验证扫描枪提示显示
    const hint = page.locator('text=扫描枪已启用').first();
    await expect(hint).toBeVisible({ timeout: 10000 });
  });

  test('模拟扫描枪快速输入触发 SKU 查询', async ({ page }) => {
    await navigateTo(page, 'inventory');

    // 等待页面完全加载
    await page.waitForTimeout(2000);

    // 监听控制台错误
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 监听网络请求，验证扫描枪输入触发了 SKU 查询 API
    let apiCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/items/lookup') || req.url().includes('/api/items/')) {
        apiCalled = true;
      }
    });

    // 模拟扫描枪输入：快速逐字符输入一个不存在的 SKU + Enter
    // 扫描枪特征：字符间隔 <50ms，最后 Enter
    const fakeSku = 'TEST-SCAN-999';
    for (const char of fakeSku) {
      await page.keyboard.press(char);
      // 字符间隔 10ms（模拟扫描枪速度）
      await page.waitForTimeout(10);
    }
    await page.keyboard.press('Enter');

    // 等待处理
    await page.waitForTimeout(3000);

    // 验证扫描枪 Hook 触发了 API 查询（核心断言：Hook 工作正常的证据）
    expect(apiCalled).toBe(true);

    // 允许"未找到该货品"这类业务错误日志（SKU 不存在是预期的）
    // 只检查没有 JS 运行时崩溃（如 undefined is not a function）
    const crashErrors = consoleErrors.filter(
      (e) =>
        !e.includes('barcode-detector') &&
        !e.includes('BarcodeDetector') &&
        !e.includes('Failed to load resource') &&
        !e.includes('the server responded with a status') &&
        !e.includes('未找到该货品') &&
        !e.includes('[InventoryTab] Error') &&
        !e.includes('请求失败')
    );
    expect(crashErrors).toHaveLength(0);
  });

  test('摄像头扫码对话框可正常打开和关闭', async ({ page }) => {
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    // 查找并点击扫码按钮（摄像头模式）
    const scanBtn = page.locator('button').filter({ hasText: /扫码|扫描/ }).first();
    if (await scanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scanBtn.click();
      await page.waitForTimeout(1000);

      // 验证对话框打开
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // 验证有摄像头/手动输入切换按钮
      await expect(page.locator('text=摄像头扫码').first()).toBeVisible();
      await expect(page.locator('text=手动输入').first()).toBeVisible();

      // 切换到手动输入模式（避免摄像头权限问题）
      await page.locator('text=手动输入').first().click();
      await page.waitForTimeout(500);

      // 验证手动输入框显示
      await expect(page.locator('input[placeholder*="SKU"]').first()).toBeVisible();

      // 关闭对话框
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });
});
