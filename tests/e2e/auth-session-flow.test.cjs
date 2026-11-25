const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { createApiServer } = require("../../apps/api/dist/apps/api/src/main.js");
const { disconnectDatabase } = require("../../apps/api/dist/apps/api/src/infrastructure/database/prisma.js");
const { withTenantTransaction } = require("../../apps/api/dist/apps/api/src/infrastructure/database/transaction.js");

const origin = "http://127.0.0.1:4173";

test("cookie authentication, forced password change, owner user administration, lockout, and revocation", {
  skip: !process.env.DATABASE_URL,
  timeout: 90_000,
}, async (t) => {
  process.env.NODE_ENV = "production";
  process.env.WEB_ORIGIN = origin;
  process.env.BOOTSTRAP_TOKEN = randomBytes(32).toString("base64url");
  process.env.SECRETS_MASTER_KEY = randomBytes(32).toString("base64");
  const api = createApiServer();
  await new Promise((resolve, reject) => { api.once("error", reject); api.listen(0, "127.0.0.1", resolve); });
  t.after(async () => { await new Promise((resolve) => api.close(resolve)); await disconnectDatabase(); });
  const address = api.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  function cookieHeader(setCookies) {
    return (setCookies || []).map((cookie) => cookie.split(";", 1)[0]).join("; ");
  }
  async function request(path, { method = "GET", body, cookies = "", csrf, sendOrigin = true, originValue = origin } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(sendOrigin ? { origin: originValue } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookies ? { cookie: cookies } : {}),
        ...(csrf ? { "x-csrf-token": csrf } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const result = response.status === 204 ? null : await response.json().catch(() => null);
    return { response, body: result, cookies: response.headers.getSetCookie?.() || [] };
  }
  async function issueCsrf(cookies = "") {
    const result = await request("/api/v1/auth/csrf", { cookies });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    return { csrf: result.body.csrfToken, cookies: cookieHeader(result.cookies) };
  }
  async function login(tenantId, username, password, csrfState) {
    const result = await request("/api/v1/auth/login", { method: "POST", cookies: csrfState.cookies, csrf: csrfState.csrf, body: { tenantId, username, password } });
    return { ...result, setCookies: result.cookies, cookies: cookieHeader(result.cookies) };
  }

  const anonymousCsrf = await issueCsrf();
  const publicSettings = await request("/api/v1/public/site");
  assert.equal(publicSettings.response.status, 200, "public site configuration is intentionally public");
  // The settings row is a platform-wide singleton, so a previous run against the
  // same database may have saved content. Assert only that the anonymous
  // response is a plain object exposing whitelisted public fields.
  const publicFieldNames = new Set(["platformName", "platformDescription", "contactDescription", "contactEmail", "contactUrl", "supportUrl", "footerText", "socialLinks", "pageContent"]);
  assert.ok(publicSettings.body && typeof publicSettings.body === "object" && !Array.isArray(publicSettings.body));
  assert.deepEqual(Object.keys(publicSettings.body).filter((key) => !publicFieldNames.has(key)), []);
  const anonymousAdminSettings = await request("/api/v1/admin/public-site");
  assert.equal(anonymousAdminSettings.response.status, 401, "public website editor must reject anonymous access");
  const missingCsrf = await request("/api/v1/auth/login", { method: "POST", body: { tenantId: "00000000-0000-4000-8000-000000000000", username: "nobody", password: "bad" } });
  assert.equal(missingCsrf.response.status, 403);
  assert.equal(missingCsrf.body.code, "CSRF_VALIDATION_FAILED");
  const crossOrigin = await request("/api/v1/auth/login", { method: "POST", body: { tenantId: "00000000-0000-4000-8000-000000000000", username: "nobody", password: "bad" }, originValue: "https://evil.example" });
  assert.equal(crossOrigin.response.status, 403);
  assert.equal(crossOrigin.body.code, "CSRF_ORIGIN_REJECTED");
  const bootstrap = await request("/api/v1/auth/bootstrap", {
    method: "POST", cookies: anonymousCsrf.cookies, csrf: anonymousCsrf.csrf,
    body: { bootstrapToken: process.env.BOOTSTRAP_TOKEN, tenantName: "Auth Test", tenantSlug: `auth-${randomBytes(5).toString("hex")}` },
  });
  assert.equal(bootstrap.response.status, 201, JSON.stringify(bootstrap.body));
  const tenantId = bootstrap.body.tenant.id;
  const owner = bootstrap.body.credentials;
  assert.match(owner.username, /^owner-[0-9a-f]{18}$/);
  assert.equal(typeof owner.password, "string");
  assert.equal(bootstrap.body.user.passwordHash, undefined);
  assert.equal(bootstrap.body.token, undefined);
  assert.equal(bootstrap.cookies.length, 0, "bootstrap must not create an implicit session");
  const bootstrapReplay = await request("/api/v1/auth/bootstrap", {
    method: "POST", cookies: anonymousCsrf.cookies, csrf: anonymousCsrf.csrf,
    body: { bootstrapToken: process.env.BOOTSTRAP_TOKEN, tenantName: "Replay", tenantSlug: `replay-${randomBytes(5).toString("hex")}` },
  });
  assert.equal(bootstrapReplay.response.status, 409);

  const loginCsrf = await issueCsrf();
  const ownerLogin = await login(tenantId, owner.username, owner.password, loginCsrf);
  assert.equal(ownerLogin.response.status, 200, JSON.stringify(ownerLogin.body));
  assert.equal(ownerLogin.body.token, undefined, "session token must not be returned in JSON");
  assert.equal(ownerLogin.body.mustChangePassword, true);
  assert.match(ownerLogin.setCookies.find((cookie) => cookie.startsWith("freeai_session=")) || "", /HttpOnly/);
  assert.match(ownerLogin.setCookies.join(" "), /SameSite=Strict/);
  assert.match(ownerLogin.setCookies.join(" "), /Secure/);
  assert.ok(ownerLogin.setCookies.some((cookie) => cookie.startsWith("freeai_csrf=")));
  const ownerSession = await issueCsrf(ownerLogin.cookies);
  const ownerMe = await request("/api/v1/auth/me", { cookies: ownerSession.cookies });
  assert.equal(ownerMe.response.status, 200);
  assert.equal(ownerMe.body.mustChangePassword, true);
  const blocked = await request("/api/v1/admin/users", { cookies: ownerSession.cookies });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");

  const passwordChange = await request("/api/v1/auth/password", {
    method: "POST", cookies: ownerSession.cookies, csrf: ownerSession.csrf,
    body: { newPassword: "Owner-New-Password-Only-2026!" },
  });
  assert.equal(passwordChange.response.status, 200, JSON.stringify(passwordChange.body));
  assert.equal(passwordChange.body.mustChangePassword, false);
  const ownerAuth = { cookies: cookieHeader(passwordChange.cookies), csrf: passwordChange.body.csrfToken };
  assert.notEqual(ownerAuth.cookies.split(";")[0], ownerSession.cookies.split(";")[0], "password change must rotate the session cookie");
  assert.equal((await request("/api/v1/auth/me", { cookies: ownerSession.cookies })).response.status, 401, "password change must revoke the old session");
  const usersBefore = await request("/api/v1/admin/users", { cookies: ownerAuth.cookies });
  assert.equal(usersBefore.response.status, 200, JSON.stringify(usersBefore.body));
  const ownerRecord = usersBefore.body.items[0];
  assert.equal(ownerRecord.passwordChangeRequired, false);
  const publicConfig = {
    platformName: "Free AI Platform Test",
    platformDescription: "Owner configured public description.",
    contactDescription: "Contact the deployment owner.",
    contactEmail: "support@example.test",
    contactUrl: "https://example.test/contact",
    supportUrl: "",
    footerText: "Configured footer.",
    socialLinks: [{ label: "Community", url: "https://example.test/community" }],
    pageContent: { terms: "Configured terms.", privacy: "Configured privacy." },
  };
  const savedPublicConfig = await request("/api/v1/admin/public-site", { method: "PUT", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: publicConfig });
  assert.equal(savedPublicConfig.response.status, 200, JSON.stringify(savedPublicConfig.body));
  const readPublicConfig = await request("/api/v1/public/site");
  assert.deepEqual(readPublicConfig.body, publicConfig, "public settings are persisted and only intended public values are returned");

  const created = await request("/api/v1/admin/users", { method: "POST", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: {} });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.user.passwordChangeRequired, undefined);
  assert.match(created.body.credentials.username, /^user-[0-9a-f]{18}$/);
  const user = created.body.credentials;
  const firstUserList = await request("/api/v1/admin/users", { cookies: ownerAuth.cookies });
  const listedTemporaryUser = firstUserList.body.items.find((item) => item.username === user.username);
  assert.equal(listedTemporaryUser.passwordChangeRequired, true);
  assert.deepEqual(listedTemporaryUser.roles, [], "new accounts have no permissions by default");
  const userLoginCsrf = await issueCsrf();
  const userLogin = await login(tenantId, user.username, user.password, userLoginCsrf);
  assert.equal(userLogin.response.status, 200);
  assert.equal(userLogin.body.mustChangePassword, true);
  const userAuth = await issueCsrf(userLogin.cookies);
  const userChange = await request("/api/v1/auth/password", { method: "POST", cookies: userAuth.cookies, csrf: userAuth.csrf, body: { newPassword: "User-New-Password-Only-2026!" } });
  assert.equal(userChange.response.status, 200, JSON.stringify(userChange.body));
  const userSessionCookies = cookieHeader(userChange.cookies);
  const deniedAdmin = await request("/api/v1/admin/users", { cookies: userSessionCookies });
  assert.equal(deniedAdmin.response.status, 403, JSON.stringify(deniedAdmin.body));
  assert.equal(deniedAdmin.body.code, "FORBIDDEN");
  const deniedPublicConfigEdit = await request("/api/v1/admin/public-site", { method: "PUT", cookies: userSessionCookies, csrf: userChange.body.csrfToken, body: publicConfig });
  assert.equal(deniedPublicConfigEdit.response.status, 403, "workspace users cannot change platform public settings");

  const roleCreated = await request("/api/v1/admin/roles", { method: "POST", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: { name: "Project Reader", permissions: [{ key: "project.read", effect: "ALLOW" }] } });
  assert.equal(roleCreated.response.status, 201, JSON.stringify(roleCreated.body));
  const roleAssignment = await request(`/api/v1/admin/users/${userLogin.body.user.id}/roles`, { method: "PUT", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: { roleIds: [roleCreated.body.role.id] } });
  assert.equal(roleAssignment.response.status, 200);
  assert.deepEqual(roleAssignment.body.roleIds, [roleCreated.body.role.id]);

  const postRoleLoginCsrf = await issueCsrf();
  const postRoleLogin = await login(tenantId, user.username, "User-New-Password-Only-2026!", postRoleLoginCsrf);
  assert.equal(postRoleLogin.response.status, 200);
  assert.equal(postRoleLogin.body.mustChangePassword, false);
  const activeUserSession = await issueCsrf(postRoleLogin.cookies);

  const sessions = await request("/api/v1/admin/sessions", { cookies: ownerAuth.cookies });
  assert.equal(sessions.response.status, 200);
  const userSession = sessions.body.items.find((item) => item.user.username === user.username);
  assert.ok(userSession);
  const revoked = await request(`/api/v1/admin/sessions/${userSession.id}/revoke`, { method: "POST", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: {} });
  assert.equal(revoked.response.status, 200);
  const staleUserSession = await request("/api/v1/auth/me", { cookies: activeUserSession.cookies });
  assert.equal(staleUserSession.response.status, 401);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const csrfState = await issueCsrf();
    const failed = await login(tenantId, user.username, "wrong-password", csrfState);
    assert.equal(failed.response.status, 401);
  }
  const lockedLoginCsrf = await issueCsrf();
  const lockedLogin = await login(tenantId, user.username, user.password, lockedLoginCsrf);
  assert.equal(lockedLogin.response.status, 401);
  const unlocked = await request(`/api/v1/admin/users/${userLogin.body.user.id}/unlock`, { method: "POST", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: {} });
  assert.equal(unlocked.response.status, 200);

  const reset = await request(`/api/v1/admin/users/${userLogin.body.user.id}/password-reset`, { method: "POST", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: {} });
  assert.equal(reset.response.status, 200);
  assert.equal(typeof reset.body.credentials.password, "string");
  const renamed = `renamed-${randomBytes(4).toString("hex")}`;
  const usernameUpdate = await request(`/api/v1/admin/users/${userLogin.body.user.id}/username`, { method: "PATCH", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: { username: renamed } });
  assert.equal(usernameUpdate.response.status, 200);
  const renamedCsrf = await issueCsrf();
  const renamedLogin = await login(tenantId, renamed, reset.body.credentials.password, renamedCsrf);
  assert.equal(renamedLogin.response.status, 200);
  assert.equal(renamedLogin.body.mustChangePassword, true);

  const disable = await request(`/api/v1/admin/users/${userLogin.body.user.id}/disable`, { method: "POST", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: {} });
  assert.equal(disable.response.status, 200);
  const disabledLoginCsrf = await issueCsrf();
  const disabledLogin = await login(tenantId, renamed, reset.body.credentials.password, disabledLoginCsrf);
  assert.equal(disabledLogin.response.status, 401);

  const auditRows = await withTenantTransaction({ tenantId, userId: ownerRecord.id }, (tx) => tx.auditLog.findMany({ where: { tenantId }, select: { action: true } }));
  const auditActions = new Set(auditRows.map((row) => row.action));
  for (const action of ["IDENTITY_OWNER_BOOTSTRAPPED", "AUTH_LOGIN_SUCCEEDED", "AUTH_PASSWORD_CHANGED", "IDENTITY_USER_CREATED", "AUTH_SESSION_ADMIN_REVOKED", "AUTH_ACCOUNT_LOCKED", "IDENTITY_ACCOUNT_UNLOCKED", "IDENTITY_USER_DISABLED", "PUBLIC_SITE_SETTINGS_UPDATED"]) assert.ok(auditActions.has(action), `missing audit action ${action}`);

  const logout = await request("/api/v1/auth/logout", { method: "POST", cookies: ownerAuth.cookies, csrf: ownerAuth.csrf, body: {} });
  assert.equal(logout.response.status, 204);
  assert.ok(logout.cookies.some((cookie) => /freeai_session=;/.test(cookie)));
  const loggedOut = await request("/api/v1/auth/me", { cookies: ownerAuth.cookies });
  assert.equal(loggedOut.response.status, 401);
});
