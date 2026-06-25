/**
 * NAS 生产环境角色权限更新脚本
 * 
 * 只更新角色权限，不触碰其他业务数据。
 * 运行方式：npx tsx prisma/seed-nas-roles.ts
 * 
 * 注意：数据库路径需根据实际挂载位置调整
 */

import { PrismaClient } from '@prisma/client';

// NAS 数据库路径
const DB_PATH = 'file:Z:/nvme12-13143360616/docker/Xing/data/db/custom.db';

const prisma = new PrismaClient({
  datasources: { db: { url: DB_PATH } },
});

// ─── 权限定义 ───────────────────────────────────────

const TAB_PERMISSIONS = [
  'tab:dashboard', 'tab:inventory', 'tab:sales', 'tab:batches',
  'tab:customers', 'tab:settings', 'tab:logs', 'tab:promotions',
  'tab:restock', 'tab:stocktaking',
];

const ADMIN_PERMISSIONS = [
  ...TAB_PERMISSIONS,
  'action:user_manage', 'action:role_manage',
  'action:export', 'action:import_data',
  'action:item_create', 'action:item_edit', 'action:item_delete',
  'action:delete_item', 'action:item_view', 'action:item_batch_ops',
  'action:sale_create', 'action:sale_return', 'action:sale_bundle',
  'action:sale_view', 'action:sale_edit',
  'action:batch_create', 'action:batch_edit', 'action:batch_allocate',
  'action:batch_view',
  'action:customer_create', 'action:customer_edit', 'action:customer_delete',
  'action:customer_merge', 'action:customer_view',
  'action:supplier_manage', 'action:dict_manage', 'action:config_manage',
  'action:backup_manage', 'action:log_view', 'action:metal_price_manage',
  'action:promotion_manage', 'action:stocktaking_manage',
  'action:restock_manage', 'action:price_adjust',
];

const MANAGER_PERMISSIONS = [
  ...TAB_PERMISSIONS.filter(t => t !== 'tab:settings'),
  'action:export', 'action:import_data',
  'action:item_create', 'action:item_edit', 'action:item_delete',
  'action:delete_item', 'action:item_view', 'action:item_batch_ops',
  'action:sale_create', 'action:sale_return', 'action:sale_bundle',
  'action:sale_view', 'action:sale_edit',
  'action:batch_create', 'action:batch_edit', 'action:batch_allocate',
  'action:batch_view',
  'action:customer_create', 'action:customer_edit', 'action:customer_delete',
  'action:customer_merge', 'action:customer_view',
  'action:supplier_manage', 'action:dict_manage',
  'action:log_view', 'action:metal_price_manage',
  'action:promotion_manage', 'action:stocktaking_manage',
  'action:restock_manage', 'action:price_adjust',
];

const STAFF_PERMISSIONS = [
  'tab:dashboard', 'tab:inventory', 'tab:sales', 'tab:customers',
  'action:item_view', 'action:sale_view', 'action:batch_view',
  'action:customer_view', 'action:log_view',
];

const PRESET_ROLES = [
  { name: 'admin', permissions: ADMIN_PERMISSIONS },
  { name: 'manager', permissions: MANAGER_PERMISSIONS },
  { name: 'staff', permissions: STAFF_PERMISSIONS },
];

async function main() {
  // 先备份当前权限（防误操作）
  const oldRoles = await prisma.role.findMany({
    where: { name: { in: PRESET_ROLES.map(r => r.name) } },
    select: { id: true, name: true, permissions: true },
  });
  
  console.log('当前角色权限状态:');
  for (const r of oldRoles) {
    const perms = JSON.parse(r.permissions);
    console.log(`  ${r.name} (id=${r.id}): ${perms.length} 个权限`);
  }
  
  // 更新角色权限
  for (const preset of PRESET_ROLES) {
    const role = await prisma.role.findUnique({ where: { name: preset.name } });
    if (!role) {
      console.log(`  ⚠️ 角色 ${preset.name} 不存在，跳过`);
      continue;
    }
    
    const oldPerms = JSON.parse(role.permissions);
    const newPermsStr = JSON.stringify(preset.permissions);
    
    await prisma.role.update({
      where: { name: preset.name },
      data: { permissions: newPermsStr },
    });
    
    const added = preset.permissions.filter((p: string) => !oldPerms.includes(p));
    const removed = oldPerms.filter((p: string) => !preset.permissions.includes(p));
    
    console.log(`\n✅ ${preset.name}: ${oldPerms.length} → ${preset.permissions.length} 个权限`);
    if (added.length > 0) console.log(`   新增: ${added.join(', ')}`);
    if (removed.length > 0) console.log(`   移除: ${removed.join(', ')}`);
  }
  
  // 验证
  const newRoles = await prisma.role.findMany({
    where: { name: { in: PRESET_ROLES.map(r => r.name) } },
    select: { id: true, name: true, permissions: true },
  });
  
  console.log('\n更新后角色权限状态:');
  for (const r of newRoles) {
    const perms = JSON.parse(r.permissions);
    console.log(`  ${r.name} (id=${r.id}): ${perms.length} 个权限`);
  }
  
  console.log('\n✅ 角色权限更新完成！请重启容器使新代码生效。');
}

main()
  .catch(e => {
    console.error('❌ 更新失败:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
