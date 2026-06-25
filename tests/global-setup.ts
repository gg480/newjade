/**
 * Playwright 全局 setup：登录一次，将 token 写入 storageState 供所有测试复用
 */
import { FullConfig, chromium } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // 通过 API 登录
  const loginRes = await page.request.post('https://localhost:5001/api/auth/login', {
    data: { username: 'admin', password: 'admin123' },
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.token || '';

  if (!token) {
    console.error('❌ 全局登录失败:', loginRes.status(), loginData?.message);
    await browser.close();
    process.exit(1);
  }

  // 加载首页，注入 token
  await page.goto('https://localhost:5001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('user', JSON.stringify({
      id: 1, username: 'admin', displayName: '系统管理员', roleName: 'admin',
    }));
  }, token);
  await page.waitForTimeout(500);

  // 保存 storageState（含 localStorage）
  await page.context().storageState({ path: 'tests/e2e/.auth.json' });

  console.log('✅ 全局登录成功，token 已保存');
  await browser.close();
}

export default globalSetup;
