import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5000';

test.describe('调试行情API', () => {
  test('先登录再测试local-reference API', async ({ page }) => {
    // 1. 登录
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await page.fill('input[placeholder="输入用户名"]', 'admin');
    await page.fill('input[placeholder="输入密码"]', 'admin123');
    await page.click('button:has-text("登 录")');
    await page.waitForTimeout(2000);

    // 2. 从localStorage取token
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    console.log('auth_token:', token ? token.substring(0, 20) + '...' : 'NONE');

    // 3. 调用 local-reference API（带auth）
    const resp1 = await page.request.get(`${BASE}/api/metal-prices/local-reference`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body1 = await resp1.json();
    console.log('=== local-reference ===');
    console.log('status:', resp1.status());
    console.log('code:', body1.code);
    console.log('available:', body1.data?.available);
    console.log('items:', body1.data?.items?.length);
    console.log('message:', body1.data?.message);
    if (body1.data?.items?.length > 0) {
      console.log('first item:', JSON.stringify(body1.data.items[0]));
    }

    // 4. 调用 market API（带auth）
    const resp2 = await page.request.get(`${BASE}/api/metal-prices/market?source=gzjn168`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body2 = await resp2.json();
    console.log('=== market(gzjn168) ===');
    console.log('status:', resp2.status());
    console.log('code:', body2.code);
    console.log('data count:', body2.data?.length);
    if (body2.data?.length > 0) {
      console.log('first item:', JSON.stringify(body2.data[0]));
    }
    if (body2.message) console.log('message:', body2.message);
  });
});
