import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { withTenantTransaction } from "../../infrastructure/database/transaction";
import { prisma } from "../../infrastructure/database/prisma";
import { hashPassword } from "../authentication/password-hash";
import { AuditService } from "../audit/audit.service";

const audit = new AuditService();

export interface CreateIdentityInput {
  tenantId: string;
  email?: string;
  username: string;
  password: string;
}

export class IdentityService {
  async bootstrapStatus() {
    const state = await prisma.platformSetupState.findUnique({ where: { id: 1 }, select: { completed: true } });
    return { available: state?.completed === false && (process.env.BOOTSTRAP_TOKEN?.length ?? 0) >= 32 };
  }

  async bootstrapOwner(input: {
    bootstrapToken: string;
    tenantName: string;
    tenantSlug: string;
  }) {
    const configuredToken = process.env.BOOTSTRAP_TOKEN;
    if (!configuredToken || configuredToken.length < 32) throw new Error("BOOTSTRAP_NOT_CONFIGURED");
    const suppliedHash = createHash("sha256").update(input.bootstrapToken).digest();
    const configuredHash = createHash("sha256").update(configuredToken).digest();
    if (!timingSafeEqual(suppliedHash, configuredHash)) throw new Error("BOOTSTRAP_TOKEN_INVALID");

    const tenantName = input.tenantName.trim();
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const username = `owner-${randomBytes(9).toString("hex")}`;
    const password = randomBytes(32).toString("base64url");
    const normalizedUsername = username.toLowerCase();
    validateOwnerFields(tenantName, tenantSlug, username);
    const passwordHash = await hashPassword(password);
    const tenantId = randomUUID();
    const result = await withTenantTransaction({ tenantId }, async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(927413662) IS NULL AS locked`;
      const state = await tx.platformSetupState.findUnique({ where: { id: 1 }, select: { completed: true } });
      if (!state || state.completed) throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
      const tenant = await tx.tenant.create({ data: { id: tenantId, name: tenantName, slug: tenantSlug } });
      const user = await tx.user.create({
        data: { tenantId, username, normalizedUsername, passwordHash, passwordChangeRequired: true },
        select: { id: true, tenantId: true, email: true, username: true, status: true, createdAt: true },
      });
      const role = await tx.role.create({ data: { tenantId, name: "PLATFORM_OWNER", description: "Platform owner" } });
      await grantOwnerPermissions(tx, tenantId, user.id, role.id);
      await tx.platformSetupState.update({ where: { id: 1 }, data: { completed: true } });
      return { tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, user, credentials: { username, password } };
    });
    await audit.record({ tenantId, actorUserId: result.user.id, action: "IDENTITY_OWNER_BOOTSTRAPPED", resourceType: "user", resourceId: result.user.id });
    return result;
  }

  async create(input: CreateIdentityInput) {
    const email = input.email?.trim().toLowerCase();
    const username = input.username.trim();
    const normalizedUsername = username.toLowerCase();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }

    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
      throw new Error("Invalid username");
    }

    const tenant = await withTenantTransaction({ tenantId: input.tenantId }, (tx) => tx.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, status: true },
    }));

    if (!tenant || tenant.status !== "ACTIVE") {
      throw new Error("Tenant is unavailable");
    }

    const passwordHash = await hashPassword(input.password);

    return withTenantTransaction({ tenantId: input.tenantId }, (tx) => tx.user.create({
      data: {
        tenantId: input.tenantId,
        ...(email ? { email, normalizedEmail: email } : {}),
        username,
        normalizedUsername,
        passwordHash,
        passwordChangeRequired: true,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        username: true,
        status: true,
        createdAt: true,
      },
    }));
  }

  async provisionUser(tenantId: string, actorUserId: string, roleId?: string) {
    const username = `user-${randomBytes(9).toString("hex")}`;
    const password = randomBytes(32).toString("base64url");
    const passwordHash = await hashPassword(password);
    const user = await withTenantTransaction({ tenantId }, async (tx) => {
      if (roleId) {
        const role = await tx.role.findFirst({ where: { id: roleId, tenantId }, select: { id: true } });
        if (!role) throw new Error("ROLE_NOT_FOUND");
      }
      const created = await tx.user.create({
        data: { tenantId, username, normalizedUsername: username.toLowerCase(), passwordHash, passwordChangeRequired: true },
        select: { id: true, tenantId: true, username: true, status: true, createdAt: true },
      });
      if (roleId) await tx.userRole.create({ data: { tenantId, userId: created.id, roleId } });
      return created;
    });
    await audit.record({ tenantId, actorUserId, action: "IDENTITY_USER_CREATED", resourceType: "user", resourceId: user.id, metadata: { roleAssigned: Boolean(roleId) } });
    return { user, credentials: { username, password } };
  }

  async resetCredentials(tenantId: string, actorUserId: string, userId: string) {
    const password = randomBytes(32).toString("base64url");
    const passwordHash = await hashPassword(password);
    const updated = await withTenantTransaction({ tenantId, userId }, async (tx) => {
      const user = await tx.user.update({ where: { id: userId, tenantId }, data: { passwordHash, passwordChangeRequired: true, failedLoginAttempts: 0, lockedUntil: null }, select: { id: true, username: true, status: true } });
      await tx.session.updateMany({ where: { tenantId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return user;
    });
    await audit.record({ tenantId, actorUserId, action: "IDENTITY_CREDENTIALS_RESET", resourceType: "user", resourceId: userId });
    return { user: updated, credentials: { username: updated.username, password } };
  }

  async setUsername(tenantId: string, actorUserId: string, userId: string, username: string) {
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username.trim())) throw new Error("USERNAME_INVALID");
    const user = await withTenantTransaction({ tenantId, userId }, async (tx) => {
      const updated = await tx.user.update({ where: { id: userId, tenantId }, data: { username: username.trim(), normalizedUsername }, select: { id: true, tenantId: true, username: true, status: true } });
      await tx.session.updateMany({ where: { tenantId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    await audit.record({ tenantId, actorUserId, action: "IDENTITY_USERNAME_CHANGED", resourceType: "user", resourceId: userId });
    return user;
  }

  async assignRoles(tenantId: string, actorUserId: string, userId: string, roleIds: string[]) {
    const roles = await withTenantTransaction({ tenantId, userId }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
      if (!user) throw new Error("USER_NOT_FOUND");
      const found = await tx.role.findMany({ where: { tenantId, id: { in: roleIds } }, select: { id: true } });
      if (found.length !== new Set(roleIds).size) throw new Error("ROLE_NOT_FOUND");
      await tx.userRole.deleteMany({ where: { tenantId, userId } });
      if (found.length) await tx.userRole.createMany({ data: found.map((role) => ({ tenantId, userId, roleId: role.id })) });
      await tx.session.updateMany({ where: { tenantId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return found.map((role) => role.id);
    });
    await audit.record({ tenantId, actorUserId, action: "IDENTITY_ROLES_CHANGED", resourceType: "user", resourceId: userId, metadata: { roleCount: roles.length } });
    return roles;
  }

  async unlock(tenantId: string, actorUserId: string, userId: string) {
    const result = await withTenantTransaction({ tenantId, userId }, (tx) => tx.user.updateMany({ where: { id: userId, tenantId }, data: { failedLoginAttempts: 0, lockedUntil: null } }));
    if (!result.count) throw new Error("USER_NOT_FOUND");
    await audit.record({ tenantId, actorUserId, action: "IDENTITY_ACCOUNT_UNLOCKED", resourceType: "user", resourceId: userId });
    return { unlocked: true };
  }

  async disable(tenantId: string, actorUserId: string, userId: string) {
    const result = await withTenantTransaction({ tenantId, userId }, async (tx) => {
      const user = await tx.user.updateMany({
        where: { id: userId, tenantId },
        data: { status: "DISABLED" },
      });

      await tx.session.updateMany({
        where: { tenantId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { disabled: user.count === 1 };
    });
    if (result.disabled) await audit.record({ tenantId, actorUserId, action: "IDENTITY_USER_DISABLED", resourceType: "user", resourceId: userId });
    return result;
  }
}

function validateOwnerFields(tenantName: string, tenantSlug: string, username: string) {
  if (tenantName.length < 2 || tenantName.length > 120) throw new Error("TENANT_NAME_INVALID");
  if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(tenantSlug)) throw new Error("TENANT_SLUG_INVALID");
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw new Error("USERNAME_INVALID");
}

async function grantOwnerPermissions(tx: Parameters<Parameters<typeof withTenantTransaction>[1]>[0], tenantId: string, userId: string, roleId: string) {
  const permissionKeys = ["platform.manage", "provider.manage", "provider.activate", "agent.manage", "workflow.manage", "execution.approve", "device.manage", "workspace.manage", "execution.submit"];
  const permissions = await Promise.all(permissionKeys.map((key) => tx.permission.create({
    data: { tenantId, key }, select: { id: true },
  })));
  await tx.userRole.create({ data: { tenantId, userId, roleId } });
  await tx.rolePermission.createMany({ data: permissions.map(({ id }) => ({ tenantId, roleId, permissionId: id, effect: "ALLOW" })) });
}
