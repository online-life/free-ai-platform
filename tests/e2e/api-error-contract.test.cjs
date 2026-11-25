const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiServer } = require("../../apps/api/dist/apps/api/src/main.js");
const { disconnectDatabase } = require("../../apps/api/dist/apps/api/src/infrastructure/database/prisma.js");
const { createTestTenant } = require("./helpers/identity-fixture.cjs");

// Regression coverage for two audit findings (2026-11-23):
//  1. Client and upstream errors were reported as HTTP 500 "retryable".
//  2. Under a non-superuser database role, FORCE RLS on project_members made
//     project lists empty and project creation fail.
// Run this against a role that is neither SUPERUSER nor BYPASSRLS; otherwise
// PostgreSQL skips RLS and finding 2 is not exercised.
test("API maps client errors to 4xx and project membership works under RLS", {
  skip: !process.env.DATABASE_URL,
}, async (t) => {
  process.env.NODE_ENV = "test";
  const server = createApiServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const serverErrorLogs = [];
  process.stderr.write = (chunk, ...rest) => {
    if (String(chunk).includes("\"api.request_failed\"")) serverErrorLogs.push(String(chunk));
    return stderrWrite(chunk, ...rest);
  };
  t.after(async () => {
    process.stderr.write = stderrWrite;
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
  const password = "Local-Test-Only-Strong-Password-73!";

  async function raw(path, { method = "GET", headers = {}, body } = {}) {
    const response = await fetch(`${base}${path}`, { method, headers, ...(body !== undefined ? { body } : {}) });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: response.status, body: json };
  }

  // Malformed identity material is an authentication failure, never a 500.
  assert.equal((await raw("/api/v1/projects", { headers: { cookie: "freeai_session=not-a-uuid.aaaaaaaaaaaaaaaaaaaaaaaaaaaa" } })).status, 401);
  assert.equal((await raw("/api/v1/projects", { headers: { authorization: "Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaa", "x-tenant-id": "x" } })).status, 401);

  const owner = await createTestTenant({ name: `Errors ${suffix}`, slug: `errors-${suffix}`, username: `own_${suffix.slice(-8)}`, password });
  const auth = { authorization: `Bearer ${owner.token}`, "x-tenant-id": owner.tenant.id };

  const wrongType = await raw("/api/v1/projects", { method: "POST", headers: { ...auth, "content-type": "text/plain" }, body: "{}" });
  assert.equal(wrongType.status, 415);
  assert.equal(wrongType.body.code, "CONTENT_TYPE_JSON_REQUIRED");
  assert.equal(wrongType.body.retryable, false);

  const badJson = await raw("/api/v1/projects", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: "{" });
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body.code, "INVALID_JSON");

  const tooLarge = await raw("/api/v1/projects", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ pad: "x".repeat(1024 * 1024 + 16) }) });
  assert.equal(tooLarge.status, 413);

  const badLimit = await raw("/api/v1/projects?limit=0", { headers: auth });
  assert.equal(badLimit.status, 400);
  assert.equal(badLimit.body.code, "QUERY_LIMIT_INVALID");

  // Project creation, listing and reads must work through RLS. Cross-tenant
  // isolation is covered by api-project-flow.test.cjs.
  const key = `ERR${suffix.slice(-8)}`;
  const created = await raw("/api/v1/projects", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ name: "RLS project", key }) });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const listed = await raw("/api/v1/projects", { headers: auth });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.items.map((item) => item.id), [created.body.id]);
  const read = await raw(`/api/v1/projects/${created.body.id}`, { headers: auth });
  assert.equal(read.status, 200);
  assert.equal(read.body.members.length, 1);
  assert.equal(read.body.members[0].role, "OWNER");

  const duplicate = await raw("/api/v1/projects", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ name: "Duplicate", key }) });
  assert.equal(duplicate.status, 409);

  assert.deepEqual(serverErrorLogs, [], "no request in this test may produce a 5xx");
});
