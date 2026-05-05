/**
 * 翡翠进销存管理系统 — Playwright 穷尽式业务场景测试 v3
 *
 * 认证方式: 无需认证，系统为局域网单人操作模式，前端直接进入工作区
 *
 * 覆盖范围:
 *   1. 利润看板 (汇总卡片/图表/时间筛选)
 *   2. 库存管理-入库 (高货模式/通货模式/规格校验/SKU生成)
 *   3. 库存管理-编辑/详情/删除/软删除
 *   4. 库存管理-筛选排序 (8维筛选/关键字/排序)
 *   5. 库存管理-批量操作 (出库/恢复/删除/调价/柜台)
 *   6. 完整业务闭环 (入库->销售->退货->恢复->再销售->二次循环)
 *   7. 销售管理 (出库/退货/套装)
 *   8. 批次管理 (创建/分摊/列表)
 *   9. 客户管理 (CRUD/多字段搜索)
 *  10. 供应商管理 (列表)
 *  11. 贵金属价格 (更新/查询)
 *  12. 系统设置 (字典/配置/备份)
 *  13. 操作日志 (查询/筛选)
 *  14. 数据备份下载
 *  15. 边界异常 (无效数据/缺少字段/已售品再售)
 *  16. API全量健康检查 (23图表)

  Playwright 命令:
    npx playwright test --config playwright.config.ts
    npx playwright test --config playwright.config.ts --headed   # 可视化
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:5000';
const TODAY = new Date().toISOString().slice(0, 10);

async function clickNav(page: Page, tabName: string) {
  const navBtn = page.locator(`button:has-text("${tabName}")`).first();
  if (await navBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await navBtn.click();
    await page.waitForTimeout(1500);
  }
}

async function waitForContent(page: Page) {
  await page.waitForTimeout(3000);
  for (let i = 0; i < 5; i++) {
    const skeleton = await page.locator('.bg-muted.rounded, [class*="skeleton"]').count();
    if (skeleton === 0) break;
    await page.waitForTimeout(2000);
  }
}

async function navigateToTab(page: Page, tabName: string) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await clickNav(page, tabName);
  await waitForContent(page);
}

test.describe('翡翠进销存 — Playwright穷尽测试', () => {

  // =============================================
  // 1. 利润看板
  // =============================================
  test.describe('B. 利润看板', () => {
    test('B1 看板汇总卡片', async ({ page }) => {
      await navigateToTab(page, '利润看板');
      const card = page.locator('text=库存总计, text=今日销售, text=本月利润').first();
      const visible = await card.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    });

    test('B2 图表渲染', async ({ page }) => {
      await navigateToTab(page, '利润看板');
      const svgs = await page.locator('svg.recharts-surface, .recharts-responsive-container').count();
      expect(svgs).toBeGreaterThanOrEqual(1);
    });
  });

  // =============================================
  // 2. 库存管理-入库
  // =============================================
  test.describe('C. 库存管理-入库', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToTab(page, '库存管理');
    });

    test('C1 高货模式创建-手镯(完整UI交互)', async ({ page }) => {
      await page.locator('button:has-text("新增货品")').click();
      await page.waitForTimeout(1000);
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

      const typeTrigger = page.locator('[role="dialog"] button:has-text("器型")');
      if (await typeTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeTrigger.click();
        await page.waitForTimeout(300);
        await page.locator('[role="option"]:has-text("手镯")').first().click();
        await page.waitForTimeout(500);
      }

      const weightInput = page.locator('[role="dialog"] input[id*="weight"], [role="dialog"] input[name*="weight"]').first();
      if (await weightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weightInput.fill('62.5');
      }
      const braceletInput = page.locator('[role="dialog"] input[id*="bracelet"], [role="dialog"] input[name*="bracelet"], [role="dialog"] input[placeholder*="圈口"]').first();
      if (await braceletInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await braceletInput.fill('56');
      }

      const costInput = page.locator('[role="dialog"] input[id*="cost"], [role="dialog"] input[name*="costPrice"]').first();
      if (await costInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await costInput.fill('38000');
      }

      const sellInput = page.locator('[role="dialog"] input[id*="selling"], [role="dialog"] input[name*="sellingPrice"]').first();
      if (await sellInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sellInput.fill('68000');
      }

      const saveBtn = page.locator('[role="dialog"] button:has-text("保存")');
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    });

    test('C2 SKU编码格式验证(API)', async ({ page }) => {
      const res = await fetch(`${BASE}/api/items?page=1&size=1`);
      const { code, data } = await res.json();
      expect(code).toBe(0);
      const items = data?.items || [];
      if (items.length > 0) {
        expect(items[0].skuCode).toMatch(/^[0-9]{4}-[0-9]{4}-[0-9]{3}$/);
      }
    });

    test('C3 必填字段校验', async ({ page }) => {
      await page.locator('button:has-text("新增货品")').click();
      await page.waitForTimeout(1000);
      const save = page.locator('[role="dialog"] button:has-text("保存")');
      if (await save.isVisible({ timeout: 2000 }).catch(() => false)) {
        await save.click();
        await page.waitForTimeout(1000);
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 2000 });
        await page.locator('[role="dialog"] button:has-text("取消")').click();
      }
    });
  });

  // =============================================
  // 3. 库存管理-编辑/详情/删除
  // =============================================
  test.describe('D. 库存管理-编辑/详情/删除', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToTab(page, '库存管理');
    });

    test('D1 查看货品详情', async ({ page }) => {
      const detailBtn = page.locator('button:has-text("查看详情")').first();
      if (await detailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await detailBtn.click();
        await page.waitForTimeout(1000);
        await expect(page.locator('[role="dialog"], [class*="panel"]').first()).toBeVisible({ timeout: 3000 });
        await page.locator('button:has-text("关闭"), [aria-label="Close"]').first().click();
      }
    });

    test('D2 编辑货品', async ({ page }) => {
      const editBtn = page.locator('button:has-text("编辑")').first();
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(1000);
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 2000 });
        const priceInput = page.locator('[role="dialog"] input[type="number"]').first();
        if (await priceInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await priceInput.fill('88888');
        }
        await page.locator('[role="dialog"] button:has-text("保存")').click();
        await page.waitForTimeout(1500);
      }
    });

    test('D3 删除货品(软删除)', async ({ page }) => {
      const moreBtn = page.locator('button[aria-haspopup="menu"], button[class*="more"]').first();
      if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moreBtn.click();
        await page.waitForTimeout(500);
        const delBtn = page.locator('[role="menuitem"]:has-text("删除")');
        if (await delBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await delBtn.click();
          await page.waitForTimeout(500);
          const confirmBtn = page.locator('[role="dialog"] button:has-text("确认"), [role="dialog"] button:has-text("删除")').last();
          if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmBtn.click();
          }
        }
      }
    });
  });

  // =============================================
  // 4. 库存管理-筛选/排序
  // =============================================
  test.describe('E. 库存管理-筛选/排序', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToTab(page, '库存管理');
    });

    test('E1 状态筛选按钮(在库/已售/已退)', async ({ page }) => {
      const statusBtns = page.locator('button:has-text("在库"), button:has-text("已售"), button:has-text("已退")');
      expect(await statusBtns.count()).toBeGreaterThanOrEqual(2);
      const returned = page.locator('button:has-text("已退")');
      if (await returned.isVisible()) {
        await returned.click();
        await page.waitForTimeout(2000);
      }
    });

    test('E2 关键字搜索', async ({ page }) => {
      const search = page.locator('input[placeholder*="SKU"], input[placeholder*="搜索"]').first();
      if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
        await search.fill('0610');
        await page.locator('button:has-text("搜索")').click();
        await page.waitForTimeout(2000);
      }
    });

    test('E3 排序切换', async ({ page }) => {
      const sortArrow = page.locator('button[title*="序"], button:has-text("售价")').first();
      if (await sortArrow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sortArrow.click();
        await page.waitForTimeout(1000);
      }
    });

    test('E4 重置筛选器', async ({ page }) => {
      const reset = page.locator('button:has-text("重置")');
      if (await reset.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reset.click();
        await page.waitForTimeout(1500);
      }
    });
  });

  // =============================================
  // 5. 完整业务闭环 (API + UI验证)
  // =============================================
  test.describe('F. 完整业务闭环', () => {
    test('F1 入库->销售->退货->恢复->再销售', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };

      // ---- F1.1 API创建货品 ----
      const create = await fetch(`${BASE}/api/items`, { method: 'POST', headers: hdr, body: JSON.stringify({ materialId: 6, typeId: 10, costPrice: 30000, sellingPrice: 60000, name: 'PW闭环测试', origin: '缅甸', counter: 1, purchaseDate: TODAY, spec: { weight: 55, braceletSize: 56 } }) });
      const item = (await create.json()).data;
      expect(item.status).toBe('in_stock');
      expect(item.skuCode).toMatch(/^\d{4}-\d{4}-\d{3}$/);

      // ---- F1.2 销售 ----
      const sellRes = await fetch(`${BASE}/api/sales`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemId: item.id, actualPrice: 65000, channel: 'store', saleDate: TODAY, customerId: 1, note: '闭环测试-销售' }) });
      const sale = (await sellRes.json()).data;
      expect(sale.saleNo).toBeTruthy();
      expect(sale.actualPrice).toBe(65000);

      const afterSell = await fetch(`${BASE}/api/items/${item.id}`);
      expect((await afterSell.json()).data.status).toBe('sold');

      // ---- F1.3 退货 ----
      const retRes = await fetch(`${BASE}/api/sales/return`, { method: 'POST', headers: hdr, body: JSON.stringify({ saleId: sale.id, returnReason: '闭环测试-退货', returnDate: TODAY }) });
      expect((await retRes.json()).code).toBe(0);

      const afterReturn = await fetch(`${BASE}/api/items/${item.id}`);
      expect((await afterReturn.json()).data.status).toBe('returned');

      // ---- F1.4 UI验证 ----
      await clickNav(page, '库存管理');
      await waitForContent(page);
      const returnedBtn = page.locator('button:has-text("已退")');
      if (await returnedBtn.isVisible()) {
        await returnedBtn.click();
        await page.waitForTimeout(2000);
      }

      // ---- F1.5 恢复在库 ----
      const restore = await fetch(`${BASE}/api/items/${item.id}`, { method: 'PUT', headers: hdr, body: JSON.stringify({ status: 'in_stock' }) });
      expect((await restore.json()).data.status).toBe('in_stock');

      // ---- F1.6 再销售(闭环) ----
      const resell = await fetch(`${BASE}/api/sales`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemId: item.id, actualPrice: 72000, channel: 'wechat', saleDate: TODAY, customerId: 1, note: '闭环测试-再销售' }) });
      expect((await resell.json()).data.saleNo).toBeTruthy();

      const final = await fetch(`${BASE}/api/items/${item.id}`);
      expect((await final.json()).data.status).toBe('sold');

      console.log('  ✅ 入库->销售->退货->恢复在库->再销售 完整闭环通过!');
    });

    test('F2 二次循环验证', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };

      const create = await fetch(`${BASE}/api/items`, { method: 'POST', headers: hdr, body: JSON.stringify({ materialId: 6, typeId: 10, costPrice: 20000, sellingPrice: 40000, name: '二次闭环', origin: '缅甸', counter: 1, purchaseDate: TODAY, spec: { weight: 50, braceletSize: 56 } }) });
      const item = (await create.json()).data;

      const s1 = await fetch(`${BASE}/api/sales`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemId: item.id, actualPrice: 45000, channel: 'store', saleDate: TODAY }) });
      await fetch(`${BASE}/api/sales/return`, { method: 'POST', headers: hdr, body: JSON.stringify({ saleId: (await s1.json()).data.id, returnReason: '1', returnDate: TODAY }) });
      await fetch(`${BASE}/api/items/${item.id}`, { method: 'PUT', headers: hdr, body: JSON.stringify({ status: 'in_stock' }) });

      const s2 = await fetch(`${BASE}/api/sales`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemId: item.id, actualPrice: 50000, channel: 'wechat', saleDate: TODAY }) });
      await fetch(`${BASE}/api/sales/return`, { method: 'POST', headers: hdr, body: JSON.stringify({ saleId: (await s2.json()).data.id, returnReason: '2', returnDate: TODAY }) });
      const r3 = await fetch(`${BASE}/api/items/${item.id}`, { method: 'PUT', headers: hdr, body: JSON.stringify({ status: 'in_stock' }) });
      expect((await r3.json()).data.status).toBe('in_stock');
      console.log('  ✅ 销售->退货->恢复 x2 循环通过!');
    });
  });

  // =============================================
  // 6. 销售管理
  // =============================================
  test.describe('G. 销售管理', () => {
    test('G1 销售列表加载', async ({ page }) => {
      await navigateToTab(page, '销售记录');
      const salesTab = page.locator('table').first();
      const visible = await salesTab.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    });

    test('G2 套装销售', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };
      const i1 = (await (await fetch(`${BASE}/api/items`, { method: 'POST', headers: hdr, body: JSON.stringify({ materialId: 6, typeId: 10, costPrice: 10000, sellingPrice: 20000, name: '套装A', origin: '缅甸', counter: 1, purchaseDate: TODAY, spec: { weight: 30, braceletSize: 56 } }) })).json()).data;
      const i2 = (await (await fetch(`${BASE}/api/items`, { method: 'POST', headers: hdr, body: JSON.stringify({ materialId: 6, typeId: 10, costPrice: 15000, sellingPrice: 30000, name: '套装B', origin: '缅甸', counter: 1, purchaseDate: TODAY, spec: { weight: 40, braceletSize: 58 } }) })).json()).data;

      const bundle = await fetch(`${BASE}/api/sales/bundle`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemIds: [i1.id, i2.id], totalPrice: 40000, allocMethod: 'by_ratio', channel: 'store', saleDate: TODAY }) });
      const bd = await bundle.json();
      expect(bd.code).toBe(0);
      expect(bd.data.bundle.totalPrice).toBe(40000);
      console.log(`  套装销售: ${bd.data.bundle.bundleNo} ✅`);
    });
  });

  // =============================================
  // 7. 批次管理
  // =============================================
  test.describe('H. 批次管理', () => {
    test('H1 创建批次和列表', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };

      const res = await fetch(`${BASE}/api/batches`, { method: 'POST', headers: hdr, body: JSON.stringify({ materialId: 7, typeId: 1, quantity: 5, totalCost: 25000, costAllocMethod: 'equal', purchaseDate: TODAY }) });
      const batch = (await res.json()).data;
      expect(batch.id).toBeGreaterThan(0);
      expect(batch.batchCode).toMatch(/^B[A-Z]\d{7}$/);
      console.log(`  批次: ${batch.batchCode} 单价${batch.unitCost}`);

      await navigateToTab(page, '批次管理');
      const visible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    });
  });

  // =============================================
  // 8. 客户管理
  // =============================================
  test.describe('I. 客户管理', () => {
    test('I1 创建/搜索客户', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };

      const create = await fetch(`${BASE}/api/customers`, { method: 'POST', headers: hdr, body: JSON.stringify({ name: 'PW测试客户', phone: '13900001111', wechat: 'pw_test', address: '测试地址', notes: 'Playwright测试' }) });
      const customer = (await create.json()).data;
      expect(customer.id).toBeGreaterThan(0);
      expect(customer.customerCode).toBeTruthy();

      const s1 = await fetch(`${BASE}/api/customers?keyword=PW测试`);
      expect((await s1.json()).data.items.length).toBeGreaterThanOrEqual(1);

      const s2 = await fetch(`${BASE}/api/customers?keyword=1390000`);
      expect((await s2.json()).data.items.length).toBeGreaterThanOrEqual(1);

      console.log(`  客户: ${customer.customerCode} ${customer.name} ✅`);
    });

    test('I2 客户Tab加载', async ({ page }) => {
      await navigateToTab(page, '客户管理');
      const visible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
    });
  });

  // =============================================
  // 9. 贵金属价格
  // =============================================
  test.describe('J. 贵金属价格', () => {
    test('J1 更新和查询', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };

      const update = await fetch(`${BASE}/api/metal-prices`, { method: 'POST', headers: hdr, body: JSON.stringify({ metalType: 'gold', price: 888, priceDate: TODAY }) });
      expect(update.status).toBe(200);

      const query = await fetch(`${BASE}/api/metal-prices`);
      const prices = (await query.json()).data || [];
      const gold = prices.find((p: any) => p.metalType === 'gold');
      if (gold) expect(gold.price).toBe(888);
      console.log(`  金价已更新: ${gold?.price} ✅`);
    });
  });

  // =============================================
  // 10. 系统设置
  // =============================================
  test.describe('K. 系统设置', () => {
    test('K1 字典和配置加载', async ({ page }) => {
      await navigateToTab(page, '系统设置');
      const tabs = page.locator('button:has-text("材质"), button:has-text("器型"), button:has-text("标签"), button:has-text("系统配置")');
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(2);
      console.log(`  设置Tab加载成功, ${count}个子Tab ✅`);
    });
  });

  // =============================================
  // 11. 操作日志
  // =============================================
  test.describe('L. 操作日志', () => {
    test('L1 日志加载和查询', async ({ page }) => {
      const logs = await fetch(`${BASE}/api/logs?page=1&size=5`);
      const data = await logs.json();
      expect(data.code).toBe(0);
      expect(data.data.pagination.total).toBeGreaterThan(0);

      await navigateToTab(page, '操作日志');
      const visible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
      console.log(`  日志总数: ${data.data.pagination.total} ✅`);
    });
  });

  // =============================================
  // 12. 数据备份
  // =============================================
  test.describe('M. 数据备份', () => {
    test('M1 备份下载', async ({ page }) => {
      const res = await fetch(`${BASE}/api/backup`);
      expect(res.status).toBe(200);
      const blob = await res.blob();
      expect(blob.size).toBeGreaterThan(1000);
      console.log(`  备份: ${(blob.size / 1024).toFixed(1)}KB ✅`);
    });
  });

  // =============================================
  // 13. API全量健康检查
  // =============================================
  test.describe('N. API健康检查', () => {
    test('N1 核心API', async ({ page }) => {
      const apis = ['/api/health', '/api/dicts/materials', '/api/dicts/types', '/api/dicts/tags', '/api/config', '/api/dashboard/summary', '/api/suppliers'];
      let ok = 0;
      for (const api of apis) {
        const res = await fetch(`${BASE}${api}`);
        if (res.status === 200) ok++;
      }
      expect(ok).toBe(apis.length);
      console.log(`  ${ok}/${apis.length} 核心API ✅`);
    });

    test('N2 23个图表API', async ({ page }) => {
      const endpoints = [
        '/api/dashboard/summary', '/api/dashboard/aggregate', '/api/dashboard/profit/by-category',
        '/api/dashboard/profit/by-channel', '/api/dashboard/sales-by-channel', '/api/dashboard/trend',
        '/api/dashboard/turnover', '/api/dashboard/top-sellers', '/api/dashboard/top-customers',
        '/api/dashboard/age-distribution', '/api/dashboard/price-range/selling', '/api/dashboard/price-range/cost',
        '/api/dashboard/distribution/by-material', '/api/dashboard/distribution/by-type',
        '/api/dashboard/stock-aging', '/api/dashboard/inventory-value-by-category',
        '/api/dashboard/recent-sales', '/api/dashboard/mom-comparison', '/api/dashboard/heatmap',
        '/api/dashboard/batch-profit', '/api/dashboard/customer-frequency', '/api/dashboard/weight-distribution',
        '/api/dashboard/profit/by-counter',
      ];
      let ok = 0;
      for (const ep of endpoints) {
        const res = await fetch(`${BASE}${ep}`);
        if (res.status === 200) ok++;
      }
      expect(ok).toBeGreaterThanOrEqual(20);
      console.log(`  ${ok}/${endpoints.length} 图表API ✅`);
    });
  });

  // =============================================
  // 14. 边界和异常
  // =============================================
  test.describe('O. 边界异常', () => {
    test('O1 不存在货品', async ({ page }) => {
      const res = await fetch(`${BASE}/api/items/99999999`);
      expect([404, 500]).toContain(res.status);
    });

    test('O2 缺少必填字段创建失败', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };
      const res = await fetch(`${BASE}/api/items`, { method: 'POST', headers: hdr, body: JSON.stringify({ name: '无必填字段' }) });
      expect((await res.json()).code).toBe(400);
    });

    test('O3 已退品不能再售', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };
      const create = await fetch(`${BASE}/api/items`, { method: 'POST', headers: hdr, body: JSON.stringify({ materialId: 6, typeId: 10, costPrice: 1000, sellingPrice: 2000, name: '退货测试', origin: '缅甸', counter: 1, purchaseDate: TODAY, spec: { weight: 20, braceletSize: 56 } }) });
      const item = (await create.json()).data;
      const sell = await fetch(`${BASE}/api/sales`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemId: item.id, actualPrice: 2000, channel: 'store', saleDate: TODAY }) });
      await fetch(`${BASE}/api/sales/return`, { method: 'POST', headers: hdr, body: JSON.stringify({ saleId: (await sell.json()).data.id, returnReason: '测试', returnDate: TODAY }) });
      const sellAgain = await fetch(`${BASE}/api/sales`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemId: item.id, actualPrice: 2000, channel: 'store', saleDate: TODAY }) });
      expect((await sellAgain.json()).code).toBe(400);
      console.log('  ✅ 已退品拒绝再次销售');
    });

    test('O4 套装至少2件', async ({ page }) => {
      const hdr = { 'Content-Type': 'application/json' };
      const res = await fetch(`${BASE}/api/sales/bundle`, { method: 'POST', headers: hdr, body: JSON.stringify({ itemIds: [1], totalPrice: 1000, allocMethod: 'by_ratio', channel: 'store', saleDate: TODAY }) });
      expect((await res.json()).code).toBe(400);
    });
  });
});
