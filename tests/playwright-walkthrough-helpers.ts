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

export const BASE = 'http://127.0.0.1:5000';
export const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: true });
}

/**
 * 用正确凭据登录（如已登录则跳过）
 */
export async function ensureLoggedIn(page: Page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 检查是否已在工作区（看板按钮可见）
  const isInWorkspace = await page.locator('button:has-text("看板")').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (!isInWorkspace) {
    // 等待登录表单加载完成（login-page 先显示 checking 状态）
    const usernameInput = page.locator('#username');
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill('admin');
    await page.locator('#password').fill('admin123');
    await page.locator('button:has-text("登 录")').first().click();
    await page.waitForTimeout(3000);
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
  const groupBtn = page.locator(`button:has-text("${mapping.groupLabel}")`).first();
  await groupBtn.click();
  await page.waitForTimeout(500);

  // 点击子菜单项（DropdownMenuItem）
  const childItem = page.locator(`[role="menuitem"]:has-text("${mapping.childLabel}"), [role="option"]:has-text("${mapping.childLabel}")`).first();
  if (await childItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await childItem.click();
    await page.waitForTimeout(3000);
  }
}
