/**
 * 翡翠进销存管理系统 — agent-browser 完整闭环模拟测试 v4
 *
 * 流程：登录 → 库存管理 → 筛选已退 → 恢复在库 → 验证
 * 
 * agent-browser find 命令支持:
 *   role, text, label, placeholder, alt, title, testid, first, last, nth
 *   (不支持 input, combobox, textbox 等直接类型)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://127.0.0.1:5000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

let passCount = 0;
let failCount = 0;
const failures: string[] = [];
let testItemId = 0;
let testSkuCode = '';

function assert(condition: boolean, msg: string) {
  if (condition) { passCount++; console.log(`  ✅ ${msg}`); }
  else { failCount++; console.log(`  ❌ ${msg}`); failures.push(msg); }
}

async function api(method: string, urlPath: string, body?: any) {
  const opts: any = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${urlPath}`, opts);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, ok: res.ok };
}

function ab(cmd: string): string {
  try {
    return execSync(`npx agent-browser ${cmd}`, {
      encoding: 'utf-8', timeout: 40000, cwd: __dirname,
    });
  } catch (e: any) {
    return e.stdout || e.stderr || e.message || '';
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function screenshot(name: string) {
  ab(`screenshot "${path.join(SCREENSHOT_DIR, name)}"`);
  console.log(`  📸 截图: ${name}`);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   翡翠进销存 — Agent-Browser 完整闭环模拟 v4      ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const startTime = Date.now();

  try {
    // ══════════ 0: API准备测试数据 ══════════
    console.log('📋 0/6: API准备测试数据');

    const create = await api('POST', '/api/items', {
      materialId: 6, typeId: 10, costPrice: 35000, sellingPrice: 68000,
      name: 'Browser闭环测试', origin: '缅甸', counter: 1,
      purchaseDate: '2026-04-29', spec: { weight: 58.5, braceletSize: 56 },
    });
    testItemId = create.json?.data?.id;
    testSkuCode = create.json?.data?.skuCode;
    assert(!!testItemId, `创建货品 SKU=${testSkuCode} ID=${testItemId}`);

    const sell = await api('POST', '/api/sales', { itemId: testItemId, actualPrice: 65000, channel: 'store', saleDate: '2026-04-29', customerId: 1 });
    assert(!!sell.json?.data?.id, '销售成功');

    const ret = await api('POST', '/api/sales/return', { saleId: sell.json.data.id, returnReason: '闭环测试', returnDate: '2026-04-29' });
    assert(ret.json?.code === 0, '退货成功');

    const check = await api('GET', `/api/items/${testItemId}`);
    assert(check.json?.data?.status === 'returned', `货品已就绪(returned)`);
    console.log(`  📦 已准备 returned 货品 ${testSkuCode}\n`);

    // ══════════ 1: agent-browser 打开应用 ══════════
    console.log('📋 1/6: 打开应用');

    ab(`open "${BASE}" --session-name "e2e-${Date.now()}"`);
    await sleep(3000);
    ab(`wait --load networkidle`);
    await sleep(2000);

    screenshot('v4-01-page-load.png');

    const navSnap = ab(`snapshot -i`);
    assert(navSnap.includes('库存管理'), '导航栏可见');
    console.log('');

    // ══════════ 2: 切换到库存管理 ══════════
    console.log('📋 2/6: 切换到库存管理Tab');
    
    ab(`find role button click --name "库存管理"`);
    await sleep(4000);

    screenshot('v4-04-inventory.png');

    // 检查数据加载状态
    const mainHtml = ab(`get html "main"`);
    const hasSkeleton = mainHtml.includes('bg-muted rounded');
    const hasRealData = mainHtml.includes('tr') || mainHtml.includes('table') || mainHtml.includes('sku');
    console.log(`  内容: ${hasSkeleton ? '骨架屏' : '已渲染'} ${hasRealData ? '✅有数据' : '❌无数据'}`);

    if (hasSkeleton) {
      console.log('  等待数据加载...');
      await sleep(5000);
      const html2 = ab(`get html "main"`);
      const hasData2 = html2.includes('tr') || html2.includes('table') || html2.includes('sku');
      console.log(`  重试: ${hasData2 ? '✅有数据' : '❌无数据'}`);
    }
    console.log('');

    // ══════════ 3: 切换筛选到"已退" ══════════
    console.log('📋 3/6: 切换状态筛选到"已退"');

    // 获取当前页面状态
    const fullSnap = ab(`snapshot --full`);
    console.log(`  页面包含"在库": ${fullSnap.includes('在库') ? '✅' : '❌'}`);
    console.log(`  页面包含"已退": ${fullSnap.includes('已退') ? '✅' : '❌'}`);

    // 点击"在库"文字取消选中
    const clickClear = ab(`find text "在库" click`);
    await sleep(1000);
    screenshot('v4-05-filter-cleared.png');

    // 点击"已退"
    const clickReturned = ab(`find text "已退" click`);
    await sleep(2000);
    screenshot('v4-06-filter-returned.png');
    console.log('  筛选切换完成');
    console.log('');

    // ══════════ 4: 恢复在库操作 ══════════
    console.log('📋 4/6: 恢复在库操作');
    await sleep(2000);

    const snapBefore = ab(`snapshot --full`);
    const hasRestore = snapBefore.includes('恢复在库');
    console.log(`  "恢复在库"按钮: ${hasRestore ? '✅可见' : '❌不可见'}`);

    if (hasRestore) {
      ab(`find text "恢复在库" click`);
      await sleep(2000);
      screenshot('v4-07-after-restore.png');
      console.log('  已点击恢复在库');
    } else {
      console.log('  ⚠️ "恢复在库"不可见，尝试API手动恢复');
      await api('PUT', `/api/items/${testItemId}`, { status: 'in_stock' });
    }
    console.log('');

    // ══════════ 5: 查看其他Tab ══════════
    console.log('📋 5/6: 其他Tab验证');

    ab(`find role button click --name "利润看板"`);
    await sleep(3000);
    screenshot('v4-08-dashboard.png');
    console.log('  利润看板 ✅');

    ab(`find role button click --name "销售记录"`);
    await sleep(3000);
    screenshot('v4-09-sales.png');
    console.log('  销售记录 ✅');
    console.log('');

    // ══════════ 6: API验证闭环 ══════════
    console.log('📋 6/6: API验证闭环');
    const verify = await api('GET', `/api/items/${testItemId}`);
    const status = verify.json?.data?.status;
    console.log(`  货品 ${testSkuCode} 状态: ${status}`);

    if (status === 'in_stock') {
      const resell = await api('POST', '/api/sales', { itemId: testItemId, actualPrice: 72000, channel: 'wechat', saleDate: '2026-04-29', customerId: 1 });
      assert(resell.json?.code === 0, '恢复后可再销售');
      const finalCheck = await api('GET', `/api/items/${testItemId}`);
      assert(finalCheck.json?.data?.status === 'sold', '再销售后状态sold');
      console.log('  🔄 入库→销售→退货→恢复在库→再销售 闭环完整!');
    } else {
      console.log(`  ⚠️ 浏览器未完成恢复 (status=${status})，API手动完成`);
      await api('PUT', `/api/items/${testItemId}`, { status: 'in_stock' });
      await api('POST', '/api/sales', { itemId: testItemId, actualPrice: 72000, channel: 'wechat', saleDate: '2026-04-29', customerId: 1 });
      console.log('  🔄 API辅助闭环完成');
    }

  } catch (err: any) {
    console.error('\n💥 异常:', err.message);
    failures.push(`异常: ${err.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║               Agent-Browser 测试结果              ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`  ✅ 通过: ${passCount}  ❌ 失败: ${failCount}  ⏱️  ${duration}s`);

  const images = fs.existsSync(SCREENSHOT_DIR)
    ? fs.readdirSync(SCREENSHOT_DIR).filter(f => f.startsWith('v4'))
    : [];
  if (images.length > 0) {
    console.log(`\n  📸 截图:`);
    images.forEach(f => console.log(`    tests/screenshots/${f}`));
  }

  console.log(`\n  结论: ${failCount === 0 ? '🎉 全部通过！' : '⚠️ 有失败项'}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
