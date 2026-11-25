import { createHash, randomBytes } from "node:crypto";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { AuditService } from "../audit/audit.service";
import { hashPassword, verifyPassword } from "./password-hash";

const audit = new AuditService();
const IDLE_SESSION_MS = 30 * 60 * 1000;
const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000;
const LOCK_BASE_MS = 15 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newSecret(): string { return randomBytes(32).toString("base64url"); }

export class AuthenticationService {
  async authenticate(
    username: string,
    password: string,
    tenantId: string,
    options: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const normalized = username.trim().toLowerCase();
    const identity = await withTenantTransaction({ tenantId }, async (tx) => ({
      tenantExists: Boolean(await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })),
      user: await tx.user.findFirst({ where: { tenantId, normalizedUsername: normalized } }),
    }));
    const user = identity.user;
    const now = new Date();
    if (!user || user.status !== "ACTIVE" || (user.lockedUntil && user.lockedUntil > now)) {
      if (identity.tenantExists) await audit.record({ tenantId, ...(user ? { resourceId: user.id } : {}), action: "AUTH_LOGIN_REJECTED", resourceType: "user", metadata: { reason: !user ? "unknown" : user.lockedUntil && user.lockedUntil > now ? "locked" : "inactive", username: normalized.slice(0, 40) } });
      throw new Error("INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const failure = await withTenantTransaction({ tenantId, userId: user.id }, async (tx) => {
        const updated = await tx.user.update({ where: { id: user.id, tenantId }, data: { failedLoginAttempts: { increment: 1 } }, select: { failedLoginAttempts: true } });
        const lockMinutes = updated.failedLoginAttempts >= 5 ? Math.min(24 * 60, 15 * 2 ** Math.min(5, Math.floor((updated.failedLoginAttempts - 5) / 5))) : 0;
        if (lockMinutes) {
          await tx.user.update({ where: { id: user.id, tenantId }, data: { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) } });
          await tx.session.updateMany({ where: { tenantId, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        return { attempts: updated.failedLoginAttempts, lockMinutes };
      });
      await audit.record({ tenantId, action: failure.lockMinutes ? "AUTH_ACCOUNT_LOCKED" : "AUTH_LOGIN_REJECTED", resourceType: "user", resourceId: user.id, metadata: { failedAttempts: failure.attempts, lockMinutes: failure.lockMinutes } });
      throw new Error("INVALID_CREDENTIALS");
    }

    const token = newSecret();
    const csrfToken = newSecret();
    const expiresAt = new Date(Date.now() + IDLE_SESSION_MS);
    const session = await withTenantTransaction({ tenantId, userId: user.id }, async (tx) => {
      await tx.user.update({ where: { id: user.id, tenantId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
      return tx.session.create({
        data: { tenantId, userId: user.id, tokenHash: tokenHash(token), csrfTokenHash: tokenHash(csrfToken), expiresAt, ipAddress: options.ipAddress ?? null, userAgent: options.userAgent ?? null },
        select: { id: true, expiresAt: true },
      });
    });
    await audit.record({ tenantId, actorUserId: user.id, action: "AUTH_LOGIN_SUCCEEDED", resourceType: "session", resourceId: session.id });
    return { token, csrfToken, sessionId: session.id, expiresAt: session.expiresAt, mustChangePassword: user.passwordChangeRequired, user: { id: user.id, tenantId: user.tenantId, username: user.username } };
  }

  async validateSession(token: string, tenantId: string) {
    // A malformed tenant identifier from a cookie or X-Tenant-Id header is an
    // authentication failure, not a server error (applyDatabaseScope throws).
    if (!token || token.length < 20 || token.length > 512 || !UUID_PATTERN.test(tenantId)) return null;
    const session = await withTenantTransaction({ tenantId }, (tx) => tx.session.findFirst({ where: { tokenHash: tokenHash(token), tenantId }, include: { user: true } }));
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || session.tenantId !== session.user.tenantId) return null;
    const now = new Date();
    const absoluteExpiry = new Date(session.createdAt.getTime() + ABSOLUTE_SESSION_MS);
    if (absoluteExpiry <= now) return null;
    const nextExpiry = new Date(Math.min(now.getTime() + IDLE_SESSION_MS, absoluteExpiry.getTime()));
    await withTenantTransaction({ tenantId: session.tenantId, userId: session.userId }, (tx) => tx.session.update({ where: { id: session.id, tenantId: session.tenantId }, data: { lastUsedAt: now, expiresAt: nextExpiry } }));
    return { sessionId: session.id, userId: session.userId, tenantId: session.tenantId, passwordChangeRequired: session.user.passwordChangeRequired, csrfTokenHash: session.csrfTokenHash, expiresAt: nextExpiry };
  }

  async changePassword(input: { tenantId: string; userId: string; currentPassword?: string; newPassword: string; ipAddress?: string; userAgent?: string }) {
    const result = await withTenantTransaction({ tenantId: input.tenantId, userId: input.userId }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: input.userId, tenantId: input.tenantId, status: "ACTIVE" } });
      if (!user || (!user.passwordChangeRequired && (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash))))) throw new Error("CURRENT_PASSWORD_INVALID");
      const passwordHash = await hashPassword(input.newPassword);
      await tx.user.update({ where: { id: user.id, tenantId: input.tenantId }, data: { passwordHash, passwordChangeRequired: false, failedLoginAttempts: 0, lockedUntil: null } });
      await tx.session.updateMany({ where: { tenantId: input.tenantId, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      const token = newSecret();
      const csrfToken = newSecret();
      const session = await tx.session.create({ data: { tenantId: input.tenantId, userId: user.id, tokenHash: tokenHash(token), csrfTokenHash: tokenHash(csrfToken), expiresAt: new Date(Date.now() + IDLE_SESSION_MS), ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null }, select: { id: true, expiresAt: true } });
      return { token, csrfToken, sessionId: session.id, expiresAt: session.expiresAt, user: { id: user.id, tenantId: user.tenantId, username: user.username } };
    });
    await audit.record({ tenantId: input.tenantId, actorUserId: input.userId, action: "AUTH_PASSWORD_CHANGED", resourceType: "user", resourceId: input.userId });
    return result;
  }

  async revokeSession(sessionId: string, tenantId: string, userId: string) {
    const result = await withTenantTransaction({ tenantId, userId }, (tx) => tx.session.updateMany({ where: { id: sessionId, tenantId, userId, revokedAt: null }, data: { revokedAt: new Date() } }));
    await audit.record({ tenantId, actorUserId: userId, action: "AUTH_SESSION_REVOKED", resourceType: "session", resourceId: sessionId });
    return result;
  }
}
