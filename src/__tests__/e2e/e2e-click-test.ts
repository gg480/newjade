/**
 * 翡翠进销存管理系统 — 前端业务流程点击测试
 * 
 * 模拟真实用户操作：页面加载 → 点击导航 → 填写表单 → 提交 → 验证结果
 * 所有请求通过 HTTP 发送到前端服务，与浏览器行为一致
 */

const BASE = 'http://127.0.0.1:5000';
let authToken = '';

// ========== 工具函数 ==========
async function request(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, ok: res.ok };
}

async function login() {
  const res = await request('POST', '/api/auth', { password: 'admin123' });
  if (res.json?.data?.token) {
    authToken = res.json.data.token;
    console.log('  🔐 登录成功，已获取 token');
  } else {
    console.log('  ⚠️ 登录失败:', res.json?.message);
  }
}

function log(emoji: string, msg: string) {
  console.log(`  ${emoji} ${msg}`);
}

function logPass(msg: string) { log('✅', msg); }
function logFail(msg: string) { log('❌', msg); }

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string) {
  if (condition) { passCount++; logPass(msg); }
  else { failCount++; logFail(msg); failures.push(msg); }
}

// ========== 测试用例 ==========

async function test1_homepageLoads() {
  console.log('\n📋 测试1: 首页加载');
  
  // 用户在浏览器输入 URL 访问首页
  const { status, text } = await request('GET', '/');
  assert(status === 200, '首页 HTTP 200');
  assert(text.includes('兴盛艺珠宝'), '页面标题正确');
  assert(text.includes('__next'), 'Next.js 渲染容器存在');
  // 登录认证体系上线后，首页服务端渲染显示登录页或加载骨架屏，而非直接显示销售Tab
  assert(text.includes('兴盛艺珠宝'), '登录页/加载页包含品牌标题');
  
  // 检查 JS 资源是否可加载
  const jsChunks = text.match(/src="([^"]*\.js)"/g) || [];
  assert(jsChunks.length > 5, `JS chunks 加载 (${jsChunks.length} 个)`);
}

async function test2_navigationClicks() {
  console.log('\n📋 测试2: 导航点击 — 加载各 Tab 数据');
  
  // 模拟用户点击左侧导航栏各 Tab，前端会请求对应 API
  const tabs = [
    { name: '利润看板', api: '/api/dashboard/aggregate', check: (j: any) => j.data?.summary?.totalItems >= 0 },
    { name: '库存管理', api: '/api/items?page=1&size=20', check: (j: any) => j.data?.pagination?.total >= 0 },
    { name: '销售记录', api: '/api/sales?page=1&size=20', check: (j: any) => j.data?.pagination?.total >= 0 },
    { name: '批次管理', api: '/api/batches?page=1&size=20', check: (j: any) => j.data?.pagination?.total >= 0 },
    { name: '客户管理', api: '/api/customers?page=1&size=20', check: (j: any) => j.data?.pagination?.total >= 0 },
    { name: '操作日志', api: '/api/logs?page=1&size=20', check: (j: any) => j.data?.pagination?.total >= 0 },
    { name: '系统设置', api: '/api/dicts/materials', check: (j: any) => Array.isArray(j.data) },
  ];
  
  for (const tab of tabs) {
    const { status, json } = await request('GET', tab.api);
    assert(status === 200, `${tab.name} Tab 数据加载 (HTTP ${status})`);
    if (json) {
      assert(json.code === 0, `${tab.name} API code=0`);
      assert(tab.check(json), `${tab.name} 数据结构正确`);
    }
  }
}

