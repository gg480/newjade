/**
 * 全量穷举测试 — 共享辅助函数
 *
 * 系统使用导航下拉菜单模式：
 *   看板 (直接点击) -> 看板
 *   库存 (下拉) -> 货品管理 | 批次管理 | 库存盘点 | 入货建议
 *   销售 (下拉) -> 销售记录 | 客户管理 | 促销活动
 *   系统设置 (下拉) -> 系统设置 | 操作日志
 */

import { Page } from '@playwright/test';
import * as path from 'path';

export const BASE = 'http://localhost:9677';
export const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: true });
}

/**
 * 用正确凭据登录（如已登录则跳过）
 */
export async function ensureLoggedIn(page: Page) {
  // 先通过 API 登录获取 token
  const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' }
  });
  const loginData = await loginRes.json();

  if (loginData.code === 0 && loginData.data?.token) {
    const token = loginData.data.token;

    // 打开页面
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);

    // 设置 token 到 localStorage
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);

    // 刷新页面
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });

    // 等待工作区加载完成（看板按钮可见）
    // 如果看板按钮不可见，尝试等待更长时间或检查页面状态
    try {
      await page.locator('button:has-text("看板")').first().waitFor({ state: 'visible', timeout: 20000 });
    } catch {
      // 如果看板按钮不可见，尝试 UI 登录
      const usernameInput = page.locator('#username');
      if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await usernameInput.fill('admin');
        await page.locator('#password').fill('admin123');
        await page.locator('button:has-text("登 录")').first().click();
        await page.locator('button:has-text("看板")').first().waitFor({ state: 'visible', timeout: 15000 });
      }
    }
    await page.waitForTimeout(2000);
  } else {
    // 回退：通过 UI 登录
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    await usernameInput.fill('admin');
    await page.locator('#password').fill('admin123');
    await page.locator('button:has-text("登 录")').first().click();
    // 等待工作区加载完成
    await page.locator('button:has-text("看板")').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(2000);
  }
}

/**
 * 切换到指定 Tab
 * 支持: dashboard | inventory | sales | batches | customers | settings | logs
 */
export async function navigateTo(page: Page, tabId: string) {
  // 先确认看板按钮可见（表明已登录并加载完成）
  await page.locator('button:has-text("看板")').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

  if (tabId === 'dashboard') {
    await page.locator('button:has-text("看板")').first().click();
    await page.waitForTimeout(2000);
    return;
  }

  // 对于需要下拉菜单的导航分组
  const groupMap: Record<string, { groupLabel: string; childLabel: string }> = {
    inventory:  { groupLabel: '库存', childLabel: '货品管理' },
    batches:    { groupLabel: '库存', childLabel: '批次管理' },
    stocktaking:{ groupLabel: '库存', childLabel: '库存盘点' },
    restock:    { groupLabel: '库存', childLabel: '入货建议' },
    sales:      { groupLabel: '销售', childLabel: '销售记录' },
    customers:  { groupLabel: '销售', childLabel: '客户管理' },
    promotions: { groupLabel: '销售', childLabel: '促销活动' },
    settings:   { groupLabel: '系统设置', childLabel: '系统设置' },
    logs:       { groupLabel: '系统设置', childLabel: '操作日志' },
  };

  const mapping = groupMap[tabId];
  if (!mapping) return;

  // 点击分组按钮（触发下拉菜单）
  const groupBtn = page.locator(`[data-testid="nav-group-${tabId}"]`).first();
  // 回退：按文本查找
  const groupBtnFallback = page.locator(`button:has-text("${mapping.groupLabel}")`).first();
  const btn = (await groupBtn.count()) > 0 ? groupBtn : groupBtnFallback;
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(500);

  // 点击子菜单项（DropdownMenuItem）
  const childItem = page.locator(`[role="menuitem"]:has-text("${mapping.childLabel}"), [role="option"]:has-text("${mapping.childLabel}")`).first();
  if (await childItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await childItem.click();
    await page.waitForTimeout(3000);
  }
}
