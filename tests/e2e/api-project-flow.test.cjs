const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { createServer: createMockServer } = require("node:http");
const { createApiServer } = require("../../apps/api/dist/apps/api/src/main.js");
const { disconnectDatabase } = require("../../apps/api/dist/apps/api/src/infrastructure/database/prisma.js");
const { IdentityService } = require("../../apps/api/dist/apps/api/src/modules/identity/identity.service.js");
const { withTenantTransaction } = require("../../apps/api/dist/apps/api/src/infrastructure/database/transaction.js");
const { decryptSecret } = require("../../apps/api/dist/apps/api/src/modules/secrets/encryption.js");
const { AuthenticationService } = require("../../apps/api/dist/apps/api/src/modules/authentication/authentication.service.js");
const { createTestTenant } = require("./helpers/identity-fixture.cjs");

test("project/task CRUD and cross-tenant authorization isolation", {
  skip: !process.env.DATABASE_URL,
}, async (t) => {
  process.env.NODE_ENV = "test";
  process.env.SECRETS_MASTER_KEY = randomBytes(32).toString("base64");
  const server = createApiServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const password = "Local-Test-Only-Strong-Password-49!";

  async function request(path, { method = "GET", body, token, tenantId } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const result = response.status === 204 ? null : await response.json();
    return { status: response.status, body: result };
  }

  const first = await createTestTenant({ name: `Integration ${suffix}`, slug: `integration-${suffix}`, username: `owner_${suffix.slice(-7)}`, password });
  const login = { body: { user: first.user } };
  const auth = { token: first.token, tenantId: first.tenant.id };
  await withTenantTransaction({ tenantId: auth.tenantId, userId: login.body.user.id }, (tx) => tx.globalModelPolicy.update({
    where: { id: 1 },
    data: { customProvidersEnabled: true, localModelsEnabled: true, freeModelsEnabled: true },
  }));

  const project = await request("/api/v1/projects", {
    method: "POST", ...auth,
    body: { name: "Integration Project", key: `E2E${suffix.replace(/\D/g, "").slice(-8)}` },
  });
  assert.equal(project.status, 201, JSON.stringify(project.body));
  const projectList = await request("/api/v1/projects", auth);
  assert.equal(projectList.status, 200);
  assert.ok(projectList.body.items.some((item) => item.id === project.body.id));

  const task = await request(`/api/v1/projects/${project.body.id}/tasks`, {
    method: "POST", ...auth,
    body: { title: "Persist a real task", description: "Created through API against PostgreSQL" },
  });
  assert.equal(task.status, 201, JSON.stringify(task.body));
  const taskList = await request(`/api/v1/projects/${project.body.id}/tasks`, auth);
  assert.equal(taskList.status, 200);
  assert.ok(taskList.body.items.some((item) => item.id === task.body.id));

  const projectGuest = await new IdentityService().create({ tenantId: first.tenant.id, username: `guest_${suffix.slice(-7)}`, password });
  const guestSession = await new AuthenticationService().authenticate(projectGuest.username, password, first.tenant.id);
  const guestAuth = { token: guestSession.token, tenantId: first.tenant.id };
  const guestProjects = await request("/api/v1/projects", guestAuth);
  assert.equal(guestProjects.status, 403, "users without project-read permission are denied server-side");
  const guestProjectAccess = await request(`/api/v1/projects/${project.body.id}`, guestAuth);
  assert.equal(guestProjectAccess.status, 403);

  const agent = await request("/api/v1/agents", {
    method: "POST", ...auth,
    body: { key: `planner-${suffix}`, name: "Project Planner", description: "Project-level task planner", systemInstructions: "Plan only within the authorized project context.", capabilities: ["PLANNING"], allowedTools: [], inputSchema: {}, outputSchema: {}, configuration: {} },
  });
  assert.equal(agent.status, 201, JSON.stringify(agent.body));
  const agentEvaluation = await request(`/api/v1/agents/${agent.body.id}/evaluations`, {
    method: "POST", ...auth,
    body: { version: "1.0.0", testCaseId: "e2e-planning-contract", score: 94, passed: true, durationMs: 12, metrics: { schema_valid: 100 } },
  });
  assert.equal(agentEvaluation.status, 201, JSON.stringify(agentEvaluation.body));
  const activatedAgent = await request(`/api/v1/agents/${agent.body.id}/activate`, {
    method: "POST", ...auth, body: { version: "1.0.0" },
  });
  assert.equal(activatedAgent.status, 200);
  const selectedAgent = await request("/api/v1/agents/select", {
    method: "POST", ...auth, body: { capabilities: ["PLANNING"] },
  });
  assert.equal(selectedAgent.status, 200);
  assert.equal(selectedAgent.body.id, agent.body.id);
  const specialist = await request(`/api/v1/projects/${project.body.id}/specialist`, {
    method: "POST", ...auth,
    body: { objectives: ["Deliver the requested project"], scope: { included: ["Project tasks"], excluded: [] }, constraints: ["Use authorized tools only"], standards: [], technologyStack: [], conventions: {}, language: "en", decisions: [], glossary: {}, risks: [], currentState: "Planning" },
  });
  assert.equal(specialist.status, 201, JSON.stringify(specialist.body));
  const memory = await request(`/api/v1/projects/${project.body.id}/agents/${agent.body.id}/memory`, {
    method: "POST", ...auth, body: { key: "project-goal", value: { goal: "Keep project context isolated" } },
  });
  assert.equal(memory.status, 200, JSON.stringify(memory.body));
  const readMemory = await request(`/api/v1/projects/${project.body.id}/agents/${agent.body.id}/memory`, auth);
  assert.equal(readMemory.status, 200);
  assert.equal(readMemory.body.items.length, 1);

  const workflow = await request(`/api/v1/projects/${project.body.id}/workflows`, {
    method: "POST", ...auth,
    body: { key: `approval-flow-${suffix}`, name: "Approval then wait", version: "1.0.0", steps: [
      { id: "approval", name: "Human approval", type: "APPROVAL", config: {}, dependsOn: [], retryLimit: 0, timeoutMs: 5000 },
      { id: "finish", name: "Persisted completion", type: "WAIT", config: { waitMs: 0 }, dependsOn: ["approval"], retryLimit: 0, timeoutMs: 5000 },
    ] },
  });
  assert.equal(workflow.status, 201, JSON.stringify(workflow.body));
  const activateWorkflow = await request(`/api/v1/projects/${project.body.id}/workflows/${workflow.body.id}/activate`, { method: "POST", ...auth, body: {} });
  assert.equal(activateWorkflow.status, 200, JSON.stringify(activateWorkflow.body));
  const workflowRun = await request(`/api/v1/projects/${project.body.id}/workflow-runs`, {
    method: "POST", ...auth,
    body: { workflowId: workflow.body.id, input: { taskId: task.body.id }, idempotencyKey: `workflow-${suffix}` },
  });
  assert.equal(workflowRun.status, 201, JSON.stringify(workflowRun.body));
  assert.equal(workflowRun.body.status, "WAITING_APPROVAL");
  const pending = await request(`/api/v1/projects/${project.body.id}/workflow-runs/${workflowRun.body.runId}/approvals`, auth);
  assert.equal(pending.status, 200);
  assert.equal(pending.body.items.length, 1);
  const approved = await request(`/api/v1/projects/${project.body.id}/workflow-approvals/${pending.body.items[0].id}`, {
    method: "POST", ...auth, body: { decision: "APPROVED", comment: "Approved in local integration test" },
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  const resumed = await request(`/api/v1/projects/${project.body.id}/workflow-runs/${workflowRun.body.runId}/resume`, { method: "POST", ...auth, body: {} });
  assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
  assert.equal(resumed.body.status, "SUCCEEDED");
  const persistedRun = await request(`/api/v1/projects/${project.body.id}/workflow-runs/${workflowRun.body.runId}`, auth);
  assert.equal(persistedRun.status, 200);
  assert.ok(persistedRun.body.traces.some((event) => event.event === "APPROVAL_APPROVED"));

  const provider = await request("/api/v1/providers", {
    method: "POST", ...auth,
    body: { key: `local-${suffix}`, name: "Local test endpoint", providerType: "LOCAL_OPENAI_COMPATIBLE", baseUrl: "http://127.0.0.1:9", authenticationType: "NONE", billingMode: "SELF_HOSTED", freeTierStatus: "UNKNOWN", timeoutMs: 1000, maxRetries: 0, customHeaders: {}, metadata: {}, pricingMetadata: {}, privacyMetadata: {} },
  });
  assert.equal(provider.status, 201, JSON.stringify(provider.body));
  assert.equal(provider.body.enabled, false);
  assert.ok(!JSON.stringify(provider.body).includes("credentialId"));
  const configuredModel = await request(`/api/v1/providers/${provider.body.id}/models`, {
    method: "POST", ...auth,
    body: { modelId: "local-test-model", displayName: "Local Test Model", capabilities: ["TEXT_GENERATION"], billingMode: "SELF_HOSTED", freeTierStatus: "UNKNOWN", privacyApproved: true },
  });
  assert.equal(configuredModel.status, 201, JSON.stringify(configuredModel.body));
  assert.equal(configuredModel.body.enabled, false);
  const providerList = await request("/api/v1/providers", auth);
  assert.ok(providerList.body.items.some((item) => item.id === provider.body.id));
  const modelList = await request("/api/v1/providers", auth);
  assert.ok(!JSON.stringify(modelList.body).includes("freeai_test_only"));

  const testCredential = "e2e-only-never-sent-provider-secret";
  const mockProvider = createMockServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${testCredential}`) {
      response.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (request.method === "GET" && request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "mock-free-model" }] }));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const completion = JSON.parse(body);
      if (completion.model !== "mock-free-model") {
        response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "wrong model" }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: "local-mock-response", choices: [{ message: { content: "Mock execution output" }, finish_reason: "stop" }], usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 } }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "not found" }));
  });
  await new Promise((resolve, reject) => { mockProvider.once("error", reject); mockProvider.listen(0, "127.0.0.1", resolve); });
  t.after(async () => new Promise((resolve) => mockProvider.close(resolve)));
  const mockAddress = mockProvider.address();
  assert.ok(mockAddress && typeof mockAddress !== "string");
  const credentialProvider = await request("/api/v1/providers", {
    method: "POST", ...auth,
    body: { key: `credential-${suffix}`, name: "Local mocked OpenAI-compatible server", providerType: "LOCAL_OPENAI_COMPATIBLE", baseUrl: `http://127.0.0.1:${mockAddress.port}/v1`, authenticationType: "BEARER", apiKey: testCredential, billingMode: "UNKNOWN", freeTierStatus: "UNKNOWN", timeoutMs: 1000, maxRetries: 0, customHeaders: {}, metadata: {}, pricingMetadata: {}, privacyMetadata: {} },
  });
  assert.equal(credentialProvider.status, 201, JSON.stringify(credentialProvider.body));
  const providerTest = await request(`/api/v1/providers/${credentialProvider.body.id}/test-connection`, { method: "POST", ...auth, body: {} });
  assert.equal(providerTest.status, 200, JSON.stringify(providerTest.body));
  assert.equal(providerTest.body.available, true);
  assert.equal(providerTest.body.discoveredModels, 1);
  const discovered = await request(`/api/v1/providers/${credentialProvider.body.id}/models`, auth);
  assert.equal(discovered.body.items.length, 1);
  assert.equal(discovered.body.items[0].modelId, "mock-free-model");
  assert.equal(discovered.body.items[0].enabled, false);
  assert.equal(discovered.body.items[0].billingMode, "UNKNOWN");
  const providerClassified = await request(`/api/v1/providers/${credentialProvider.body.id}`, {
    method: "PATCH", ...auth, body: { billingMode: "FREE", freeTierStatus: "VERIFIED_FREE" },
  });
  assert.equal(providerClassified.status, 200);
  const classifiedConnection = await request(`/api/v1/providers/${credentialProvider.body.id}/test-connection`, { method: "POST", ...auth, body: {} });
  assert.equal(classifiedConnection.body.available, true);
  const providerEnabled = await request(`/api/v1/providers/${credentialProvider.body.id}/enable`, { method: "POST", ...auth, body: {} });
  assert.equal(providerEnabled.status, 200, JSON.stringify(providerEnabled.body));
  const verifiedModel = await request(`/api/v1/providers/${credentialProvider.body.id}/models`, {
    method: "POST", ...auth,
    body: { modelId: "mock-free-model", displayName: "Mock Free Model", capabilities: ["TEXT_GENERATION"], billingMode: "FREE", freeTierStatus: "VERIFIED_FREE", inputPricePerMillion: 0, outputPricePerMillion: 0, contextWindow: 4096, maxOutputTokens: 1024, privacyApproved: true, officialDocumentationUrl: "https://example.test/model-pricing" },
  });
  assert.equal(verifiedModel.status, 201, JSON.stringify(verifiedModel.body));
  const modelEnabled = await request(`/api/v1/providers/${credentialProvider.body.id}/models/mock-free-model/enable`, { method: "POST", ...auth, body: {} });
  assert.equal(modelEnabled.status, 200, JSON.stringify(modelEnabled.body));
  const workspaceModelPolicy = await request("/api/v1/model-policies", {
    method: "PUT", ...auth, body: { freeModelsEnabled: true, paidModelsEnabled: false },
  });
  assert.equal(workspaceModelPolicy.status, 200);
  const selectableModels = await request("/api/v1/models", auth);
  assert.ok(selectableModels.body.items.some((model) => model.key === "mock-free-model"));
  const freeRoute = await request("/api/v1/models/route-preview", {
    method: "POST", ...auth, body: { selection: { capabilities: ["TEXT_GENERATION"], requireFree: true } },
  });
  assert.equal(freeRoute.status, 200, JSON.stringify(freeRoute.body));
  assert.equal(freeRoute.body.modelKey, "mock-free-model");
  const viewerExecution = await request(`/api/v1/projects/${project.body.id}/ai/execute`, {
    method: "POST", ...guestAuth,
    body: { selection: { capabilities: ["TEXT_GENERATION"] }, operation: "CHAT", messages: [{ role: "user", content: "hello" }], parameters: {}, requestId: `denied-${suffix}` },
  });
  assert.equal(viewerExecution.status, 403);
  const localExecution = await request(`/api/v1/projects/${project.body.id}/ai/execute`, {
    method: "POST", ...auth,
    body: { selection: { capabilities: ["TEXT_GENERATION"], requireFree: false }, operation: "CHAT", messages: [{ role: "user", content: "hello" }], parameters: {}, requestId: `local-execution-${suffix}` },
  });
  assert.equal(localExecution.status, 200, JSON.stringify(localExecution.body));
  assert.equal(localExecution.body.output, "Mock execution output");
  assert.deepEqual(localExecution.body.usage, { inputTokens: 4, outputTokens: 3, totalTokens: 7 });
  const hiddenModel = await request(`/api/v1/providers/${credentialProvider.body.id}/models/mock-free-model/hide`, { method: "POST", ...auth, body: {} });
  assert.equal(hiddenModel.status, 200);
  assert.equal(hiddenModel.body.visible, false);
  const specificallyHidden = await request("/api/v1/models", auth);
  assert.ok(!specificallyHidden.body.items.some((model) => model.key === "mock-free-model"));
  const shownModel = await request(`/api/v1/providers/${credentialProvider.body.id}/models/mock-free-model/show`, { method: "POST", ...auth, body: {} });
  assert.equal(shownModel.status, 200);
  assert.equal(shownModel.body.visible, true);
  await request("/api/v1/model-policies", { method: "PUT", ...auth, body: { freeModelsEnabled: false, paidModelsEnabled: false } });
  const hiddenModels = await request("/api/v1/models", auth);
  assert.ok(!hiddenModels.body.items.some((model) => model.key === "mock-free-model"));
  const preservedAdminModels = await request(`/api/v1/providers/${credentialProvider.body.id}/models`, auth);
  assert.ok(preservedAdminModels.body.items.some((model) => model.modelId === "mock-free-model"));
  assert.ok(!JSON.stringify(credentialProvider.body).includes(testCredential));
  const encryptedCredential = await withTenantTransaction({ tenantId: auth.tenantId, userId: login.body.user.id }, (tx) => tx.providerCredential.findFirst({ where: { tenantId: auth.tenantId, name: `provider:credential-${suffix}` } }));
  assert.ok(encryptedCredential);
  assert.notEqual(encryptedCredential.ciphertext, testCredential);
  assert.equal(decryptSecret(encryptedCredential), testCredential);
  assert.ok(!JSON.stringify((await request("/api/v1/providers", auth)).body).includes(testCredential));
  const unroutable = await request("/api/v1/models/route-preview", {
    method: "POST", ...auth,
    body: { selection: { capabilities: ["TEXT_GENERATION"], requireFree: true, requirePrivacyApproved: true } },
  });
  assert.equal(unroutable.status, 409);

  const pairing = await request("/api/v1/runtime/pairings", {
    method: "POST", ...auth, body: {},
  });
  assert.equal(pairing.status, 201, JSON.stringify(pairing.body));
  assert.ok(pairing.body.pairingCode.length >= 40);
  const enrolled = await request("/api/v1/runtime/enroll", {
    method: "POST",
    body: { pairingCode: pairing.body.pairingCode, name: "E2E Local Runtime", operatingSystem: "linux", architecture: "x64", runtimeVersion: "0.1.0" },
  });
  assert.equal(enrolled.status, 201, JSON.stringify(enrolled.body));
  assert.ok(enrolled.body.token.length >= 40);
  const runtimeAuth = { token: enrolled.body.token, tenantId: auth.tenantId };
  const storedDeviceCredential = await withTenantTransaction({ tenantId: auth.tenantId, userId: login.body.user.id }, (tx) => tx.runtimeDevice.findFirst({ where: { id: enrolled.body.deviceId } }));
  assert.ok(storedDeviceCredential);
  assert.notEqual(storedDeviceCredential.tokenHash, enrolled.body.token);
  const deviceProjectGrant = await request(`/api/v1/runtime/devices/${enrolled.body.deviceId}/projects/${project.body.id}/grant`, { method: "POST", ...auth, body: {} });
  assert.equal(deviceProjectGrant.status, 200, JSON.stringify(deviceProjectGrant.body));
  const localWorkspace = await request("/api/v1/runtime/workspaces", {
    method: "POST", ...auth,
    body: { deviceId: enrolled.body.deviceId, projectId: project.body.id, name: "Project workspace", rootAlias: "project-a", workspaceKey: randomBytes(24).toString("base64url"), canRead: true, canWrite: true, canDelete: false },
  });
  assert.equal(localWorkspace.status, 201, JSON.stringify(localWorkspace.body));
  const runtimeHeartbeat = await request("/api/v1/runtime/heartbeat", {
    method: "POST", ...runtimeAuth, body: { runtimeVersion: "0.1.0", health: "healthy", activeJobIds: [] },
  });
  assert.equal(runtimeHeartbeat.status, 200, JSON.stringify(runtimeHeartbeat.body));
  assert.equal((await request("/api/v1/runtime/devices", auth)).body.items.find((item) => item.id === enrolled.body.deviceId).connectionStatus, "ONLINE");
  const runtimeJob = await request("/api/v1/runtime/jobs", {
    method: "POST", ...auth,
    body: { deviceId: enrolled.body.deviceId, projectId: project.body.id, workspaceId: localWorkspace.body.id, kind: "WORKSPACE_LIST", payload: {}, idempotencyKey: `runtime-job-${suffix}` },
  });
  assert.equal(runtimeJob.status, 201, JSON.stringify(runtimeJob.body));
  const dispatched = await request("/api/v1/runtime/heartbeat", {
    method: "POST", ...runtimeAuth, body: { runtimeVersion: "0.1.0", health: "healthy", activeJobIds: [] },
  });
  assert.equal(dispatched.body.jobs[0].id, runtimeJob.body.id);
  assert.equal(dispatched.body.jobs[0].payload.workspaceBinding.rootAlias, "project-a");
  assert.equal(dispatched.body.jobs[0].payload.workspaceBinding.workspaceKey, (await withTenantTransaction({ tenantId: auth.tenantId, userId: login.body.user.id }, (tx) => tx.localRuntimeWorkspace.findUnique({ where: { id: localWorkspace.body.id }, select: { workspaceKey: true } }))).workspaceKey);
  assert.deepEqual(dispatched.body.jobs[0].payload.workspaceBinding && Object.fromEntries(Object.entries(dispatched.body.jobs[0].payload.workspaceBinding).filter(([key]) => key.startsWith("can"))), { canRead: true, canWrite: true, canDelete: false, canExecute: false });
  assert.deepEqual(dispatched.body.jobs[0].payload.operation, {});
  const jobDone = await request(`/api/v1/runtime/jobs/${runtimeJob.body.id}/status`, { method: "POST", ...runtimeAuth, body: { status: "SUCCEEDED", result: { entries: [] } } });
  assert.equal(jobDone.status, 200, JSON.stringify(jobDone.body));

  const cancelledJob = await request("/api/v1/runtime/jobs", {
    method: "POST", ...auth,
    body: { deviceId: enrolled.body.deviceId, projectId: project.body.id, workspaceId: localWorkspace.body.id, kind: "WORKSPACE_LIST", payload: {}, idempotencyKey: `runtime-cancel-${suffix}` },
  });
  assert.equal(cancelledJob.status, 201, JSON.stringify(cancelledJob.body));
  const cancelRequested = await request(`/api/v1/runtime/jobs/${cancelledJob.body.id}/cancel`, { method: "POST", ...auth, body: {} });
  assert.equal(cancelRequested.body.status, "CANCELLED");
  const cancellationPoll = await request("/api/v1/runtime/heartbeat", { method: "POST", ...runtimeAuth, body: { runtimeVersion: "0.1.0", health: "healthy", activeJobIds: [cancelledJob.body.id] } });
  assert.ok(!cancellationPoll.body.cancelJobIds.includes(cancelledJob.body.id));
  const revoked = await request(`/api/v1/runtime/devices/${enrolled.body.deviceId}/revoke`, { method: "POST", ...auth, body: {} });
  assert.equal(revoked.body.status, "REVOKED");
  const rejectedHeartbeat = await request("/api/v1/runtime/heartbeat", { method: "POST", ...runtimeAuth, body: { runtimeVersion: "0.1.0", health: "healthy", activeJobIds: [] } });
  assert.equal(rejectedHeartbeat.status, 401);
  assert.equal((await request("/api/v1/runtime/logs", auth)).body.items.some((item) => item.event === "DEVICE_REVOKED"), true);

  const second = await createTestTenant({ name: `Other ${suffix}`, slug: `other-${suffix}`, username: `other_${suffix.slice(-7)}`, password });
  const denied = await request(`/api/v1/projects/${project.body.id}`, {
    token: second.token, tenantId: second.tenant.id,
  });
  assert.equal(denied.status, 403);

  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.checks.database, true);
  const loggedOut = await request("/api/v1/auth/logout", { method: "POST", ...auth, body: {} });
  assert.equal(loggedOut.status, 204);
  const revokedSession = await request("/api/v1/auth/me", auth);
  assert.equal(revokedSession.status, 401);
  const unauthenticatedProviders = await request("/api/v1/providers");
  assert.equal(unauthenticatedProviders.status, 401);
  t.diagnostic("Verified tenant/project authorization isolation, project/task persistence, agent version/evaluation/activation/selection, specialist profile, project-isolated memory, encrypted provider configuration, local model discovery/classification/enablement/visibility, project-authorized model execution through the central router/gateway, runtime pairing/token hashing/project grants/workspace metadata/heartbeat/job dispatch/cancellation/revocation, and health against PostgreSQL.");
});