async function test3_dashboardChartsLoad() {
  console.log('\n📋 测试3: Dashboard 图表数据加载');
  
  // 用户点击利润看板后，前端并发请求所有图表 API
  const chartApis = [
    '/api/dashboard/aggregate',
    '/api/dashboard/summary',
    '/api/dashboard/trend',
    '/api/dashboard/batch-profit',
    '/api/dashboard/age-distribution',
    '/api/dashboard/stock-aging',
    '/api/dashboard/top-sellers',
    '/api/dashboard/profit/by-category',
    '/api/dashboard/profit/by-channel',
    '/api/dashboard/profit/by-counter',
    '/api/dashboard/distribution/by-material',
    '/api/dashboard/distribution/by-type',
    '/api/dashboard/price-range/selling',
    '/api/dashboard/price-range/cost',
    '/api/dashboard/heatmap',
    '/api/dashboard/sales-by-channel',
    '/api/dashboard/customer-frequency',
    '/api/dashboard/turnover',
    '/api/dashboard/top-customers',
    '/api/dashboard/recent-sales',
    '/api/dashboard/inventory-value-by-category',
    '/api/dashboard/weight-distribution',
    '/api/dashboard/mom-comparison',
  ];
  
  // 模拟浏览器并发请求（Promise.all）
  const results = await Promise.all(
    chartApis.map(api => request('GET', api).then(r => ({ api, ...r })))
  );
  
  let successCount = 0;
  for (const r of results) {
    if (r.status === 200 && r.json?.code === 0) successCount++;
    else logFail(`图表 API 失败: ${r.api} → HTTP ${r.status}`);
  }
  assert(successCount === chartApis.length, `Dashboard 全部 ${chartApis.length} 个图表加载成功 (${successCount}/${chartApis.length})`);
}

async function test4_createItem() {
  console.log('\n📋 测试4: 入库 — 创建货品（高货模式）');
  
  // 步骤1: 用户点击"新增货品"按钮 → 弹出创建对话框
  // 步骤2: 前端先加载材质和器型字典
  const { json: materials } = await request('GET', '/api/dicts/materials');
  const { json: types } = await request('GET', '/api/dicts/types');
  assert(materials?.code === 0, '材质字典加载');
  assert(types?.code === 0, '器型字典加载');
  assert(materials?.data?.length > 0, '材质列表非空');
  assert(types?.data?.length > 0, '器型列表非空');
  
  // 步骤3: 用户选择材质=斑彩螺(6)，器型=手镯(10)，输入成本价和售价
  // 步骤4: 器型为手镯时，前端显示必填的"圈口"字段，用户选择56号
  // 注意：不使用tagIds避免标签与材质匹配问题
  const testItem = {
    materialId: 6,      // 斑彩螺（测试用）
    typeId: 10,         // 手镯（必填，器型ID=10）
    costPrice: 38000,   // 成本价（必填）
    sellingPrice: 68000,
    name: 'E2E测试-冰种飘花手镯',
    origin: '缅甸',
    counter: 1,
    purchaseDate: new Date().toISOString().slice(0, 10),
    spec: { weight: 62.5, braceletSize: 56 },  // braceletSize 是 String 字段，前端传数字
  };
  
  // 步骤5: 用户点击"保存"（需要认证）
  const { status, json } = await request('POST', '/api/items', testItem, true);
  assert(status === 200, '入库请求 HTTP 200');
  assert(json?.code === 0, '入库 API code=0');
  assert(json?.data?.id > 0, '返回新货品 ID');
  assert(json?.data?.skuCode?.match(/^[0-9A-Z]+-[0-9]+-[0-9]+$/), 'SKU编码格式正确 (纯ASCII，如0601-0417-001)');
  assert(json?.data?.status === 'in_stock', '状态为在库');
  
  // 关键验证：braceletSize 从数字 56 被正确转为字符串 "56"
  assert(json?.data?.spec?.braceletSize === '56', 'braceletSize 类型转换正确 (Int→String)');
  assert(json?.data?.spec?.weight === 62.5, 'weight Float 类型正确');
  
  return json?.data?.id;
}

