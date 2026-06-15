/**
 * 扫码拍摄功能 — E2E 测试
 *
 * 覆盖场景：
 *   1. UI 测试：库存页面"扫码拍摄"按钮、全屏界面元素
 *   2. API 测试：POST /api/items/scan-photo 接口（文件上传）
 *   3. API 测试：GET /api/items/lookup 扫码查询
 *   4. 集成测试：模拟输入SKU查询、角度切换、下一件功能
 *
 * 注意：摄像头（MediaDevices API）在无头 Playwright 中不可用，
 * 摄像头启动和拍照流程通过 API 直接测试文件上传来覆盖。
 */

import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateTo } from './playwright-walkthrough-helpers';

const BASE = 'http://localhost:9677';

/** 6个拍摄角度 */
const ANGLES = [
  { code: 'F', label: '正面俯拍' },
  { code: 'S', label: '侧面45°' },
  { code: 'D', label: '局部特写' },
  { code: 'X1', label: '特征照1' },
  { code: 'X2', label: '特征照2' },
  { code: 'X3', label: '特征照3' },
];

/** 创建最小有效的 JPEG 图片 Buffer */
function createTestImageBuffer(): Buffer {
  // 极简 JPEG 文件头 + 内容（1x1 像素灰图）
  const jpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x7D, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31,
    0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91,
    0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33,
    0x62, 0x72, 0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26,
    0x27, 0x28, 0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43,
    0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57,
    0x58, 0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73,
    0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A,
    0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4,
    0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7,
    0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA,
    0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2,
    0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08,
    0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7B, 0x94, 0x11, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF,
    0xD9,
  ]);
  return jpeg;
}

// ── 阶段1: 前端 UI 测试 ──

test.describe('阶段1: 前端 UI 测试', () => {

  test('1.1 库存页面存在"扫码拍摄"按钮', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await expect(scanPhotoBtn).toBeVisible({ timeout: 5000 });
    await expect(scanPhotoBtn).toBeEnabled();
  });

  test('1.2 点击"扫码拍摄"打开全屏界面', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    // 验证全屏界面出现
    await expect(page.locator('text=扫码拍摄').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=先拍后录').first()).toBeVisible({ timeout: 5000 });
  });

  test('1.3 扫码输入框存在且可交互', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    // 验证扫码输入框
    const skuInput = page.locator('input[placeholder*="输入SKU编码"]').first();
    await expect(skuInput).toBeVisible({ timeout: 5000 });
    await expect(skuInput).toBeEnabled();
  });

  test('1.4 输入SKU后查询按钮可用', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    const skuInput = page.locator('input[placeholder*="输入SKU编码"]').first();
    await skuInput.click();
    await skuInput.fill('0610');
    await page.locator('h2').first().click();
    await page.waitForTimeout(500);

    const queryBtn = page.locator('button:has-text("查询")').first();
    await expect(queryBtn).toBeEnabled({ timeout: 5000 });
  });

  test('1.5 关闭扫码拍摄界面', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    // 点击关闭按钮（X 图标）
    const closeBtn = page.locator('button[aria-label="关闭"]').first();
    await closeBtn.click();
    await page.waitForTimeout(1000);

    // 验证界面关闭（扫码拍摄按钮重新可见）
    await expect(scanPhotoBtn).toBeVisible({ timeout: 5000 });
  });
});

// ── 阶段2: API 测试（直接测试后端接口） ──

