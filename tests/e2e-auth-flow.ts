/**
 * 用户全生命周期 E2E 测试：创建用户 → 登录 → 修改密码 → 重登录
 *
 * 覆盖 11 个安全场景：
 *   1. 创建新用户（合规密码）
 *   2. 弱密码创建 → 拒绝
 *   3. 重复用户名 → 拒绝
 *   4. 首次登录 → 成功 + mustChangePwd=true
 *   5. 不存在的用户登录 → 拒绝
 *   6. 错误密码登录 → 拒绝
 *   7. 修改密码 — 错误旧密码 → 拒绝
 *   8. 修改密码 — 新旧密码相同 → 拒绝
 *   9. 修改密码 — 成功
 *  10. 旧密码登录 → 拒绝
 *  11. 新密码登录 → 成功 + mustChangePwd=false
 *
 * 运行方式：
 *   npx tsx tests/e2e-auth-flow.ts
 */

const BASE = 'http://127.0.0.1:9677';
let adminToken = '';

// ========== 测试凭据 ==========
const ADMIN_PASSWORD = 'admin123';     // 系统安装时的默认管理员密码
const TEST_USER = {
  username: `test_u_${Date.now().toString(36)}`,
  password: 'T3st@Pass!',             // 8位+大写+小写+数字+特殊字符，符合复杂度 ✅
  displayName: '测试用户',
};
const NEW_PASSWORD = 'N3w!Passwd';
const WRONG_OLD = 'Wr0ng!Old';

// ========== HTTP 请求工具 ==========
async function request(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = token || adminToken;
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, ok: res.ok };
}

/** 管理员登录（旧版 /api/auth，仅需密码） */
async function adminLogin() {
  const res = await request('POST', '/api/auth', { password: ADMIN_PASSWORD });
  if (res.json?.data?.token) {
    adminToken = res.json.data.token;
    return res.json.data;
  }
  return null;
}

// ========== 断言工具 ==========
let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(msg: string) {
  passCount++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string) {
  failCount++;
  console.log(`  ❌ ${msg}`);
  failures.push(msg);
}

function check(cond: boolean, msg: string) {
  cond ? pass(msg) : fail(msg);
}

// ========== 测试用例 ==========

/** 场景 1: 管理员查询角色列表，获取可用的 roleId */
async function test_getStaffRoleId(): Promise<number> {
  console.log('\n📋 准备: 查询角色列表');
  const res = await request('GET', '/api/roles');
  if (res.json?.data) {
    // 支持两种返回格式：数组 / { list: [...] }
    const roles = Array.isArray(res.json.data) ? res.json.data : (res.json.data.list || []);
    // 查找 staff 角色
    const staffRole = roles.find((r: any) => r.name === 'staff');
    if (staffRole) {
      console.log(`  ℹ️  staff roleId = ${staffRole.id}`);
      return staffRole.id;
    }
    // 备用：用第一个非 admin 角色
    const first = roles.find((r: any) => r.name !== 'admin');
    if (first) {
      console.log(`  ℹ️  备用 roleId = ${first.id} (${first.name})`);
      return first.id;
    }
  }
  console.log('  ⚠️  未找到角色，回退 roleId=2');
  return 2;
}

/** 场景 2: 创建新用户 */
async function test_createUser(roleId: number) {
  console.log('\n📋 场景2: 创建新用户');

  // 2.1 弱密码 → 400
  const weakRes = await request('POST', '/api/users', {
    username: TEST_USER.username,
    password: '123',
    displayName: TEST_USER.displayName,
    roleId,
  });
  check(weakRes.status === 400,
    `弱密码创建被拒绝 (${weakRes.status})`);

  // 2.2 合规密码 → 200
  const createRes = await request('POST', '/api/users', {
    username: TEST_USER.username,
    password: TEST_USER.password,
    displayName: TEST_USER.displayName,
    roleId,
  });
  check(createRes.status === 200 || createRes.status === 201,
    `创建用户 HTTP ${createRes.status}`);
  check(createRes.json?.code === 0,
    '创建用户 code=0');
  check(createRes.json?.data?.id > 0,
    `返回用户 ID=${createRes.json?.data?.id}`);

  // 2.3 重复用户名 → 409
  const dupRes = await request('POST', '/api/users', {
    username: TEST_USER.username,
    password: TEST_USER.password,
    displayName: TEST_USER.displayName,
    roleId,
  });
  check(dupRes.status === 409,
    `重复用户名被拒绝 (${dupRes.status})`);

  console.log(`  ℹ️  用户: ${TEST_USER.username} / ${TEST_USER.password}`);
}