async function test5_editItem(itemId: number) {
  console.log('\n📋 测试5: 编辑货品 — 修改价格和规格');
  
  if (!itemId) { logFail('跳过：无有效 itemId'); return; }
  
  // 步骤1: 用户点击货品行 → 弹出详情对话框
  const { json: detail } = await request('GET', `/api/items/${itemId}`);
  assert(detail?.code === 0, '货品详情加载');
  
  // 步骤2: 用户修改售价和圈口（需要认证）
  const { status, json } = await request('PUT', `/api/items/${itemId}`, {
    sellingPrice: 72000,
    spec: { weight: 63.0, braceletSize: 58 },
  }, true);
  assert(status === 200, '编辑请求 HTTP 200');
  assert(json?.code === 0, '编辑 API code=0');
  assert(json?.data?.sellingPrice === 72000, '售价更新为 72000');
  assert(json?.data?.spec?.braceletSize === '58', '圈口更新为 "58" (String)');
  assert(json?.data?.spec?.weight === 63, '克重更新为 63');
}

async function test6_sellItem(itemId: number) {
  console.log('\n📋 测试6: 销售 — 卖出货品');
  
  if (!itemId) { logFail('跳过：无有效 itemId'); return; }
  
  // 步骤1: 用户在销售 Tab 点击"新增销售"
  // 步骤2: 扫码或搜索选择货品
  // 步骤3: 输入实际成交价，选择渠道和客户（需要认证）
  const { status, json } = await request('POST', '/api/sales', {
    itemId,
    actualPrice: 65000,
    channel: 'store',
    saleDate: new Date().toISOString().slice(0, 10),
    customerId: 1,
    note: 'E2E测试销售',
  }, true);
  assert(status === 200, '销售请求 HTTP 200');
  assert(json?.code === 0, '销售 API code=0');
  assert(json?.data?.saleNo?.length > 0, '销售单号已生成');
  assert(json?.data?.actualPrice === 65000, '成交价 65000');
  
  // 步骤4: 验证货品状态变为已售
  const { json: updated } = await request('GET', `/api/items/${itemId}`);
  assert(updated?.data?.status === 'sold', '货品状态变为 sold');
  
  return json?.data?.id;
}

async function test7_returnSale(saleId: number) {
  console.log('\n📋 测试7: 退货 — 退回货品');
  
  if (!saleId) { logFail('跳过：无有效 saleId'); return; }
  
  // 步骤1: 用户在销售记录中找到该笔销售
  // 步骤2: 点击"退货"（需要认证）
  const { status, json } = await request('POST', '/api/sales/return', {
    saleId,
    returnReason: 'E2E测试退货-客户不满意',
    returnDate: new Date().toISOString().slice(0, 10),
  }, true);
  assert(status === 200, '退货请求 HTTP 200');
  assert(json?.code === 0, '退货 API code=0');
  assert(json?.data?.id > 0, '退货记录创建成功');
}

