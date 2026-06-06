import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NotFoundError, ValidationError, ConflictError, AppError } from '@/lib/errors';

// ─── 类型定义 ─────────────────────────────────────────────

export interface RoleInfo {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

// ─── 内部辅助 ─────────────────────────────────────────────

function formatRole(role: Prisma.RoleGetPayload<Record<string, never>>, userCount = 0): RoleInfo {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: parsePermissions(role.permissions),
    isSystem: role.isSystem,
    userCount,
  };
}

function parsePermissions(permissionsStr: string): string[] {
  try {
    const parsed = JSON.parse(permissionsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── 权限常量 ─────────────────────────────────────────────

export const PERMISSIONS = [
  'tab:dashboard',
  'tab:inventory',
  'tab:sales',
  'tab:batches',
  'tab:customers',
  'tab:settings',
  'tab:logs',
  'tab:promotions',
  'tab:restock',
  'tab:stocktaking',
  'action:user_manage',
  'action:role_manage',
  'action:export',
  'action:delete_item',
  'action:price_adjust',
] as const;

export type PermissionKey = typeof PERMISSIONS[number];

export const ADMIN_PERMISSIONS: string[] = [...PERMISSIONS];

export const MANAGER_PERMISSIONS: string[] = [
  'tab:dashboard',
  'tab:inventory',
  'tab:sales',
  'tab:batches',
  'tab:customers',
  'tab:logs',
  'tab:promotions',
  'tab:restock',
  'tab:stocktaking',
  'action:export',
  'action:delete_item',
  'action:price_adjust',
];

export const STAFF_PERMISSIONS: string[] = [
  'tab:dashboard',
  'tab:inventory',
  'tab:sales',
  'tab:customers',
];

export const PRESET_ROLES = [
  { name: 'admin', description: '系统管理员，拥有全部权限', permissions: ADMIN_PERMISSIONS, isSystem: true },
  { name: 'manager', description: '经理，可管理大部分业务', permissions: MANAGER_PERMISSIONS, isSystem: true },
  { name: 'staff', description: '普通员工，仅可浏览查看', permissions: STAFF_PERMISSIONS, isSystem: true },
];

// ─── Service 方法 ─────────────────────────────────────────

/**
 * 获取角色列表（不分页）
 * 每个角色附带 userCount（活跃用户数）
 */
export async function listRoles(): Promise<RoleInfo[]> {
  const roles = await db.role.findMany({
    orderBy: { createdAt: 'asc' },
  });

  // 批量查询各角色下的活跃用户数
  const roleIds = roles.map(r => r.id);
  const userCounts = await db.user.groupBy({
    by: ['roleId'],
    where: {
      roleId: { in: roleIds },
      isActive: true,
    },
    _count: { id: true },
  });

  const countMap = new Map<number, number>();
  for (const uc of userCounts) {
    if (uc.roleId !== null) {
      countMap.set(uc.roleId, uc._count.id);
    }
  }

  return roles.map(role => formatRole(role, countMap.get(role.id) ?? 0));
}

/**
 * 获取单个角色详情
 * @throws NotFoundError 角色不存在
 */
export async function getRole(id: number): Promise<RoleInfo> {
  const role = await db.role.findUnique({ where: { id } });
  if (!role) {
    throw new NotFoundError('角色不存在');
  }

  const userCount = await db.user.count({
    where: { roleId: id, isActive: true },
  });

  return formatRole(role, userCount);
}

/**
 * 创建自定义角色
 * @throws ValidationError 参数校验失败
 * @throws ConflictError 角色名已存在
 */
export async function createRole(data: CreateRoleInput): Promise<RoleInfo> {
  const { name, description, permissions } = data;

  if (!name || name.trim().length === 0) {
    throw new ValidationError('角色名不能为空');
  }

  // 检查是否与预置角色重名
  const isPresetName = PRESET_ROLES.some(p => p.name === name.trim());
  if (isPresetName) {
    throw new ConflictError('不能使用预置角色名');
  }

  // 检查是否已存在同名角色
  const existing = await db.role.findUnique({ where: { name: name.trim() } });
  if (existing) {
    throw new ConflictError('角色名已存在');
  }

  // 校验权限 key 合法性
  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    throw new ValidationError('请至少选择一个权限');
  }

  const role = await db.role.create({
    data: {
      name: name.trim(),
      description: description?.trim() ?? null,
      permissions: JSON.stringify(permissions),
      isSystem: false,
    },
  });

  return formatRole(role, 0);
}

/**
 * 更新角色
 * isSystem 角色不可修改 name
 * @throws NotFoundError 角色不存在
 * @throws ValidationError 参数校验失败
 */
export async function updateRole(id: number, data: UpdateRoleInput): Promise<RoleInfo> {
  const role = await db.role.findUnique({ where: { id } });
  if (!role) {
    throw new NotFoundError('角色不存在');
  }

  const updateData: Prisma.RoleUpdateInput = {};

  if (data.name !== undefined) {
    if (role.isSystem) {
      throw new ValidationError('系统预置角色不可修改名称');
    }
    const nameTrimmed = data.name.trim();
    if (!nameTrimmed) {
      throw new ValidationError('角色名不能为空');
    }
    // 检查重名
    const conflict = await db.role.findFirst({
      where: { name: nameTrimmed, id: { not: id } },
    });
    if (conflict) {
      throw new ConflictError('角色名已存在');
    }
    updateData.name = nameTrimmed;
  }

  if (data.description !== undefined) {
    updateData.description = data.description?.trim() ?? null;
  }

  if (data.permissions !== undefined) {
    if (!Array.isArray(data.permissions) || data.permissions.length === 0) {
      throw new ValidationError('请至少选择一个权限');
    }
    updateData.permissions = JSON.stringify(data.permissions);
  }

  const updated = await db.role.update({
    where: { id },
    data: updateData,
  });

  const userCount = await db.user.count({
    where: { roleId: id, isActive: true },
  });

  return formatRole(updated, userCount);
}

/**
 * 删除角色
 * @throws AppError 系统角色不可删除
 * @throws ConflictError 角色下有用户
 * @throws NotFoundError 角色不存在
 */
export async function deleteRole(id: number): Promise<void> {
  const role = await db.role.findUnique({ where: { id } });
  if (!role) {
    throw new NotFoundError('角色不存在');
  }

  if (role.isSystem) {
    throw new AppError('系统预置角色不可删除', 403, 403);
  }

  // 检查是否有用户关联
  const userCount = await db.user.count({ where: { roleId: id } });
  if (userCount > 0) {
    throw new ConflictError(`该角色下还有 ${userCount} 个用户，无法删除`);
  }

  await db.role.delete({ where: { id } });
}