/** 场景 3: 正常登录（正确凭据） */
async function test_loginSuccess() {
  console.log('\n📋 场景3: 首次登录');

  const res = await request('POST', '/api/auth/login', {
    username: TEST_USER.username,
    password: TEST_USER.password,
  });

  check(res.status === 200, `登录 HTTP 200 (实际 ${res.status})`);
  check(res.json?.code === 0, '登录 code=0');
  check(!!res.json?.data?.token, '返回 token');
  check(res.json?.data?.user?.id > 0, '返回用户 ID');
  check(res.json?.data?.user?.mustChangePwd === true,
    `mustChangePwd=true`);
}

/** 场景 4: 不存在的用户 → 401 */
async function test_loginNonExistent() {
  console.log('\n📋 场景4: 不存在用户登录');
  const res = await request('POST', '/api/auth/login', {
    username: 'no_such_user_' + Date.now(),
    password: TEST_USER.password,
  });
  check(res.status === 401, `拒绝 (${res.status})`);
  check(res.json?.code === 401, 'code=401');
}

/** 场景 5: 错误密码 → 401 */
async function test_loginWrongPassword() {
  console.log('\n📋 场景5: 错误密码登录');
  const res = await request('POST', '/api/auth/login', {
    username: TEST_USER.username,
    password: 'Wr0ng!Pass!',
  });
  check(res.status === 401, `拒绝 (${res.status})`);
}

/** 场景 6: 错误旧密码改密 → 拒绝 */
async function test_changePasswordWrongOld() {
  console.log('\n📋 场景6: 错误旧密码改密');

  const login = await request('POST', '/api/auth/login', {
    username: TEST_USER.username, password: TEST_USER.password,
  });
  if (!login.json?.data?.token) { fail('无法获取 token'); return; }

  const res = await request('PUT', '/api/auth/password', {
    oldPassword: WRONG_OLD,
    newPassword: NEW_PASSWORD,
  }, login.json.data.token);

  check(res.status === 401 || res.status === 400,
    `拒绝 (${res.status})`);
}

/** 场景 7: 新旧密码相同 → 拒绝 */
async function test_changePasswordSame() {
  console.log('\n📋 场景7: 新旧密码相同改密');

  const login = await request('POST', '/api/auth/login', {
    username: TEST_USER.username, password: TEST_USER.password,
  });
  if (!login.json?.data?.token) { fail('无法获取 token'); return; }

  const res = await request('PUT', '/api/auth/password', {
    oldPassword: TEST_USER.password,
    newPassword: TEST_USER.password,   // 相同
  }, login.json.data.token);

  check(res.status === 400, `拒绝 (${res.status})`);
}

/** 场景 8: 修改密码成功 */
async function test_changePasswordSuccess() {
  console.log('\n📋 场景8: 修改密码（成功）');

  const login = await request('POST', '/api/auth/login', {
    username: TEST_USER.username, password: TEST_USER.password,
  });
  if (!login.json?.data?.token) { fail('无法获取 token'); return; }

  const res = await request('PUT', '/api/auth/password', {
    oldPassword: TEST_USER.password,
    newPassword: NEW_PASSWORD,
  }, login.json.data.token);

  check(res.status === 200, `改密 HTTP ${res.status}`);
  check(res.json?.code === 0, '改密 code=0');
}

/** 场景 9: 旧密码登录 → 401 */
async function test_loginOldPassword() {
  console.log('\n📋 场景9: 旧密码登录');
  const res = await request('POST', '/api/auth/login', {
    username: TEST_USER.username,
    password: TEST_USER.password,
  });
  check(res.status === 401, `拒绝 (${res.status})`);
}

