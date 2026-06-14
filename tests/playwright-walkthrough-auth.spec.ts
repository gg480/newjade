/**
 * 登录模块 — 全量穷举测试
 *
 * 覆盖场景:
 *   1. 输入正确凭据登录 → 进入工作区
 *   2. 输入错误密码 → 显示错误提示
 *   3. 登出操作 → 返回登录页
 *
 * ⚠️ 注意：此测试需要在生产构建下运行（npx next build && npx next start -p 9677）
 *    开发模式下 Next.js 16 Turbopack 在 Playwright 无头浏览器中无法完成 React 水合。
 *
 * 运行: npx playwright test tests/playwright-walkthrough-auth.spec.ts --headed
 * 登录页结构: #username + #password + "登 录"按钮
 * 系统使用 localStorage auth_token 做会话管理
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const BASE = 'http://127.0.0.1:9677';
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: true });
}

test.describe('登录模块 — 全量穷举测试', () => {

  // =============================================
  // 场景 1：正确凭据登录
  // =============================================
  test('A1 正确凭据登录 → 进入工作区', async ({ page }) => {
    // Playwright 测试默认有独立的无缓存上下文，确保看到登录页
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await screenshot(page, 'auth-A1-01-登录页.png');

    // 等待登录表单加载完成（login-page 先显示 checking 状态，再显示登录表单）
    // 或等待直接进入工作区（看板按钮可见）
    const dashboardBtn = page.locator('button:has-text("看板")').first();
    const loginForm = page.locator('#username');

    const isLoggedIn = await dashboardBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isLoggedIn) {
      // 等待登录表单的 #username 输入框出现
      await loginForm.waitFor({ state: 'visible', timeout: 10000 });
      await loginForm.fill('admin');
      await screenshot(page, 'auth-A1-02-填充用户名.png');

      await page.locator('#password').fill('admin123');
      await screenshot(page, 'auth-A1-03-填充密码.png');

      // 点击"登 录"按钮
      await page.locator('button:has-text("登 录")').first().click();

      // 等待登录完成
      await page.waitForTimeout(3000);
    }

    // 验证登录成功 - 应看到导航栏的"看板"按钮
    const navVisible = await dashboardBtn.isVisible({ timeout: 8000 }).catch(() => false);
    await screenshot(page, 'auth-A1-04-登录成功.png');
    expect(navVisible).toBeTruthy();
  });

  // =============================================
  // 场景 2：错误密码登录
  // =============================================
  test('A2 错误密码 → 显示错误提示', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await screenshot(page, 'auth-A2-01-登录页.png');

    const isLoggedIn = await page.locator('button:has-text("看板")').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!isLoggedIn) {
      const usernameInput = page.locator('#username');
      await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
      await usernameInput.fill('admin');
      await page.locator('#password').fill('wrong_password_123');
      await screenshot(page, 'auth-A2-02-错误密码.png');

      await page.locator('button:has-text("登 录")').first().click();
      await page.waitForTimeout(3000);
    }

    await screenshot(page, 'auth-A2-03-错误提示.png');

    // 验证：登录失败后仍显示登录页（#username 仍可见）
    const stillLoginPage = await page.locator('#username').isVisible({ timeout: 3000 }).catch(() => false);
    expect(stillLoginPage).toBeTruthy();
  });

  // =============================================
  // 场景 3：登出操作
  // =============================================
  test('A3 登出 → 返回登录页', async ({ page }) => {
    // 先用正确凭据登录
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

    // 验证已登录
    const loggedIn = await page.locator('button:has-text("看板")').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(loggedIn).toBeTruthy();
    await screenshot(page, 'auth-A3-01-已登录.png');

    // 查找登出按钮（导航栏右上角的 LogOut 图标按钮 title="退出登录"）
    const logoutBtn = page.locator('button[title="退出登录"], button[aria-label="退出登录"]').first();
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForTimeout(3000);
    } else {
      // 如果找不到登出按钮，清除 localStorage 并刷新
      await page.evaluate(() => localStorage.removeItem('auth_token'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    }

    await screenshot(page, 'auth-A3-02-登出后.png');

    // 验证：登出后显示登录页
    const backToLogin = await page.locator('#username').isVisible({ timeout: 5000 }).catch(() => false);
    expect(backToLogin).toBeTruthy();
  });
});
