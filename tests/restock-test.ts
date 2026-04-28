/**
 * 翡翠进销存管理系统 — 入货建议功能测试
 * 
 * 测试入货建议相关的API和功能
 */

const BASE = 'http://localhost:5000';

// ========== 工具函数 ==========
async function request(method: string, path: string, body?: any) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, ok: res.ok };
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

async function test1_generateRestockRecommendations() {
  console.log('\n📋 测试1: 生成入货建议');
  
  // 测试生成入货建议
  const { status, json } = await request('POST', '/api/restock/generate', {
    limit: 5
  });
  
  assert(status === 200, '生成入货建议 HTTP 200');
  assert(json?.code === 0, '生成入货建议 API code=0');
  assert(Array.isArray(json?.data), '返回数据为数组');
  assert(json?.data?.length <= 5, `返回建议数量不超过限制 (${json?.data?.length}/5)`);
  
  if (json?.data?.length > 0) {
    const recommendation = json.data[0];
    assert(typeof recommendation?.itemId === 'number', '建议包含itemId');
    assert(typeof recommendation?.recommendedQty === 'number', '建议包含recommendedQty');
    assert(typeof recommendation?.estimatedCost === 'number', '建议包含estimatedCost');
    assert(typeof recommendation?.confidence === 'number', '建议包含confidence');
  }
}

async function test2_getRestockRecommendations() {
  console.log('\n📋 测试2: 获取入货建议');
  
  // 测试获取入货建议
  const { status, json } = await request('GET', '/api/restock/recommendations');
  
  assert(status === 200, '获取入货建议 HTTP 200');
  assert(json?.code === 0, '获取入货建议 API code=0');
  assert(Array.isArray(json?.data), '返回数据为数组');
}

async function test3_calculateSeasonalFactors() {
  console.log('\n📋 测试3: 计算季节性因子');
  
  // 测试计算季节性因子
  const { status, json } = await request('POST', '/api/restock/calculate-seasonal');
  
  assert(status === 200, '计算季节性因子 HTTP 200');
  assert(json?.code === 0, '计算季节性因子 API code=0');
  assert(Array.isArray(json?.data), '返回数据为数组');
  
  if (json?.data?.length > 0) {
    const factor = json.data[0];
    assert(typeof factor?.materialId === 'number', '因子包含materialId');
    assert(typeof factor?.month === 'number', '因子包含month');
    assert(typeof factor?.factor === 'number', '因子包含factor');
  }
}

async function test4_getSeasonalFactors() {
  console.log('\n📋 测试4: 获取季节性因子');
  
  // 测试获取季节性因子
  const { status, json } = await request('GET', '/api/restock/seasonal');
  
  assert(status === 200, '获取季节性因子 HTTP 200');
  assert(json?.code === 0, '获取季节性因子 API code=0');
  assert(Array.isArray(json?.data), '返回数据为数组');
}

async function test5_calculateSafetyStock() {
  console.log('\n📋 测试5: 计算安全库存');
  
  // 测试计算安全库存
  const { status, json } = await request('POST', '/api/restock/safety-stock', {
    materialId: 6, // 翡翠
    targetTurnover: 30
  });
  
  assert(status === 200, '计算安全库存 HTTP 200');
  assert(json?.code === 0, '计算安全库存 API code=0');
  assert(typeof json?.data?.safetyStock === 'number', '返回安全库存');
  assert(typeof json?.data?.avgDailySales === 'number', '返回平均日销量');
  assert(typeof json?.data?.leadTime === 'number', '返回提前期');
  assert(typeof json?.data?.safetyFactor === 'number', '返回安全系数');
}

async function test6_predictSales() {
  console.log('\n📋 测试6: 预测销量');
  
  // 测试预测销量
  const { status, json } = await request('POST', '/api/restock/predict-sales', {
    materialId: 6, // 翡翠
    days: 30
  });
  
  assert(status === 200, '预测销量 HTTP 200');
  assert(json?.code === 0, '预测销量 API code=0');
  assert(typeof json?.data?.predictedSales === 'number', '返回预测销量');
  assert(typeof json?.data?.avgDailySales === 'number', '返回平均日销量');
  assert(typeof json?.data?.historicalSales === 'number', '返回历史销量');
  assert(typeof json?.data?.confidence === 'number', '返回置信度');
}

async function test7_restockWithFilters() {
  console.log('\n📋 测试7: 带筛选条件的入货建议');
  
  // 测试带筛选条件的入货建议
  const { status, json } = await request('POST', '/api/restock/generate', {
    materialId: 6, // 翡翠
    ageRange: '0-30',
    heat: 'hot',
    limit: 3
  });
  
  assert(status === 200, '带筛选条件的入货建议 HTTP 200');
  assert(json?.code === 0, '带筛选条件的入货建议 API code=0');
  assert(Array.isArray(json?.data), '返回数据为数组');
  assert(json?.data?.length <= 3, `返回建议数量不超过限制 (${json?.data?.length}/3)`);
}

// ========== 主流程 ==========

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  翡翠进销存管理系统 — 入货建议功能测试         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n🌐 测试目标: ${BASE}\n`);
  
  const startTime = Date.now();
  
  try {
    // 测试生成和获取入货建议
    await test1_generateRestockRecommendations();
    await test2_getRestockRecommendations();
    
    // 测试季节性因子
    await test3_calculateSeasonalFactors();
    await test4_getSeasonalFactors();
    
    // 测试安全库存和销量预测
    await test5_calculateSafetyStock();
    await test6_predictSales();
    
    // 测试带筛选条件的入货建议
    await test7_restockWithFilters();
    
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