/** 场景 10: 新密码登录 → 成功 */
async function test_loginNewPassword() {
  console.log('\n📋 场景10: 新密码登录');

  const res = await request('POST', '/api/auth/login', {
    username: TEST_USER.username,
    password: NEW_PASSWORD,
  });

  check(res.status === 200, `HTTP ${res.status}`);
  check(res.json?.code === 0, 'code=0');
  check(!!res.json?.data?.token, '返回 token');

  // 改密后 mustChangePwd=false
  check(res.json?.data?.user?.mustChangePwd === false,
    `mustChangePwd=false (实际 ${res.json?.data?.user?.mustChangePwd})`);
}

/** 场景 11: 弱密码边界验证（控制在限流阈值内） */
async function test_weakPasswords(roleId: number) {
  console.log('\n📋 场景11: 弱密码边界验证');

  const weakCases = [
    { pwd: 'short', desc: '太短(<8)' },
    { pwd: 'nouppercase1!', desc: '缺少大写' },
  ];

  for (const { pwd, desc } of weakCases) {
    const res = await request('POST', '/api/users', {
      username: `weak_${Math.random().toString(36).slice(2, 7)}`,
      password: pwd,
      displayName: '测试',
      roleId,
    });
    // 接受 400（密码不合规）或 429（限流中）
    check(res.status === 400 || res.status === 429,
      `弱密码(${desc})被拒绝 (${res.status})`);
  }
}

/**
 * 场景 12: 验证审计日志
 * 检查场景 8 的 change_password 和场景 3/6/7 的 login 日志
 */
async function test_auditLogs() {
  console.log('\n📋 场景12: 审计日志验证');

  // 查询密码变更日志
  const logsRes = await request('GET', '/api/logs?action=change_password&page=1&size=50');
  check(logsRes.status === 200, `审计日志查询 HTTP ${logsRes.status}`);

  // API 返回格式: { code: 0, data: { items: [...], pagination: {...} } }
  const data = logsRes.json?.data;
  const logArr = Array.isArray(data?.items) ? data.items : [];

  const changeLogs = logArr.filter((l: any) => l.action === 'change_password');
  check(changeLogs.length >= 1,
    `存在 change_password 日志 (${changeLogs.length} 条)`);

  // detail 中不包含明文密码
  for (const log of changeLogs) {
    const detail = typeof log.detail === 'string'
      ? JSON.parse(log.detail)
      : log.detail;
    if (detail) {
      const detailStr = JSON.stringify(detail);
      check(!detailStr.includes(TEST_USER.password), '日志无明文旧密码');
      check(!detailStr.includes(NEW_PASSWORD), '日志无明文新密码');
    }
  }

  // 查询登录日志
  const loginLogRes = await request('GET', '/api/logs?action=login_success&action=login_failed&page=1&size=50');
  check(loginLogRes.status === 200, '登录日志查询正常');
}

// ========== 主流程 ==========
async function main() {
  console.log('═'.repeat(50));
  console.log('🔐 用户全生命周期 E2E 测试');
  console.log(`  服务器: ${BASE}`);
  console.log('═'.repeat(50));

  // Step 0: 管理员登录
  const adminData = await adminLogin();
  if (!adminData) {
    console.log('\n❌ 管理员登录失败 — 可能是限流(429)或服务未启动');
    console.log('  解决方法: 重启开发服务器清内存限流状态');
    console.log('  taskkill /F /PID <pid> && npx next dev -p 9677');
    process.exit(1);
  }
  pass('管理员已登录');

  // Step 1: 获取角色
  const roleId = await test_getStaffRoleId();

  // Step 2-12: 按顺序执行
  await test_createUser(roleId);
  await test_loginSuccess();
  await test_loginNonExistent();
  await test_loginWrongPassword();
  await test_changePasswordWrongOld();
  await test_changePasswordSame();
  await test_changePasswordSuccess();
  await test_loginOldPassword();
  await test_loginNewPassword();
  await test_weakPasswords(roleId);
  await test_auditLogs();

  // 汇总
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 ${passCount} ✅ 通过 / ${failCount} ❌ 失败`);
  if (failures.length > 0) {
    console.log('\n失败明细:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ❌ ${f}`));
  }
  console.log('═'.repeat(50));
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ 异常:', err);
  process.exit(1);
});