test.describe('阶段2: 后端 API 测试', () => {

  let authToken = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { username: 'admin', password: 'admin123' },
    });
    const data = await res.json();
    if (data.code === 0 && data.data?.token) {
      authToken = data.data.token;
    }
  });

  test('2.1 POST /api/items/scan-photo 上传图片（无角度）', async ({ request }) => {
    const itemsRes = await request.get(`${BASE}/api/items?status=in_stock&size=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const itemsData = await itemsRes.json();
    expect(itemsData.code).toBe(0);
    expect(itemsData.data?.items?.length).toBeGreaterThan(0);

    const skuCode = itemsData.data.items[0].skuCode;
    const imgBuffer = createTestImageBuffer();
    const res = await request.post(`${BASE}/api/items/scan-photo`, {
      multipart: {
        skuCode,
        image: {
          name: 'test_photo.jpg',
          mimeType: 'image/jpeg',
          buffer: imgBuffer,
        },
      },
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const json = await res.json();
    expect(res.status()).toBe(200);
    expect(json.code).toBe(0);
    expect(json.data).toBeDefined();
    expect(json.data.id).toBeGreaterThan(0);
    expect(json.data.itemId).toBe(itemsData.data.items[0].id);
    expect(json.data.filename).toBeTruthy();
  });

  test('2.2 POST /api/items/scan-photo 上传图片（带角度编码）', async ({ request }) => {
    const itemsRes = await request.get(`${BASE}/api/items?status=in_stock&size=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const itemsData = await itemsRes.json();
    expect(itemsData.data?.items?.length).toBeGreaterThan(0);

    const skuCode = itemsData.data.items[0].skuCode;
    const imgBuffer = createTestImageBuffer();
    const res = await request.post(`${BASE}/api/items/scan-photo`, {
      multipart: {
        skuCode,
        angleCode: 'F',
        image: {
          name: 'test_photo_F.jpg',
          mimeType: 'image/jpeg',
          buffer: imgBuffer,
        },
      },
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const json = await res.json();
    expect(res.status()).toBe(200);
    expect(json.code).toBe(0);
    expect(json.data.angleCode).toBe('F');
  });

  test('2.3 POST /api/items/scan-photo 缺少SKU返回400', async ({ request }) => {
    const imgBuffer = createTestImageBuffer();
    const res = await request.post(`${BASE}/api/items/scan-photo`, {
      multipart: {
        image: {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          buffer: imgBuffer,
        },
      },
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const json = await res.json();
    expect(res.status()).toBe(400);
    expect(json.code).toBe(400);
  });

  test('2.4 POST /api/items/scan-photo 缺少图片返回400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/items/scan-photo`, {
      multipart: {
        skuCode: 'TEST-SKU-001',
      },
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const json = await res.json();
    expect(res.status()).toBe(400);
    expect(json.code).toBe(400);
  });

  test('2.5 POST /api/items/scan-photo 不存在的SKU返回404', async ({ request }) => {
    const imgBuffer = createTestImageBuffer();
    const res = await request.post(`${BASE}/api/items/scan-photo`, {
      multipart: {
        skuCode: `NONEXIST-SKU-${Date.now()}`,
        image: {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          buffer: imgBuffer,
        },
      },
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const json = await res.json();
    expect(res.status()).toBe(404);
    expect(json.code).toBe(404);
  });

  test('2.6 GET /api/items/lookup 扫码查询', async ({ request }) => {
    const itemsRes = await request.get(`${BASE}/api/items?status=in_stock&size=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const itemsData = await itemsRes.json();
    expect(itemsData.data?.items?.length).toBeGreaterThan(0);

    const skuCode = itemsData.data.items[0].skuCode;

    const res = await request.get(`${BASE}/api/items/lookup?sku=${encodeURIComponent(skuCode)}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const json = await res.json();
    expect(res.status()).toBe(200);
    expect(json.code).toBe(0);
    expect(json.data.skuCode).toBe(skuCode);
    expect(json.data.id).toBeGreaterThan(0);
    expect(json.data.name).toBeDefined();
    expect(json.data.materialName).toBeDefined();
    expect(json.data.typeName).toBeDefined();
  });

  test('2.7 上传所有6个角度的图片', async ({ request }) => {
    const itemsRes = await request.get(`${BASE}/api/items?status=in_stock&size=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const itemsData = await itemsRes.json();
    expect(itemsData.data?.items?.length).toBeGreaterThan(0);

    const skuCode = itemsData.data.items[0].skuCode;
    const imgBuffer = createTestImageBuffer();

    for (const angle of ANGLES) {
      const res = await request.post(`${BASE}/api/items/scan-photo`, {
        multipart: {
          skuCode,
          angleCode: angle.code,
          image: {
            name: `photo_${angle.code}.jpg`,
            mimeType: 'image/jpeg',
            buffer: imgBuffer,
          },
        },
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json();
      expect(res.status()).toBe(200);
      expect(json.code).toBe(0);
      expect(json.data.angleCode).toBe(angle.code);
    }

    // 验证货品现在有6张图片
    const detailRes = await request.get(`${BASE}/api/items/${itemsData.data.items[0].id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const detailJson = await detailRes.json();
    expect(detailJson.code).toBe(0);
    const imagesWithAngles = (detailJson.data?.images || []).filter(
      (img: any) => img.angleCode && ANGLES.some(a => a.code === img.angleCode)
    );
    expect(imagesWithAngles.length).toBeGreaterThanOrEqual(6);
  });

  test('2.8 上传文件类型校验（非图片格式拒绝）', async ({ request }) => {
    const itemsRes = await request.get(`${BASE}/api/items?status=in_stock&size=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const itemsData = await itemsRes.json();
    const skuCode = itemsData.data.items[0].skuCode;

    const res = await request.post(`${BASE}/api/items/scan-photo`, {
      multipart: {
        skuCode,
        image: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not an image'),
        },
      },
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const json = await res.json();
    expect(res.status()).toBe(400);
    expect(json.code).toBe(400);
  });
});

// ── 阶段3: 集成测试（前端 + API 联合） ──

test.describe('阶段3: 集成测试', () => {

  let testSkuCode = '';

  test.beforeAll(async ({ request }) => {
    // 先登录获取 token
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { username: 'admin', password: 'admin123' },
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.token || '';

    const res = await request.get(`${BASE}/api/items?status=in_stock&size=1`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (data.data?.items?.length > 0) {
      testSkuCode = data.data.items[0].skuCode;
    }
  });

  test('3.1 通过前端查询SKU显示货品信息', async ({ page }) => {
    test.skip(!testSkuCode, '无可用的在库货品');

    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    const skuInput = page.locator('input[placeholder*="输入SKU编码"]').first();
    await skuInput.fill(testSkuCode);
    await page.waitForTimeout(500);

    const queryBtn = page.locator('button:has-text("查询")').first();
    await queryBtn.click();
    await page.waitForTimeout(3000);

    await expect(page.locator(`text=${testSkuCode}`).first()).toBeVisible({ timeout: 5000 });
  });

  test('3.2 查询不存在的SKU显示错误提示', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    const skuInput = page.locator('input[placeholder*="输入SKU编码"]').first();
    await skuInput.click();
    await skuInput.fill('NONEXIST-SKU-999999');
    await page.locator('h2').first().click();
    await page.waitForTimeout(500);

    const queryBtn = page.locator('button:has-text("查询")').first();
    await expect(queryBtn).toBeEnabled({ timeout: 5000 });
    await queryBtn.click();
    await page.waitForTimeout(3000);

    const errorMsg = page.locator('text=未找到该货品').first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('3.3 查询后显示6个角度按钮', async ({ page }) => {
    test.skip(!testSkuCode, '无可用的在库货品');
    test.skip(true, '无头浏览器无法启动摄像头，角度按钮不渲染');

    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    const skuInput = page.locator('input[placeholder*="输入SKU编码"]').first();
    await skuInput.fill(testSkuCode);
    await page.waitForTimeout(500);

    const queryBtn = page.locator('button:has-text("查询")').first();
    await queryBtn.click();
    await page.waitForTimeout(3000);

    for (const angle of ANGLES) {
      await expect(page.locator(`text=${angle.label}`).first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('3.4 角度切换功能', async ({ page }) => {
    test.skip(!testSkuCode, '无可用的在库货品');
    test.skip(true, '无头浏览器无法启动摄像头，角度按钮不渲染');

    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    const skuInput = page.locator('input[placeholder*="输入SKU编码"]').first();
    await skuInput.fill(testSkuCode);
    await page.waitForTimeout(500);

    const queryBtn = page.locator('button:has-text("查询")').first();
    await queryBtn.click();
    await page.waitForTimeout(3000);

    // 切换到侧面45°
    const sideBtn = page.locator('button:has-text("侧面45°")').first();
    await sideBtn.click();
    await page.waitForTimeout(500);

    // 验证当前角度标记（active 样式）
    await expect(sideBtn).toHaveClass(/bg-emerald/);
  });

  test('3.5 "下一件"按钮存在', async ({ page }) => {
    test.skip(!testSkuCode, '无可用的在库货品');

    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();
    await scanPhotoBtn.click();
    await page.waitForTimeout(2000);

    const skuInput = page.locator('input[placeholder*="输入SKU编码"]').first();
    await skuInput.fill(testSkuCode);
    await page.waitForTimeout(500);

    const queryBtn = page.locator('button:has-text("查询")').first();
    await queryBtn.click();
    await page.waitForTimeout(3000);

    const nextBtn = page.locator('button:has-text("下一件")').first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
  });

  test('3.6 关闭后重新打开扫码拍摄', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateTo(page, 'inventory');
    await page.waitForTimeout(2000);

    const scanPhotoBtn = page.locator('button:has-text("扫码拍摄")').first();

    // 打开
    await scanPhotoBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=扫码拍摄').first()).toBeVisible({ timeout: 3000 });

    // 关闭
    const closeBtn = page.locator('button[aria-label="关闭"]').first();
    await closeBtn.click();
    await page.waitForTimeout(1000);

    // 再打开
    await scanPhotoBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=扫码拍摄').first()).toBeVisible({ timeout: 3000 });
  });
});
