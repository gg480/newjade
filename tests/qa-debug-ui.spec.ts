import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5000';

test.describe('浏览器内验证行情', () => {
  test('打开贵金属市价页，检查local-reference面板', async ({ page }) => {
    // 监听console
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

    // 监听API响应
    const apiResponses: Record<string, any> = {};
    page.on('response', async resp => {
      const url = resp.url();
      if (url.includes('/api/metal-prices/local-reference') || url.includes('/api/metal-prices/market')) {
        try {
          apiResponses[url] = { status: resp.status(), body: await resp.json() };
        } catch { /* ignore */ }
      }
    });

    // 登录
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    const loginBtn = page.locator('button:has-text("登 录")');
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[placeholder="输入用户名"]', 'admin');
      await page.fill('input[placeholder="输入密码"]', 'admin123');
      await loginBtn.click();
      await page.waitForTimeout(2000);
    }

    // 导航到系统设置 → 贵金属市价
    await page.click('button:has-text("系统设置")');
    await page.waitForTimeout(1000);
    await page.click('text=系统设置 >> nth=0');
    await page.waitForTimeout(2000);
    await page.click('button[role="tab"]:has-text("贵金属市价")');
    await page.waitForTimeout(5000);

    // 截图
    await page.screenshot({ path: '.playwright-cli/qa-gzjn-ui.png', fullPage: true });
  });
});
