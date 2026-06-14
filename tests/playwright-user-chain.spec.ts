/**
 * 用户行为链 Playwright 前端点击测试
 *
 * 完整用户生命周期 UI 交互（单流程顺序执行）：
 *   管理员登录 → 系统设置 → 用户管理 → 新增用户 → 登出
 *   → 新用户登录 → 首次改密弹窗 → 修改密码 → 登出
 *   → 旧密码登录(应失败) → 新密码登录(应成功)
 *   → API 验证 + 审计日志检查
 *
 * 运行方式：
 *   npx playwright test tests/playwright-user-chain.spec.ts --config playwright.config.ts --headed  # 可视化
 *   npx playwright test tests/playwright-user-chain.spec.ts --config playwright.config.ts           # 无头
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:9677';
let AUTH_TOKEN = '';

// 测试用户（每次运行独立用户名）
const TEST_USER = {
  username: `user_${Date.now().toString(36)}`,
  password: 'T3st@Pass!',
  displayName: 'PW测试用户',
};
const NEW_PASSWORD = 'N3w!Pwd!88';

// ========== 工具函数 ==========

async function clickNav(page: Page, tabName: string) {
  // 直接匹配
  const btn = page.locator(`button:has-text("${tabName}")`).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(500);
    const child = page.locator(`[role="menuitem"]:has-text("${tabName}")`).first();
    if (await child.isVisible({ timeout: 500 }).catch(() => false)) await child.click();
    await page.waitForTimeout(1500);
    return;
  }
  // 下拉菜单
  const map: Record<string, { g: string; c: string }> = {
    '库存管理': { g: '库存', c: '货品管理' },
    '销售记录': { g: '销售', c: '销售记录' },
    '系统设置': { g: '系统设置', c: '系统设置' },
    '操作日志': { g: '系统设置', c: '操作日志' },
  };
  const m = map[tabName];
  if (m) {
    const g = page.locator(`button:has-text("${m.g}")`).first();
    if (await g.isVisible({ timeout: 2000 }).catch(() => false)) {
      await g.click();
      await page.waitForTimeout(500);
      const c = page.locator(`[role="menuitem"]:has-text("${m.c}"), [role="option"]:has-text("${m.c}")`).first();
      if (await c.isVisible({ timeout: 2000 }).catch(() => false)) await c.click();
      await page.waitForTimeout(1500);
    }
  }
}

async function waitReady(page: Page) {
  await page.waitForTimeout(2000);
  for (let i = 0; i < 5; i++) {
    const n = await page.locator('.bg-muted.rounded, [class*="skeleton"]').count();
    if (n === 0) break;
    await page.waitForTimeout(1500);
  }
}

async function loginUI(page: Page, user: string, pass: string) {
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  // 等待 React 水合完成（登录页最多 20s）
  const usernameInput = page.locator('#username');
  await expect(usernameInput).toBeVisible({ timeout: 20000 });
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(pass);
  await page.locator('button:has-text("登 录")').first().click();
  // 等待登录完成进入工作区
  await page.waitForSelector('button:has-text("看板")', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function logoutUI(page: Page) {
  // 清除浏览器中的登录状态（token 存在 localStorage 中）
  await page.evaluate(() => localStorage.removeItem('auth_token'));
  // 导航到首页，应显示登录页
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // 等待 React 渲染登录页
  await expect(page.locator('#username')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

// ========== 单流程测试 ==========

test('用户行为链: 管理员→创建用户→新用户→改密→重登录', async ({ page }) => {
  // ===== Step 1: API 层面准备 =====
  console.log('\n═══ 准备: API 管理员登录 ═══');
  let res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  let data = await res.json();
  expect(data.code).toBe(0);
  AUTH_TOKEN = data.data.token;
  console.log('  ✅ 管理员 API token 已获取');

  // ===== Step 2: 管理员 UI 登录 =====
  console.log('\n═══ Step 1: 管理员 UI 登录 ═══');
  await loginUI(page, 'admin', 'admin123');
  console.log('  ✅ 管理员已进入工作区');

  // ===== Step 3: 导航到用户管理 =====
  console.log('\n═══ Step 2: 系统设置 → 用户管理 ═══');
  await clickNav(page, '系统设置');
  await waitReady(page);

  const usersTab = page.locator('button[role="tab"]:has-text("用户管理")');
  await expect(usersTab).toBeVisible({ timeout: 5000 });
  await usersTab.click();
  await page.waitForTimeout(1500);
  await expect(page.locator('text=用户管理').first()).toBeVisible({ timeout: 5000 });
  console.log('  ✅ 用户管理面板已加载');

  // ===== Step 4: 创建新用户 =====
  console.log('\n═══ Step 3: 新增用户 ═══');
  await page.locator('button:has-text("新增用户")').click();
  await page.waitForTimeout(1000);

  const createDialog = page.locator('[role="dialog"]').filter({ hasText: '新增用户' });
  await expect(createDialog).toBeVisible({ timeout: 3000 });

  // 填写表单
  const inputs = createDialog.locator('input');
  await inputs.nth(0).fill(TEST_USER.username);    // 用户名
  await inputs.nth(1).fill(TEST_USER.displayName);  // 显示名
  await inputs.nth(2).fill(TEST_USER.password);     // 密码

  // 选角色
  const roleTrigger = createDialog.locator('button[role="combobox"]').first();
  if (await roleTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
    await roleTrigger.click();
    await page.waitForTimeout(500);
    const firstOpt = page.locator('[role="option"]').first();
    if (await firstOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOpt.click();
      await page.waitForTimeout(500);
    }
  }

  await createDialog.locator('button:has-text("创建")').click();
  await page.waitForTimeout(2000);

  // 验证用户出现在列表中
  await expect(page.locator(`text=${TEST_USER.username}`).first()).toBeVisible({ timeout: 5000 });
  console.log(`  ✅ 用户 "${TEST_USER.username}" 创建成功`);

  // ===== Step 5: 管理员登出 =====
  console.log('\n═══ Step 4: 管理员登出 ═══');
  await logoutUI(page);
  const loginBtn = page.locator('button:has-text("登 录")');
  await expect(loginBtn).toBeVisible({ timeout: 5000 });
  console.log('  ✅ 管理员已登出');

  // ===== Step 6: 新用户登录 → mustChangePwd 弹窗 =====
  console.log('\n═══ Step 5: 新用户登录 → 强制改密弹窗 ═══');
  // 定位到登录页
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#username')).toBeVisible({ timeout: 20000 });
  await page.locator('#username').fill(TEST_USER.username);
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('button:has-text("登 录")').first().click();
  await page.waitForTimeout(2000);

  // 验证改密弹窗出现
  const changePwdDialog = page.locator('[role="dialog"]').filter({ hasText: '首次登录' });
  await expect(changePwdDialog).toBeVisible({ timeout: 8000 });
  console.log('  ✅ mustChangePwd 弹窗已弹出');

  // 弹窗不可关闭
  expect(await page.locator('[role="dialog"] button[aria-label="Close"]').count()).toBe(0);
  console.log('  ✅ 弹窗无关闭按钮');

  // ===== Step 7: 在改密弹窗中修改密码 =====
  console.log('\n═══ Step 6: 修改密码 ═══');
  const pwdInputs = changePwdDialog.locator('input');
  expect(await pwdInputs.count()).toBeGreaterThanOrEqual(3);

  await pwdInputs.nth(0).fill(TEST_USER.password);   // 旧密码
  await pwdInputs.nth(1).fill(NEW_PASSWORD);           // 新密码
  await pwdInputs.nth(2).fill(NEW_PASSWORD);           // 确认新密码

  // 点确认
  await changePwdDialog.locator('button:has-text("确认")').click();
  await page.waitForTimeout(2000);

  // 弹窗应关闭
  await expect(changePwdDialog).not.toBeVisible({ timeout: 5000 });
  console.log('  ✅ 密码修改成功，弹窗已关闭');

  // ===== Step 8: 旧密码登录 → 应失败 =====
  console.log('\n═══ Step 7: 旧密码登录（应拒绝） ═══');
  await logoutUI(page);
  // （logoutUI 已导航到登录页）
  await page.locator('#username').fill(TEST_USER.username);
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('button:has-text("登 录")').first().click();
  await page.waitForTimeout(2000);

  // 应仍在登录页
  await expect(page.locator('button:has-text("登 录")')).toBeVisible({ timeout: 3000 });
  console.log('  ✅ 旧密码登录被拒绝');

  // ===== Step 9: 新密码登录 → 成功 =====
  console.log('\n═══ Step 8: 新密码登录（应成功） ═══');
  await page.locator('#username').fill(TEST_USER.username);
  await page.locator('#password').fill(NEW_PASSWORD);
  await page.locator('button:has-text("登 录")').first().click();
  await page.waitForSelector('button:has-text("看板")', { timeout: 15000 });
  console.log('  ✅ 新密码登录成功，进入工作区');

  // 验证无改密弹窗
  const stillDialog = page.locator('[role="dialog"]').filter({ hasText: '首次登录' });
  await expect(stillDialog).not.toBeVisible({ timeout: 3000 });
  console.log('  ✅ 无强制改密提示');

  // ===== Step 10: API 验证 =====
  console.log('\n═══ Step 9: API 验证 ═══');
  res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USER.username, password: NEW_PASSWORD }),
  });
  data = await res.json();
  expect(data.code).toBe(0);
  expect(data.data?.user?.mustChangePwd).toBe(false);
  console.log('  ✅ API 确认 mustChangePwd=false');

  // ===== Step 11: 审计日志验证 =====
  console.log('\n═══ Step 10: 审计日志验证 ═══');
  const logsRes = await fetch(`${BASE}/api/logs?page=1&size=100`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
  });
  const logsData = await logsRes.json();
  expect(logsData.code).toBe(0);
  const changeLogs = (logsData.data?.items || []).filter(
    (l: any) => l.action === 'change_password' && l.operator === TEST_USER.username
  );
  expect(changeLogs.length).toBeGreaterThanOrEqual(1);
  console.log(`  ✅ 审计日志 ${changeLogs.length} 条密码变更记录`);

  // 验证脱敏
  for (const log of changeLogs) {
    const d = typeof log.detail === 'string' ? JSON.parse(log.detail) : log.detail;
    const s = JSON.stringify(d);
    expect(s).not.toContain(TEST_USER.password);
    expect(s).not.toContain(NEW_PASSWORD);
  }
  console.log('  ✅ 审计日志密码已脱敏');

  // ===== Step 12: 操作日志 Tab 加载 =====
  console.log('\n═══ Step 11: 操作日志 Tab ═══');
  await clickNav(page, '操作日志');
  await waitReady(page);
  const logTable = page.locator('table').first();
  await expect(logTable).toBeVisible({ timeout: 5000 });
  console.log('  ✅ 操作日志 Tab 加载正常');

  console.log('\n══════════════════════════════');
  console.log('🎉 全部步骤通过！');
  console.log(`   测试用户: ${TEST_USER.username}`);
  console.log(`   初始密码: ${TEST_USER.password}`);
  console.log(`   新密码:   ${NEW_PASSWORD}`);
  console.log('══════════════════════════════');
});