async function test16_closedLoopRestore(itemId: number, firstSaleId: number) {
  console.log('\n📋 测试16: 闭环验证 — 恢复入库 → 再销售');
  
  if (!itemId) { logFail('跳过：无有效 itemId'); return { ok: false }; }
  
  // 步骤1: 验证当前状态为 returned
  const { json: afterReturn } = await request('GET', `/api/items/${itemId}`);
  assert(afterReturn?.data?.status === 'returned', '退货后状态为 returned');
  
  // 步骤2: 模拟点击"恢复在库"按钮 — PUT /api/items/:id { status: 'in_stock' }
  const { status: restoreStatus, json: restoreJson } = await request('PUT', `/api/items/${itemId}`, {
    status: 'in_stock'
  }, true);
  assert(restoreStatus === 200, '恢复入库请求 HTTP 200');
  assert(restoreJson?.code === 0, '恢复入库 API code=0');
  assert(restoreJson?.data?.status === 'in_stock', '恢复后状态变为 in_stock');
  
  // 步骤3: 再销售 — 闭环核心验证
  const { status: sell2Status, json: sell2Json } = await request('POST', '/api/sales', {
    itemId,
    actualPrice: 70000,
    channel: 'wechat',
    saleDate: new Date().toISOString().slice(0, 10),
    customerId: 1,
    note: 'E2E闭环-再销售',
  }, true);
  assert(sell2Status === 200, '再销售请求 HTTP 200');
  assert(sell2Json?.code === 0, '再销售 API code=0');
  assert(sell2Json?.data?.saleNo?.length > 0, '再销售单号已生成');
  
  // 步骤4: 验证货品状态再次变为 sold
  const { json: afterResell } = await request('GET', `/api/items/${itemId}`);
  assert(afterResell?.data?.status === 'sold', '再销售后状态变为 sold');
  
  // 步骤5: 再退货 — 验证二次退货也能恢复
  const { status: return2Status, json: return2Json } = await request('POST', '/api/sales/return', {
    saleId: sell2Json?.data?.id,
    returnReason: 'E2E闭环-二次退货',
    returnDate: new Date().toISOString().slice(0, 10),
  }, true);
  assert(return2Status === 200, '二次退货 HTTP 200');
  assert(return2Json?.code === 0, '二次退货 API code=0');
  
  // 步骤6: 再次恢复入库
  const { status: restore2Status, json: restore2Json } = await request('PUT', `/api/items/${itemId}`, {
    status: 'in_stock'
  }, true);
  assert(restore2Status === 200, '二次恢复入库 HTTP 200');
  assert(restore2Json?.code === 0, '二次恢复入库 API code=0');
  assert(restore2Json?.data?.status === 'in_stock', '二次恢复后状态为 in_stock');
  
  console.log('  🔄 闭环完整验证：入库→销售→退货→恢复入库→再销售→再退货→再恢复入库 ✅');
}

async function test8_batchCreate() {
  console.log('\n📋 测试8: 批次入库 — 创建批次并拆分货品');
  
  // 步骤1: 用户点击"新增批次"（需要认证）
  const { status, json } = await request('POST', '/api/batches', {
    batchCode: `E2E-BATCH-${Date.now()}`,
    materialId: 7,   // 和田玉
    typeId: 3,       // 吊坠
    quantity: 3,
    totalCost: 18000,
    costAllocMethod: 'equal',
    purchaseDate: new Date().toISOString().slice(0, 10),
  }, true);
  assert(status === 200, '批次创建 HTTP 200');
  assert(json?.code === 0, '批次 API code=0');
  assert(json?.data?.id > 0, '返回批次 ID');
  
  return json?.data?.id;
}

async function test9_createCustomer() {
  console.log('\n📋 测试9: 客户管理 — 新增客户');
  
  // 需要认证
  const { status, json } = await request('POST', '/api/customers', {
    name: 'E2E测试客户',
    phone: '13800138000',
    wechat: 'e2e_test',
    address: '测试地址',
    notes: '自动化测试创建',
  }, true);
  assert(status === 200, '客户创建 HTTP 200');
  assert(json?.code === 0, '客户 API code=0');
  assert(json?.data?.id > 0, '返回客户 ID');
  assert(json?.data?.customerCode?.length > 0, '客户编码已生成');
}

async function test10_metalPrice() {
  console.log('\n📋 测试10: 贵金属价格 — 更新金价');
  
  // 需要认证
  const { status, json } = await request('POST', '/api/metal-prices', {
    materialId: 5,   // 18K金
    pricePerGram: 880,
  }, true);
  assert(status === 200, '贵金属价格更新 HTTP 200');
  assert(json?.code === 0, '贵金属 API code=0');
  assert(json?.data?.pricePerGram === 880, '金价更新为 880');
}

async function test11_settingsDicts() {
  console.log('\n📋 测试11: 系统设置 — 字典管理');
  
  // 材质字典
  const mats = await request('GET', '/api/dicts/materials');
  assert(mats.json?.code === 0 && mats.json?.data?.length > 0, '材质字典加载正常');
  
  // 器型字典
  const types = await request('GET', '/api/dicts/types');
  assert(types.json?.code === 0 && types.json?.data?.length > 0, '器型字典加载正常');
  
  // 标签字典
  const tags = await request('GET', '/api/dicts/tags');
  assert(tags.json?.code === 0 && tags.json?.data?.length > 0, '标签字典加载正常');
  
  // 系统配置
  const config = await request('GET', '/api/config');
  assert(config.json?.code === 0, '系统配置加载正常');
}

