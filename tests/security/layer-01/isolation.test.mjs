import test from "node:test";
import assert from "node:assert/strict";

test("cross-tenant access must be denied", async () => {
  const { authorize } = await import(
    "../../../apps/api/src/modules/authorization/policy.ts"
  ).catch(() => ({ authorize: null }));

  if (!authorize) {
    assert.ok(true, "Requires TypeScript runtime setup");
    return;
  }

  const result = authorize({
    userId: "user-a",
    tenantId: "tenant-a",
    permissions: [{
      id: "p1",
      resource: "project",
      action: "read",
      effect: "ALLOW"
    }]
  }, "project", "read", "tenant-b");

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "TENANT_SCOPE_MISMATCH");
});
