const { randomUUID } = require("node:crypto");
const { withTenantTransaction } = require("../../../apps/api/dist/apps/api/src/infrastructure/database/transaction.js");
const { IdentityService } = require("../../../apps/api/dist/apps/api/src/modules/identity/identity.service.js");
const { AuthenticationService } = require("../../../apps/api/dist/apps/api/src/modules/authentication/authentication.service.js");

const ownerPermissions = [
  "platform.manage", "provider.manage", "provider.activate", "agent.manage", "workflow.manage",
  "execution.approve", "device.manage", "workspace.manage", "execution.submit",
];

async function createTestTenant({ name, slug, username, password, permissions = ownerPermissions }) {
  const tenantId = randomUUID();
  await withTenantTransaction({ tenantId }, (tx) => tx.tenant.create({ data: { id: tenantId, name, slug } }));
  const user = await new IdentityService().create({ tenantId, username, password });
  await withTenantTransaction({ tenantId, userId: user.id }, async (tx) => {
    await tx.user.update({ where: { id: user.id, tenantId }, data: { passwordChangeRequired: false } });
    if (!permissions.length) return;
    const role = await tx.role.create({ data: { tenantId, name: "TEST_OWNER", description: "Owner role for isolated integration fixture" } });
    const links = [];
    for (const key of permissions) {
      const permission = await tx.permission.upsert({ where: { tenantId_key: { tenantId, key } }, create: { tenantId, key }, update: {}, select: { id: true } });
      links.push({ tenantId, roleId: role.id, permissionId: permission.id, effect: "ALLOW" });
    }
    await tx.userRole.create({ data: { tenantId, userId: user.id, roleId: role.id } });
    await tx.rolePermission.createMany({ data: links });
  });
  const session = await new AuthenticationService().authenticate(username, password, tenantId);
  return { tenant: { id: tenantId, name, slug }, user, token: session.token, sessionId: session.sessionId };
}

module.exports = { createTestTenant };
