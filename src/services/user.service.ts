import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/errors';

// ─── 类型定义 ─────────────────────────────────────────────

export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  roleId: number;
  roleName: string;
  isActive: boolean;
  mustChangePwd: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  displayName: string;
  roleId: number;
}

export interface UpdateUserInput {
  displayName?: string;
  roleId?: number;
  isActive?: boolean;
}

export interface UsersListParams {
  page?: number;
  limit?: number;
  keyword?: string;
  roleId?: number;
  isActive?: boolean;
}

export interface UsersListResponse {
  items: UserInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── 内部辅助 ─────────────────────────────────────────────

function formatUser(user: any): UserInfo {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? '',
    roleId: user.roleId ?? 0,
    roleName: user.role?.name ?? '',
    isActive: user.isActive,
    mustChangePwd: user.mustChangePwd,
    lastLoginAt: user.lastLoginAt?.toISOString?.() ?? user.lastLoginAt ?? null,
    createdAt: user.createdAt?.toISOString?.() ?? user.createdAt ?? '',
  };
}

// ─── Service 方法 ─────────────────────────────────────────

/**
 * 用户列表（分页 + 筛选）
 * 支持 keyword 模糊搜索 username/displayName、roleId 和 isActive 精确筛选
 */
export async function listUsers(params: UsersListParams = {}): Promise<UsersListResponse> {
  const { page = 1, limit = 20, keyword, roleId, isActive } = params;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (keyword) {
    where.OR = [
      { username: { contains: keyword } },
      { displayName: { contains: keyword } },
    ];
  }
  if (roleId !== undefined) {
    where.roleId = roleId;
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip,
      take: limit,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    items: users.map(formatUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 获取单个用户详情
 * @throws NotFoundError 用户不存在
 */
export async function getUser(id: number): Promise<UserInfo> {
  const user = await db.user.findUnique({
    where: { id },
    include: { role: true },
  });

  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  return formatUser(user);
}

/**
 * 创建用户
 * 密码使用 bcrypt 哈希存储，默认 mustChangePwd = true
 * @throws ValidationError 参数校验失败
 * @throws ConflictError 用户名已存在
 */
export async function createUser(data: CreateUserInput): Promise<UserInfo> {
  const { username, password, displayName, roleId } = data;

  if (!username || username.trim().length === 0) {
    throw new ValidationError('用户名不能为空');
  }
  if (!password || password.length < 4) {
    throw new ValidationError('密码长度不能少于4位');
  }
  if (!roleId) {
    throw new ValidationError('请选择用户角色');
  }

  // 检查用户名是否已存在
  const existing = await db.user.findUnique({ where: { username: username.trim() } });
  if (existing) {
    throw new ConflictError('用户名已存在');
  }

  // 检查角色是否存在
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new NotFoundError('角色不存在');
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const user = await db.user.create({
    data: {
      username: username.trim(),
      passwordHash,
      displayName: displayName.trim(),
      roleId,
      isActive: true,
      mustChangePwd: true,
    },
    include: { role: true },
  });

  return formatUser(user);
}

/**
 * 更新用户信息（不修改密码）
 * @throws NotFoundError 用户不存在
 * @throws ValidationError 参数无效
 */
export async function updateUser(id: number, data: UpdateUserInput): Promise<UserInfo> {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  // 如果修改角色，检查角色是否存在
  if (data.roleId !== undefined) {
    const role = await db.role.findUnique({ where: { id: data.roleId } });
    if (!role) {
      throw new NotFoundError('角色不存在');
    }
  }

  const updateData: any = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName.trim();
  if (data.roleId !== undefined) updateData.roleId = data.roleId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    include: { role: true },
  });

  return formatUser(updated);
}

/**
 * 软删除用户（设置 isActive = false）
 * 禁止禁用自身
 * @throws ValidationError 试图禁用自身
 * @throws NotFoundError 用户不存在
 */
export async function deleteUser(id: number, currentUserId: number): Promise<void> {
  if (id === currentUserId) {
    throw new ValidationError('不能禁用自身');
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  await db.user.update({
    where: { id },
    data: { isActive: !user.isActive }, // 切换启用/禁用状态
  });
}

/**
 * 修改用户角色
 * @throws NotFoundError 用户/角色不存在
 */
export async function updateUserRole(id: number, roleId: number): Promise<void> {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new NotFoundError('角色不存在');
  }

  await db.user.update({
    where: { id },
    data: { roleId },
  });
}

/**
 * 重置用户密码
 * @throws NotFoundError 用户不存在
 * @throws ValidationError 密码长度不足
 */
export async function resetUserPassword(id: number, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 4) {
    throw new ValidationError('密码长度不能少于4位');
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await db.user.update({
    where: { id },
    data: { passwordHash, mustChangePwd: true },
  });
}

/**
 * 更新用户最后登录时间
 */
export async function updateLastLogin(id: number): Promise<void> {
  await db.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}
