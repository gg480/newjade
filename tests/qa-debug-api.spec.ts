import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5000';

test.describe('本地行情API调试', () => {
  test('检查local-reference API返回', async ({ page }) => {
    // 直接调用API
    const resp = await page.request.get(`${BASE}/api/metal-prices/local-reference`);
    const body = await resp.json();
    console.log('=== Local Reference API ===');
    console.log('status:', resp.status());
    console.log('code:', body.code);
    console.log('available:', body.data?.available);
    console.log('items count:', body.data?.items?.length || 0);
    if (body.data?.items?.length > 0) {
      console.log('items:', JSON.stringify(body.data.items));
    }
    if (body.data?.message) {
      console.log('message:', body.data.message);
    }
    expect(resp.status()).toBe(200);
  });

  test('检查market API返回(source=gzjn168)', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/metal-prices/market?source=gzjn168`);
    const body = await resp.json();
    console.log('=== Market API (gzjn168) ===');
    console.log('status:', resp.status());
    console.log('code:', body.code);
    if (body.data) {
      console.log('data count:', body.data.length);
      if (body.data.length > 0) {
        console.log('first item:', JSON.stringify(body.data[0]));
      }
    }
    if (body.message) {
      console.log('message:', body.message);
    }
  });
});
