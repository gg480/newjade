// Database-backed session-based auth for multi-user support
// Sessions persist across server restarts via SQLite

import { db } from '@/lib/db';
import crypto from 'crypto';

const SESSION_TTL_DAYS = 7; // 7-day session expiry

/** 生成密码学安全的随机 session token（使用 crypto.randomBytes） */
export function generateToken(): string {
  return `session-${crypto.randomBytes(32).toString('base64url')}`;
}

/** Clean expired sessions from the database */
export async function cleanExpiredSessions(): Promise<void> {
  try {
    await db.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  } catch (e) {
    console.error('[Auth]', e);
    // Silently fail - not critical
  }
}

/**
 * Create a new session for a specific user
 * @param userId - User ID to associate with the session
 * @returns The generated token string
 */
export async function createSession(userId: number): Promise<string> {
  // Clean expired sessions first
  await cleanExpiredSessions();

  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: number;
}

/**
 * Validate a token, return validation result with user info
 * @param token - The session token to validate
 * @returns TokenValidationResult with valid flag and userId if valid
 */
export async function validateToken(token: string): Promise<TokenValidationResult> {
  if (!token) return { valid: false };

  try {
    const session = await db.session.findUnique({
      where: { token },
    });

    if (!session) return { valid: false };

    // Check expiration
    if (new Date() > session.expiresAt) {
      // Delete expired session
      await db.session.delete({ where: { token } }).catch(() => {});
      return { valid: false };
    }

    // Check if userId is set
    if (session.userId == null) return { valid: false };

    const uid: number = session.userId;

    // Check if user is still active
    const user = await db.user.findUnique({ where: { id: uid } });
    if (!user || !user.isActive) {
      await db.session.delete({ where: { token } }).catch(() => {});
      return { valid: false };
    }

    return { valid: true, userId: uid };
  } catch (e) {
    console.error('[Auth]', e);
    return { valid: false };
  }
}

/**
 * Parse permissions JSON string to array
 * @param permissionsStr - JSON string of permissions array
 * @returns Array of permission strings
 */
export function parsePermissions(permissionsStr: string): string[] {
  try {
    const parsed = JSON.parse(permissionsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get user permissions by user ID
 * @param userId - User ID to look up
 * @returns Array of permission strings
 */
export async function getPermissions(userId: number): Promise<string[]> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.role) return [];

    return parsePermissions(user.role.permissions);
  } catch {
    return [];
  }
}

/** Delete a session (logout) */
export async function deleteSession(token: string): Promise<void> {
  try {
    await db.session.delete({
      where: { token },
    });
  } catch (e) {
    console.error('[Auth]', e);
    // Session may not exist, that's fine
  }
}

/**
 * Check if a user has a specific permission
 * - Admin 角色直接放行（拥有全部权限）
 * - 其他角色按权限列表校验
 * @param userId - User ID
 * @param permission - Permission key to check
 * @returns boolean
 */
export async function hasPermission(userId: number, permission: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.role) return false;

    // Admin 角色拥有全部权限
    if (user.role.name === 'admin') return true;

    const permissions = parsePermissions(user.role.permissions);
    return permissions.includes(permission);
  } catch {
    return false;
  }
}
