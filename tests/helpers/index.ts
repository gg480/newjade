/**
 * 测试共享辅助函数（统一入口）
 *
 * 合并自：
 *   - playwright-walkthrough-helpers.ts（截图/登录/导航）
 *   - business-test-helpers.ts（表单/对话框/断言）
 *
 * 导航模式：下拉菜单（导航组→子菜单项）
 */

import { Page, expect } from '@playwright/test';
import * as path from 'path';

export const BASE = 'https://localhost:5001';
export const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

// ============================================================
// 截图
// ============================================================

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: true });
}

// ============================================================
// 认证
// ============================================================

/** Tab 名称 → 导航组映射 */
const TAB_GROUP_MAP: Record<string, string> = {
  '货品管理': '库存',
  '批次管理': '库存',
  '库存盘点': '库存',
  '入货建议': '库存',
  '销售记录': '销售',
  '客户管理': '销售',
  '促销活动': '销售',
  '内容推广': '销售',
  '系统设置': '系统设置',
  '操作日志': '系统设置',
};

/** 通过 API 登录并将 token 注入 localStorage */
export async function ensureLoggedIn(page: Page) {
  const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  const loginData = await loginRes.json();

  if (loginData.code === 0 && loginData.data?.token) {
    const token = loginData.data.token;
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);
    await page.evaluate((t) => { localStorage.setItem('auth_token', t); }, token);
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });

    try {
      await page.locator('button:has-text("看板")').first().waitFor({ state: 'visible', timeout: 20000 });
    } catch {
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
    // 降级：UI 登录
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('admin123');
    await page.locator('button:has-text("登 录")').first().click();
    await page.waitForTimeout(3000);
  }
}

/** UI 表单登录（直接填写登录页，或使用 storageState 快速登录） */
export async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');

  // 检查是否已登录（storageState 预置 token）
  const isLoggedIn = await page.locator('button:has-text("看板")').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (isLoggedIn) return;

  // 未登录回退：UI 表单登录
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('admin123');
  await page.locator('button:has-text("登")').click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=兴盛艺珠宝').first()).toBeVisible({ timeout: 10000 });
}

// ============================================================
// 导航
// ============================================================

/** 通过导航下拉菜单切换到指定 Tab */
export async function navigateTo(page: Page, tabKey: string) {
  const tabNames: Record<string, string> = {
    inventory: '货品管理',
    batches: '批次管理',
    stocktaking: '库存盘点',
    restock: '入货建议',
    sales: '销售记录',
    customers: '客户管理',
    promotion: '促销活动',
    'content-promotion': '内容推广',
    settings: '系统设置',
    logs: '操作日志',
    dashboard: '看板',
  };
  const tabName = tabNames[tabKey] || tabKey;
  const groupName = TAB_GROUP_MAP[tabName];

  if (groupName) {
    const groupBtn = page.locator('nav button').filter({ hasText: groupName }).first();
    await groupBtn.click();
    await page.waitForTimeout(500);
    const menuItem = page.getByRole('menuitem').filter({ hasText: tabName }).first();
    await menuItem.click();
  } else {
    const directBtn = page.locator('nav button').filter({ hasText: tabName }).first();
    await directBtn.click();
  }
  await page.waitForTimeout(1500);
}

/** 通过中文 Tab 名称导航 */
export async function navigateToTab(page: Page, tabName: string) {
  const groupName = TAB_GROUP_MAP[tabName];
  if (groupName) {
    const groupBtn = page.locator('nav button').filter({ hasText: groupName }).first();
    await groupBtn.click();
    await page.waitForTimeout(500);
    const menuItem = page.getByRole('menuitem').filter({ hasText: tabName }).first();
    await menuItem.click();
  } else {
    const directBtn = page.locator('nav button').filter({ hasText: tabName }).first();
    await directBtn.click();
  }
  await page.waitForTimeout(1500);
}

// ============================================================
// 表单操作
// ============================================================

/** 打开创建对话框 */
export async function openCreateDialog(page: Page) {
  const createBtn = page.locator('button').filter({ hasText: /新增入库|新建|创建|新增/ }).first();
  await createBtn.click();
  await page.waitForTimeout(500);
}

/** 点击对话框中的确认/保存按钮 */
export async function clickConfirmButton(page: Page) {
  const btn = page.locator('[role="dialog"] button').filter({ hasText: /确认入库|确认出库|确认新增|确认创建|创建促销|创建批次|保存修改|保存|确定|提交|确认|创建/ }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true });
  } else {
    const fallbackBtn = page.locator('button').filter({ hasText: /确认入库|确认出库|确认新增|确认创建|创建促销|创建批次|保存修改|保存|确定|提交|确认|创建/ }).first();
    await fallbackBtn.click({ force: true });
  }
  await page.waitForTimeout(1500);
}

/** 在 Input/Textarea 中填写值 */
export async function fillField(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: false });
  if (await field.isVisible().catch(() => false)) {
    await field.fill(value);
  }
}

/** 选择 Select 下拉选项 */
export async function selectOption(page: Page, label: string, optionText: string) {
  const select = page.getByLabel(label, { exact: false });
  if (await select.isVisible().catch(() => false)) {
    await select.click();
    await page.waitForTimeout(300);
    const option = page.getByRole('option').filter({ hasText: optionText }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
    }
  }
}

// ============================================================
// 断言辅助
// ============================================================

/** 验证无错误 toast */
export async function expectNoError(page: Page) {
  const errorToast = page.locator('[role="alert"], .error, .text-red-500').filter({ hasText: /错误|失败|异常/ }).first();
  const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
  expect(hasError).toBe(false);
}
