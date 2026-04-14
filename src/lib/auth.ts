// Database-backed session-based auth for single-user NAS app
// Sessions persist across server restarts via SQLite

import { db } from '@/lib/db';

const SESSION_TTL_DAYS = 7; // 7-day session expiry

/** Generate a random session token */
export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'session-';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/** Clean expired sessions from the database */
export async function cleanExpiredSessions(): Promise<void> {
  try {
    await db.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  } catch {
    // Silently fail - not critical
  }
}

/** Create a new session, returns the token */
export async function createSession(): Promise<string> {
  // Clean expired sessions first
  await cleanExpiredSessions();

  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      token,
      userId: 'admin',
      expiresAt,
    },
  });

  return token;
}

/** Validate a token, returns true if valid */
export async function validateToken(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    const session = await db.session.findUnique({
      where: { token },
    });

    if (!session) return false;

    // Check expiration
    if (new Date() > session.expiresAt) {
      // Delete expired session
      await db.session.delete({ where: { token } }).catch(() => {});
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/** Delete a session (logout) */
export async function deleteSession(token: string): Promise<void> {
  try {
    await db.session.delete({
      where: { token },
    });
  } catch {
    // Session may not exist, that's fine
  }
}
