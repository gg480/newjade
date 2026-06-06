import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5000';

test.describe('调试gzjn168爬取', () => {
  test('检查原始HTML结构', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/metal-prices/debug-gzjn`);
    const body = await resp.json();
    console.log('=== 调试信息 ===');
    console.log('ok:', body.ok);
    console.log('length:', body.length);
    console.log('has_tr:', body.has_tr);
    console.log('has_td:', body.has_td);
    console.log('has_table:', body.has_table);
    console.log('has_li:', body.has_li);
    console.log('has_div:', body.has_div);
    console.log('has_strong:', body.has_strong);
    console.log('has_b:', body.has_b);
    if (body.first_1000) {
      console.log('first_1000:', body.first_1000.substring(0, 500));
    }
    if (body.error) {
      console.log('error:', body.error);
    }
    expect(resp.status()).toBe(200);
  });
});