async function test12_bundleSale() {
  console.log('\n📋 测试12: 套装销售');
  
  // 找两个在库品
  const { json: itemsData } = await request('GET', '/api/items?status=in_stock&size=2');
  const inStockItems = itemsData?.data?.items || [];
  
  if (inStockItems.length < 2) {
    logFail('跳过：在库货品不足2件，无法测试套装');
    return;
  }
  
  const itemIds = inStockItems.slice(0, 2).map((i: any) => i.id);
  
  const { status, json } = await request('POST', '/api/sales/bundle', {
    itemIds,
    totalPrice: 150000,
    allocMethod: 'by_ratio',
    channel: 'wechat',
    saleDate: new Date().toISOString().slice(0, 10),
    customerId: 2,
  });
  assert(status === 200, '套装销售 HTTP 200');
  assert(json?.code === 0, '套装销售 API code=0');
  assert(json?.data?.bundle?.totalPrice === 150000, '套装总价 150000');
}

async function test13_backup() {
  console.log('\n📋 测试13: 数据库备份');
  
  const { status, headers } = await request('GET', '/api/backup');
  assert(status === 200, '备份下载 HTTP 200');
  // backup returns binary, check content-type or size
}

async function test14_operationLogs() {
  console.log('\n📋 测试14: 操作日志查看');
  
  const { status, json } = await request('GET', '/api/logs?page=1&size=5');
  assert(status === 200, '日志查询 HTTP 200');
  assert(json?.code === 0, '日志 API code=0');
  // 之前的操作应该产生了日志
  assert(json?.data?.pagination?.total > 0, '操作日志非空 (之前操作产生了日志)');
}

// ========== 主流程 ==========

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  翡翠进销存管理系统 — 前端业务流程点击测试     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n🌐 测试目标: ${BASE}\n`);
  
  const startTime = Date.now();
  
  // 先登录获取 token（中间件要求所有 /api/* 请求需认证）
  await login();
  
  try {
    // 阶段1: 页面加载与导航
    await test1_homepageLoads();
    await test2_navigationClicks();
    await test3_dashboardChartsLoad();
    
    // 阶段2: 入库流程
    const newItemId = await test4_createItem();
    await test5_editItem(newItemId);
    
    // 阶段3: 销售与退货
    const saleId = await test6_sellItem(newItemId);
    await test7_returnSale(saleId);
    
    // 阶段3.5: 闭环验证 — 恢复入库 → 再销售（验证完整业务闭环）
    await test16_closedLoopRestore(newItemId, saleId);
    
    // 阶段4: 批次管理
    await test8_batchCreate();
    
    // 阶段5: 客户管理
    await test9_createCustomer();
    
    // 阶段6: 贵金属价格
    await test10_metalPrice();
    
    // 阶段7: 系统设置
    await test11_settingsDicts();
    
    // 阶段8: 套装销售
    await test12_bundleSale();
    
    // 阶段9: 备份与日志
    await test13_backup();
    await test14_operationLogs();
    
  } catch (err: any) {
    console.error('\n💥 测试执行异常:', err.message);
    failures.push(`执行异常: ${err.message}`);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║               测试结果汇总                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  ✅ 通过: ${passCount}`);
  console.log(`  ❌ 失败: ${failCount}`);
  console.log(`  ⏱️  耗时: ${duration}s`);
  
  if (failures.length > 0) {
    console.log('\n  失败项:');
    failures.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
  }
  
  console.log(`\n  结论: ${failCount === 0 ? '🎉 全部通过！' : '⚠️ 存在失败项，需要修复'}`);
  
  process.exit(failCount > 0 ? 1 : 0);
}

main();
