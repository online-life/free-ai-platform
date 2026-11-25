import { providerIdentityRegistry, providerIdentity, providerMark } from "./provider-identity.js";

const pages = ["dashboard", "projects", "agents", "models", "providers", "routing", "executions", "devices", "workspaces", "workflows", "monitoring", "users", "roles", "sessions", "settings"];
const publicPageData = {
  home: { title: "Free AI Platform", description: "A self-hosted control plane for AI projects, providers, models, agents, workflows, and local execution.", eyebrow: "SELF-HOSTED AI OPERATIONS", heading: "Build your AI workspace on your terms.", body: "Free AI Platform brings project coordination, model policy, provider connections, agent definitions, workflow orchestration, and runtime operations into one self-hosted workspace.", cards: [["Projects and tasks", "Organize requests, tasks, decisions, and deliverables within project boundaries."], ["Models and providers", "Review connection health, capabilities, privacy, and pricing policy before use."], ["Agents and workflows", "Manage versioned agents and workflow runs with explicit permissions and approvals."], ["Local runtime", "Connect runtime devices for isolated execution paths managed by platform policy."]] },
  about: { title: "About", description: "Learn about the architecture and goals of Free AI Platform.", eyebrow: "ABOUT THE PLATFORM", heading: "A control plane for AI work", body: "Free AI Platform is a self-hosted, general-purpose AI operations platform. It is designed around a modular control plane and a separately bounded execution plane, with project isolation and centralized provider access." },
  features: { title: "Features", description: "Explore project, model, provider, agent, workflow, and runtime capabilities.", eyebrow: "CAPABILITIES", heading: "A connected operating surface", body: "The platform groups operational controls that are often spread across separate tools. Features are backed by APIs and policies; availability depends on the configured deployment.", cards: [["Project workspace", "Track project context, tasks, and execution history."], ["Provider gateway", "Route eligible requests through configured provider adapters."], ["Agent registry", "Version agent definitions, capabilities, and evaluations."], ["Workflow operations", "Create and run persisted workflows with approval steps."], ["Runtime controls", "Manage paired devices, workspaces, and authorized jobs."], ["Security administration", "Manage users, roles, sessions, and security records."]] },
  platform: { title: "Platform Modules", description: "Understand the modules and boundaries in Free AI Platform.", eyebrow: "PLATFORM MODULES", heading: "Clear responsibilities across the platform", body: "The modular monolith separates identity, projects, model metadata, provider communication, execution, and orchestration. Provider traffic passes through the gateway; untrusted execution is intended for the Runtime boundary.", cards: [["Identity and access", "Tenant-scoped users, roles, permissions, and server-managed sessions."], ["Project and task management", "Project context, task ownership, and work records."], ["Model intelligence", "Catalog metadata, availability, capability, and pricing classification."], ["Provider gateway", "Connector lifecycle and unified requests."], ["Execution engine", "Runtime job lifecycle, workspace controls, output capture, and cleanup."], ["Workflow orchestration", "Persisted runs, state transitions, and approval handling."]] },
  providers: { title: "AI Providers", description: "Review supported provider connection types without implying a configured connection.", eyebrow: "PROVIDER CONNECTIONS", heading: "Connect through explicit adapters", body: "The current API registry supports OpenAI-compatible endpoints and local OpenAI-compatible servers. These are connector types; a configured connection, provider brand, account, model catalog, and pricing status are separate facts.", providerCards: true },
  models: { title: "Models", description: "Learn how model discovery, pricing classification, and availability work.", eyebrow: "MODEL CATALOG", heading: "Discovery is not approval", body: "Model metadata is reviewed separately from provider health. The platform represents verified free, limited, self-hosted, paid, and unknown classifications. Unknown pricing is never presented as free, and discovered models are not automatically activated." },
  pricing: { title: "Pricing and Plans", description: "Understand software, hosting, and provider usage costs for a self-hosted deployment.", eyebrow: "COST POLICY", heading: "Your deployment determines operating costs", body: "Free AI Platform is self-hosted software. This site does not publish a commercial subscription price. Hosting, storage, network use, and external provider inference may incur costs. Model pricing is classified per model; unknown pricing remains unknown, and paid execution requires explicit platform authorization." },
  contact: { title: "Contact", description: "Contact information configured by this platform owner.", eyebrow: "CONTACT", heading: "Get in touch", body: "Contact methods shown here are configured by the platform owner. No contact details are published until configured." },
  documentation: { title: "Documentation", description: "Find installation, operations, security, and provider configuration guidance.", eyebrow: "DOCUMENTATION", heading: "Operate with clear guidance", body: "Deployment documentation is maintained with the source distribution. Use the guides for installation, provider policy, Runtime operations, backup, recovery, and known limitations. A deployment owner should confirm documentation matches the installed release.", cards: [["Installation and upgrades", "Review prerequisites, configuration, migrations, and source package limitations."], ["Provider setup", "Configure credentials through the authenticated workspace and verify pricing and privacy."], ["Security model", "Understand session, tenant, provider, and Runtime boundaries."], ["Operations", "Review health, backups, restore safeguards, and troubleshooting guidance."]] },
  faq: { title: "FAQ", description: "Answers about deployment, provider connections, model costs, and account access.", eyebrow: "FREQUENTLY ASKED QUESTIONS", heading: "Common questions", faqs: [["Is this a hosted SaaS account?", "No. Free AI Platform is designed to be installed and operated by the deployment owner."], ["Can visitors create accounts?", "No. Public self-registration is disabled. An authorized owner provisions workspace users."], ["Are all listed models free?", "No. Availability and pricing are separate. Unknown pricing is not classified as free."], ["Does connecting a provider make requests?", "Saving credentials does not make an inference request. Connection tests and inference are separate operations; verify the configured provider's cost and behavior before use."], ["Where is project data sent?", "Project data remains within the configured platform until a user invokes a provider or runtime operation. Review the selected provider's data terms before sending content."]] },
  terms: { title: "Terms of Service", description: "Terms for using a Free AI Platform installation.", eyebrow: "TERMS OF SERVICE", heading: "Use of this installation", body: "Free AI Platform is self-hosted software operated by the deployment owner. The owner is responsible for access control, lawful configuration, backups, retention, and the providers or runtime devices connected to this installation. Users must use only projects, tools, models, and data they are authorized to access. External providers may apply separate terms, availability limits, and charges. Do not submit data unless you are authorized and have reviewed the applicable data handling terms. The platform is provided as software under its applicable source license; this page does not replace that license or create a service-level commitment. The deployment owner should obtain legal review for the jurisdiction and use case in which the installation operates." },
  privacy: { title: "Privacy Policy", description: "Privacy information for a self-hosted Free AI Platform deployment.", eyebrow: "PRIVACY", heading: "Data handling depends on deployment", body: "The deployment owner controls the platform database, backups, logs, retention, and access. Account credentials are stored as password hashes and browser sessions are managed by the server. Provider credentials are configured in the authenticated workspace and are intended to remain server-side. When a user submits an AI request, the request content may be sent to the selected configured provider; the provider's own retention and processing rules apply. Runtime jobs may read or modify only resources granted to their execution context, subject to the deployment's runtime configuration. Contact the deployment owner for data access, correction, retention, or deletion questions. This information describes the software's intended boundaries and is not a substitute for deployment-specific legal review." },
  login: { title: "Sign in", description: "Sign in to the protected Free AI Platform workspace.", eyebrow: "PRIVATE WORKSPACE", heading: "Sign in to your platform", body: "The administration workspace is available only to provisioned users. Public self-registration is disabled." },
};
const publicPageKeys = Object.keys(publicPageData);
let publicSiteSettings = null;
let publicSiteSettingsPromise = null;
let publicRenderGeneration = 0;
const providerTypesByKey = new Map();
const copy = {
    en: {
    workspace: "Free AI Platform Workspace", personalWorkspace: "Personal workspace", workspaceNav: "WORKSPACE", dashboard: "Overview", projects: "Projects", agents: "Agents", intelligence: "INTELLIGENCE", models: "Models", providers: "Providers", routing: "Smart routing", operations: "OPERATIONS", executions: "Executions", workflows: "Workflows", monitoring: "Monitoring", settings: "Settings", guestUser: "Guest user", localPreview: "Local preview", apiOffline: "API not connected", help: "Help", backendUnavailable: "Backend unavailable", overview: "Overview", welcome: "Your AI workspace,", welcomeAccent: "ready to take shape.", overviewText: "A calm place to bring projects, agents, and AI capabilities together.", newProject: "New project", connectionTitle: "Connect your workspace", connectionText: "The interface is ready. Connect the Free AI Platform API to load live projects, providers, and activity.", connectionCta: "API connection required", platform: "PLATFORM STATUS", connectedServices: "Connected services", noServices: "No services connected", setupTitle: "A good place to start", setupText: "Connect a provider and create your first project to begin building with Free AI Platform.", stepProvider: "Connect an AI provider", stepProject: "Create a project", stepAgent: "Configure your agents", noData: "No live data yet", apiNeeded: "Connect the API to manage this section.", goProviders: "Go to providers", goProjects: "Go to projects", projectTitle: "Projects", projectDesc: "Organize work, context, requirements, and deliverables in isolated workspaces.", agentTitle: "Agents", agentDesc: "Define specialists with clear capabilities, instructions, and permissions.", modelTitle: "Models", modelDesc: "Explore model capabilities and choose models that fit each task.", providerTitle: "Providers", providerDesc: "Manage API connections and credentials securely through the provider gateway.", routingTitle: "Smart routing", routingDesc: "Choose how Free AI Platform selects models based on capability, availability, and cost policy.", executionsTitle: "Executions", executionsDesc: "Review tool runs, outputs, approvals, and execution safety.", workflowsTitle: "Workflows", workflowsDesc: "Coordinate project steps with approvals, retries, and resumable state.", monitoringTitle: "Monitoring", monitoringDesc: "Observe service health, usage, limits, and recent errors.", settingsTitle: "Settings", settingsDesc: "Manage workspace preferences, access, and platform policies.", liveConnection: "Live connection status", disconnected: "Not connected", noBackendFeature: "This section will become interactive when its API endpoints are available.", apiBoundary: "Backend connection", apiBoundaryText: "The frontend does not fabricate records. Project, provider, model, and execution data will appear here once the API is running.", routingPolicy: "Default routing policy", freeOnly: "Free only", freeOnlyText: "No provider request is made by this preview. The platform is configured to prefer free services by policy.", appearance: "Appearance", dark: "Dark", light: "Light", savedLocally: "Preference saved in this browser", status: "Status", unavailable: "Unavailable", endpoint: "API endpoint", notConfigured: "Not configured", comingOnline: "Connect your API to bring this area online.", navOpen: "Navigation opened", themeChanged: "Theme updated", sections: "PLATFORM", emptyTitle: "Nothing here yet", emptyText: "This view is connected to the platform layout, but live records need the backend.", home: "Go to overview", flowTitle: "Your platform at a glance", flowText: "A connected workspace moves from a project brief to a verified delivery.", intake: "Intake", planning: "Planning", execution: "Execution", delivery: "Delivery", pipeline: "PLATFORM PIPELINE", unavailableShort: "Offline", themeTitle: "Color theme"
  },
};

const pageMeta = {
  dashboard: ["overview", "⌂"], projects: ["projectTitle", "▦"], agents: ["agentTitle", "✳"], models: ["modelTitle", "◈"], providers: ["providerTitle", "⌘"], routing: ["routingTitle", "⤳"], executions: ["executionsTitle", "▷"], devices: ["devices", "⌁"], workspaces: ["workspaces", "▣"], workflows: ["workflowsTitle", "⑂"], monitoring: ["monitoringTitle", "⌁"], users: ["usersTitle", "♙"], roles: ["rolesTitle", "⊞"], sessions: ["sessionsTitle", "◷"], settings: ["settingsTitle", "⚙"]
};

const extraCopy = {
  en: { signIn: "Sign in", signOut: "Sign out", account: "Account", logInTitle: "Sign in to Free AI Platform", tenantName: "Platform name", tenantSlug: "Platform URL name", username: "Username", password: "Password", continue: "Continue", cancel: "Cancel", creating: "Creating…", projectName: "Project name", projectKey: "Project key (e.g. NOVA)", description: "Description (optional)", create: "Create", loading: "Loading…", signInRequired: "Sign in to load your projects.", createTask: "Add task", taskTitle: "Task title", taskDescription: "Task description (optional)", backProjects: "← All projects", noProjects: "No projects yet. Create one to get started.", taskCount: "tasks", invalidCredentials: "Could not sign in. Check your platform ID and credentials.", requestFailed: "Request failed", taskCreated: "Task created", projectCreated: "Project created", workspaceId: "Platform ID", copyId: "Copy platform ID", providerCreate: "Save disabled provider", providerName: "Provider display name", providerKey: "Provider key", providerType: "Connector type", providerBaseUrl: "API base URL", providerApiKey: "API key (optional for local)", providerSaved: "Provider saved disabled. No external request was made.", tasks: "Tasks", apiOnline: "API connected", database: "Database", connected: "Connected", notConnected: "Not connected", retry: "Retry", tenantRequired: "Platform ID is required" },
};
Object.assign(extraCopy.en, { addModelMetadata: "Add model metadata", modelId: "Model ID", capabilitiesCsv: "Capabilities, comma separated", saveModel: "Save model", noEnabledModels: "No active models", modelsNeedHealth: "Models remain disabled until a provider has a verified health check and their billing and capabilities are reviewed.", modelMetadataSaved: "Model metadata saved disabled.", copied: "Copied" });
Object.assign(extraCopy.en, { enableFreeModels: "Enable Free Models", enablePaidModels: "Enable Paid Models", paidSpendBlocked: "Paid visibility does not authorize spending. Paid execution remains disabled by platform policy.", modelPolicySaved: "Model visibility policy saved.", save: "Save" });
Object.assign(extraCopy.en, { firstRunSetup: "Install Free AI Platform", bootstrapToken: "One-time installer token", bootstrapCreated: "Installation completed", bootstrapTokenInvalid: "The installer token is invalid or setup has already completed.", storeCredentials: "Store these generated credentials securely. They are shown once and cannot be recovered.", loginLink: "Continue to sign in", generatedPassword: "Generated owner password" });
Object.assign(extraCopy.en, { testConnection: "Test connection and discover", enable: "Enable", disable: "Disable", loadModels: "Load models", connectionTestPassed: "Connection succeeded; discovered models", providerEnabled: "Provider enabled", providerDisabled: "Provider disabled", modelEnabled: "Model enabled", modelDisabled: "Model disabled", noModelsDiscovered: "No models discovered yet.", capabilitiesUnverified: "Capabilities unverified", inputPrice: "Input price / 1M tokens", outputPrice: "Output price / 1M tokens", contextWindow: "Context window", maxOutputTokens: "Max output tokens", documentationUrl: "Pricing/capability documentation URL", privacyReviewed: "I reviewed this model's privacy and data handling." });
Object.assign(extraCopy.en, { platformPolicy: "Platform-wide policy", workspacePolicy: "Workspace policy", localModelsEnabled: "Enable local models", customProvidersEnabled: "Allow custom providers", automaticDiscovery: "Allow automatic discovery", automaticRefresh: "Allow automatic refresh", monthlyCostLimit: "Monthly cost limit (USD)", platformPolicySaved: "Platform policy saved." });
Object.assign(extraCopy.en, { hide: "Hide", show: "Show", modelHidden: "Model hidden from selectors", modelShown: "Model shown in selectors" });
Object.assign(extraCopy.en, { devices: "Connected devices", workspaces: "Workspaces", pairDevice: "Pair a device", pairingCode: "One-time pairing code", expires: "Expires", revoke: "Revoke", noDevices: "No devices paired.", noWorkspaces: "No workspace records.", workspaceBindingLimit: "To bind real files, configure FREEAI_WORKSPACE_BINDINGS_FILE on the paired Linux runtime with a private local alias-to-path file. Host paths remain local; this screen manages server-side permissions.", runtimeNeedsSignIn: "Sign in to manage local runtimes.", online: "Online", offline: "Offline", revoked: "Revoked", project: "Project", device: "Device", permissions: "Permissions", created: "Created", refresh: "Refresh" });
Object.assign(extraCopy.en, { liveRecords: "Live records", emptyRecords: "No records yet", metricUnavailable: "Not available to this account", workspaceReady: "Your workspace is connected", workspaceReadyText: "Live project, agent, provider, and execution counts are shown from the platform API.", signInToView: "Sign in to view live data", configuredProviders: "Configured providers" });
Object.assign(extraCopy.en, { users: "Users", roles: "Roles and permissions", sessions: "Sessions", usersTitle: "User administration", usersDesc: "Provision accounts with temporary credentials and explicit role assignment.", rolesTitle: "Roles and permissions", rolesDesc: "Create tenant-scoped roles and grant only the permissions each account needs.", sessionsTitle: "Active sessions", sessionsDesc: "Review active sessions and revoke access when needed.", createUser: "Create user", noUsers: "No users are provisioned.", tempCredentials: "Temporary credentials — copy and store securely. This screen will not show them again.", tempUsername: "Temporary username", tempPassword: "Temporary password", resetCredentials: "Reset credentials", disableAccount: "Deactivate", unlockAccount: "Unlock account", assignRoles: "Save role assignments", noRoles: "No roles created.", createRole: "Create role", roleName: "Role name", roleDescription: "Description", permissionKeys: "Permission keys, comma separated", sessionRevoked: "Revoke session", forceChange: "Password change required", locked: "Locked", active: "Active", disabled: "Disabled" });

let theme = localStorage.getItem("freeai-theme") || "dark";
const content = document.querySelector("#page-content");
const toast = document.querySelector("#toast");
const t = (key) => copy.en[key] || extraCopy.en[key] || key;
const authDialog = document.querySelector("#auth-dialog");
let authState = null;
let sessionVerified = false;
let csrfToken = "";
try { sessionStorage.removeItem("freeai-session"); } catch { /* storage may be unavailable in hardened browsers */ }
let activeProjectId = null;
let authMode = "login";
let apiHealth = false;
let bootstrapTenantId = "";

function applyPreferences() {
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelector("#theme-toggle").textContent = theme === "dark" ? "☼" : "☾";
  document.querySelector("#theme-toggle").setAttribute("aria-label", t(theme === "dark" ? "light" : "dark"));
  render();
}

function render() {
  const publicSite = document.querySelector("#public-site");
  const workspace = document.querySelector("#workspace-app");
  if (authState?.mustChangePassword) {
    publicSite.classList.remove("hidden");
    workspace.classList.add("hidden");
    showForcedPasswordChange();
    return;
  }
  const publicRoute = location.hash.startsWith("#public-") ? location.hash.slice(8) : null;
  if (!authState || !sessionVerified || publicPageKeys.includes(publicRoute)) {
    publicSite.classList.remove("hidden");
    workspace.classList.add("hidden");
    void renderPublicSite(publicPageKeys.includes(publicRoute) ? publicRoute : "home");
    return;
  }
  publicSite.classList.add("hidden");
  workspace.classList.remove("hidden");
  const page = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard";
  const [titleKey, icon] = pageMeta[page];
  const title = t(titleKey);
  document.querySelectorAll(".nav a[data-page]").forEach((link) => link.classList.toggle("active", link.dataset.page === page));
  document.querySelector("#breadcrumb-current").textContent = title;
  document.title = `${title} — Free AI Platform`;
  if (page === "dashboard") renderDashboard(); else if (page === "settings") renderSettings(); else if (page === "projects") void renderProjects(); else if (page === "providers") void renderProviders(); else if (page === "models") void renderModels(); else if (page === "agents") void renderAgents(); else if (page === "workflows") void renderWorkflows(); else if (page === "devices") void renderDevices(); else if (page === "workspaces") void renderWorkspaces(); else if (page === "executions") void renderRuntimeJobs(); else if (page === "users") void renderUsers(); else if (page === "roles") void renderRoles(); else if (page === "sessions") void renderSessions(); else renderSection(page, title, icon);
  updateAccountButton();
}

async function renderPublicSite(key) {
  const root = document.querySelector("#public-site");
  const generation = ++publicRenderGeneration;
  const page = publicPageData[key] || publicPageData.home;
  if (!publicSiteSettings) {
    if (!publicSiteSettingsPromise) publicSiteSettingsPromise = apiRequest("/api/v1/public/site").catch(() => ({}));
    publicSiteSettings = await publicSiteSettingsPromise;
  }
  if (generation !== publicRenderGeneration || !root.isConnected || root.classList.contains("hidden")) return;
  const settings = publicSiteSettings || {};
  const title = settings.platformName || "Free AI Platform";
  const primaryLinks = [["home", "Home"], ["platform", "Platform"], ["features", "Features"], ["providers", "Providers"], ["documentation", "Documentation"]];
  const allLinks = [["home", "Home"], ["about", "About"], ["features", "Features"], ["platform", "Platform Modules"], ["providers", "AI Providers"], ["models", "Models"], ["pricing", "Pricing and Plans"], ["contact", "Contact"], ["documentation", "Documentation"], ["faq", "FAQ"], ["terms", "Terms of Service"], ["privacy", "Privacy Policy"]];
  const cards = (page.cards || []).map(([heading, body]) => `<article class="public-card"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></article>`).join("");
  const providerCards = page.providerCards ? Object.values(providerIdentityRegistry).map((provider) => `<article class="public-card provider-public-card">${providerMark(provider.id, provider.name)}<div><h2>${escapeHtml(provider.name)}</h2><p>${escapeHtml(provider.integrationType)} · ${escapeHtml(provider.verification)}. Connection status is deployment-specific.</p></div></article>`).join("") : "";
  const faqs = (page.faqs || []).map(([question, answer]) => `<details class="public-faq"><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join("");
  const configuredBody = key === "contact" ? `<p>${escapeHtml(settings.contactDescription || page.body)}</p><div class="public-contact-links">${settings.contactEmail ? `<a href="mailto:${encodeURIComponent(settings.contactEmail)}">${escapeHtml(settings.contactEmail)}</a>` : ""}${settings.contactUrl ? `<a href="${safePublicUrl(settings.contactUrl)}" target="_blank" rel="noopener noreferrer">Contact page</a>` : ""}${settings.supportUrl ? `<a href="${safePublicUrl(settings.supportUrl)}" target="_blank" rel="noopener noreferrer">Support</a>` : ""}</div>` : `<p>${escapeHtml(key === "home" ? settings.platformDescription || page.body : settings.pageContent?.[key] || page.body || "")}</p>`;
  const socials = Array.isArray(settings.socialLinks) ? settings.socialLinks.filter((item) => item && typeof item.label === "string" && typeof item.url === "string" && safePublicUrl(item.url)).map((item) => `<a href="${safePublicUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`).join("") : "";
  const loginAction = authState && sessionVerified ? `<a class="primary-button" href="#dashboard">Open workspace</a>` : `<button class="primary-button" type="button" data-public-login>Sign in</button>`;
  root.innerHTML = `<header class="public-header"><a class="brand" href="#public-home" aria-label="${escapeHtml(title)} home"><img class="brand-symbol" src="/assets/free-ai-platform-symbol.svg" alt=""/><span class="brand-name">${escapeHtml(title)}</span></a><nav aria-label="Primary navigation">${primaryLinks.map(([route, label]) => `<a href="#public-${route}">${escapeHtml(label)}</a>`).join("")}</nav><details class="public-menu"><summary aria-label="Open site menu">Menu</summary><nav aria-label="All public pages">${allLinks.map(([route, label]) => `<a href="#public-${route}">${escapeHtml(label)}</a>`).join("")}</nav></details>${loginAction}</header><main id="public-main"><section class="public-hero"><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.heading)}</h1>${configuredBody}${key === "home" ? `<div class="public-hero-actions">${loginAction}<a class="secondary-button" href="#public-features">Explore capabilities</a></div>` : key === "login" ? loginAction : ""}</section>${cards || providerCards ? `<section class="public-card-grid" aria-label="${escapeHtml(page.title)}">${cards}${providerCards}</section>` : ""}${faqs ? `<section class="public-faq-list"><h2>Answers</h2>${faqs}</section>` : ""}</main><footer class="public-footer"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(settings.footerText || settings.platformDescription || "Self-hosted AI operations under your control.")}</p>${socials ? `<nav aria-label="Social links">${socials}</nav>` : ""}</div><nav aria-label="Footer navigation">${allLinks.map(([route, label]) => `<a href="#public-${route}">${escapeHtml(label)}</a>`).join("")}</nav><span>© ${new Date().getFullYear()} ${escapeHtml(title)}</span></footer>`;
  document.title = key === "home" ? title : `${page.title} — ${title}`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", page.description);
  root.querySelectorAll("[data-public-login]").forEach((button) => button.addEventListener("click", () => openAuth("login")));
  root.querySelector(".public-menu")?.addEventListener("click", (event) => { if (event.target.closest("a")) event.currentTarget.open = false; });
}

function safePublicUrl(value) {
  if (!value) return "";
  try { const url = new URL(value, location.origin); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}

function runtimePageHeader(key, description) {
  return `<section class="page-heading"><div><div class="eyebrow">${escapeHtml(t("operations"))}</div><h1>${escapeHtml(t(key))}</h1><p class="lead">${escapeHtml(description)}</p></div></section>`;
}

async function renderUsers() {
  content.innerHTML = `${runtimePageHeader("usersTitle", t("usersDesc"))}<section class="panel tasks-panel"><button class="primary-button" id="user-create-toggle">＋ ${escapeHtml(t("createUser"))}</button><form class="provider-create-form hidden" id="user-create-form"><label>Assign role (optional)<select name="roleId"><option value="">No role</option></select></label><button class="primary-button" type="submit">${escapeHtml(t("createUser"))}</button></form><div id="user-credentials"></div><div class="provider-list" id="user-list">${escapeHtml(t("loading"))}</div></section>`;
  const list = content.querySelector("#user-list");
  const form = content.querySelector("#user-create-form");
  const credential = content.querySelector("#user-credentials");
  let roles = [];
  const refresh = async () => {
    const [usersResult, roleResult] = await Promise.all([apiRequest("/api/v1/admin/users"), apiRequest("/api/v1/admin/roles")]);
    roles = roleResult.items;
    form.querySelector("select[name=roleId]").innerHTML = `<option value="">No role</option>${roles.map((role) => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.name)}</option>`).join("")}`;
    if (!list.isConnected) return;
    list.innerHTML = usersResult.items.length ? usersResult.items.map((user) => `<article class="provider-card"><div class="provider-heading"><strong>${escapeHtml(user.username)}</strong><small>${escapeHtml(user.status)}${user.passwordChangeRequired ? ` · ${escapeHtml(t("forceChange"))}` : ""}${user.lockedUntil ? ` · ${escapeHtml(t("locked"))} until ${escapeHtml(new Date(user.lockedUntil).toLocaleString("en"))}` : ""}</small></div><small>${escapeHtml(user.id)} · ${user.activeSessions} active sessions · roles: ${escapeHtml(user.roles.map((role) => role.name).join(", ") || "none")}</small><div class="user-admin-actions">${user.id !== authState.user.id && user.status === "ACTIVE" ? `<button class="text-button user-disable" data-id="${escapeHtml(user.id)}">${escapeHtml(t("disableAccount"))}</button>` : ""}<button class="text-button user-rename" data-id="${escapeHtml(user.id)}" data-name="${escapeHtml(user.username)}">Change username</button><button class="text-button user-reset" data-id="${escapeHtml(user.id)}">${escapeHtml(t("resetCredentials"))}</button>${user.lockedUntil ? `<button class="text-button user-unlock" data-id="${escapeHtml(user.id)}">${escapeHtml(t("unlockAccount"))}</button>` : ""}<label class="role-assign-label">Roles<select class="role-assignment" multiple data-id="${escapeHtml(user.id)}">${roles.map((role) => `<option value="${escapeHtml(role.id)}" ${user.roles.some((item) => item.id === role.id) ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("")}</select></label><button class="text-button user-assign" data-id="${escapeHtml(user.id)}">${escapeHtml(t("assignRoles"))}</button></div></article>`).join("") : `<p>${escapeHtml(t("noUsers"))}</p>`;
    list.querySelectorAll(".user-disable").forEach((button) => button.addEventListener("click", async () => { try { await apiRequest(`/api/v1/admin/users/${encodeURIComponent(button.dataset.id)}/disable`, { method: "POST", body: {} }); await refresh(); } catch (error) { showToast(error.message); } }));
    list.querySelectorAll(".user-rename").forEach((button) => button.addEventListener("click", async () => { const username = window.prompt("New username", button.dataset.name); if (!username) return; try { await apiRequest(`/api/v1/admin/users/${encodeURIComponent(button.dataset.id)}/username`, { method: "PATCH", body: { username } }); await refresh(); } catch (error) { showToast(error.message); } }));
    list.querySelectorAll(".user-reset").forEach((button) => button.addEventListener("click", async () => { try { const result = await apiRequest(`/api/v1/admin/users/${encodeURIComponent(button.dataset.id)}/password-reset`, { method: "POST", body: {} }); credential.innerHTML = credentialMarkup(result.credentials); credential.scrollIntoView({ block: "nearest" }); await refresh(); } catch (error) { showToast(error.message); } }));
    list.querySelectorAll(".user-unlock").forEach((button) => button.addEventListener("click", async () => { try { await apiRequest(`/api/v1/admin/users/${encodeURIComponent(button.dataset.id)}/unlock`, { method: "POST", body: {} }); await refresh(); } catch (error) { showToast(error.message); } }));
    list.querySelectorAll(".user-assign").forEach((button) => button.addEventListener("click", async () => { const select = list.querySelector(`.role-assignment[data-id="${CSS.escape(button.dataset.id)}"]`); try { await apiRequest(`/api/v1/admin/users/${encodeURIComponent(button.dataset.id)}/roles`, { method: "PUT", body: { roleIds: [...select.selectedOptions].map((option) => option.value) } }); showToast("Role assignments saved"); await refresh(); } catch (error) { showToast(error.message); } }));
  };
  content.querySelector("#user-create-toggle").addEventListener("click", () => form.classList.toggle("hidden"));
  form.addEventListener("submit", async (event) => { event.preventDefault(); const roleId = new FormData(form).get("roleId"); try { const created = await apiRequest("/api/v1/admin/users", { method: "POST", body: roleId ? { roleId } : {} }); credential.innerHTML = credentialMarkup(created.credentials); await refresh(); } catch (error) { showToast(error.message); } });
  try { await refresh(); } catch (error) { list.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`; }
}

function credentialMarkup(credentials) {
  return `<article class="provider-card credential-panel"><strong>${escapeHtml(t("tempCredentials"))}</strong><label>${escapeHtml(t("tempUsername"))}<input readonly autocomplete="off" value="${escapeHtml(credentials.username)}" /></label><label>${escapeHtml(t("tempPassword"))}<input readonly autocomplete="off" value="${escapeHtml(credentials.password)}" /></label></article>`;
}

async function renderRoles() {
  content.innerHTML = `${runtimePageHeader("rolesTitle", t("rolesDesc"))}<section class="panel tasks-panel"><button class="primary-button" id="role-create-toggle">＋ ${escapeHtml(t("createRole"))}</button><form class="provider-create-form hidden" id="role-create-form"><label>${escapeHtml(t("roleName"))}<input name="name" minlength="2" maxlength="80" required /></label><label>${escapeHtml(t("roleDescription"))}<input name="description" maxlength="500" /></label><label>${escapeHtml(t("permissionKeys"))}<input name="permissions" placeholder="project.read, workflow.manage" /></label><button class="primary-button" type="submit">${escapeHtml(t("createRole"))}</button></form><div class="provider-list" id="role-list">${escapeHtml(t("loading"))}</div></section>`;
  const form = content.querySelector("#role-create-form"); const list = content.querySelector("#role-list");
  const refresh = async () => { const result = await apiRequest("/api/v1/admin/roles"); if (list.isConnected) list.innerHTML = result.items.length ? result.items.map((role) => `<article class="provider-card"><strong>${escapeHtml(role.name)}</strong><small>${escapeHtml(role.description || "")}</small><p>${escapeHtml(role.permissionKeys.map((item) => `${item.effect}: ${item.key}`).join(" · ") || "No permissions")}</p></article>`).join("") : `<p>${escapeHtml(t("noRoles"))}</p>`; };
  content.querySelector("#role-create-toggle").addEventListener("click", () => form.classList.toggle("hidden"));
  form.addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const permissions = String(values.permissions || "").split(",").map((key) => key.trim()).filter(Boolean).map((key) => ({ key, effect: "ALLOW" })); try { await apiRequest("/api/v1/admin/roles", { method: "POST", body: { name: values.name, description: values.description, permissions } }); form.reset(); await refresh(); } catch (error) { showToast(error.message); } });
  try { await refresh(); } catch (error) { list.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`; }
}

async function renderSessions() {
  content.innerHTML = `${runtimePageHeader("sessionsTitle", t("sessionsDesc"))}<section class="panel tasks-panel"><div class="provider-list" id="session-list">${escapeHtml(t("loading"))}</div></section>`;
  const list = content.querySelector("#session-list");
  const refresh = async () => { const result = await apiRequest("/api/v1/admin/sessions"); if (!list.isConnected) return; list.innerHTML = result.items.length ? result.items.map((session) => `<article class="provider-card"><strong>${escapeHtml(session.user.username)}</strong><small>${escapeHtml(session.id)} · created ${escapeHtml(new Date(session.createdAt).toLocaleString("en"))} · last activity ${escapeHtml(session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString("en") : "not yet recorded")} · expires ${escapeHtml(new Date(session.expiresAt).toLocaleString("en"))}</small><small>${escapeHtml(session.ipAddress || "Address unavailable")} · ${escapeHtml(session.userAgent || "Device details unavailable")}</small><button class="text-button session-revoke" data-id="${escapeHtml(session.id)}">${escapeHtml(t("sessionRevoked"))}</button></article>`).join("") : `<p>${escapeHtml(t("emptyRecords"))}</p>`; list.querySelectorAll(".session-revoke").forEach((button) => button.addEventListener("click", async () => { try { await apiRequest(`/api/v1/admin/sessions/${encodeURIComponent(button.dataset.id)}/revoke`, { method: "POST", body: {} }); await refresh(); } catch (error) { showToast(error.message); } })); };
  try { await refresh(); } catch (error) { list.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`; }
}

async function renderDevices() {
  content.innerHTML = `${runtimePageHeader("devices", t("monitoringDesc"))}<section class="panel tasks-panel"><button class="primary-button" id="runtime-pair">＋ ${escapeHtml(t("pairDevice"))}</button><div id="runtime-pair-result"></div><div class="provider-list" id="runtime-device-list">${escapeHtml(t("loading"))}</div></section>`;
  if (!authState) { content.querySelector("#runtime-device-list").textContent = t("runtimeNeedsSignIn"); return; }
  const list = content.querySelector("#runtime-device-list");
  const refresh = async () => {
    const result = await apiRequest("/api/v1/runtime/devices");
    if (!list.isConnected) return;
    list.innerHTML = result.items.length ? result.items.map((d) => `<article class="provider-card"><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.operatingSystem)} · ${escapeHtml(d.architecture)} · v${escapeHtml(d.runtimeVersion)} · ${escapeHtml(d.connectionStatus)}</small><small>${escapeHtml(d.allowedProjectIds.join(", ") || "No project grants")}</small>${d.status !== "REVOKED" ? `<button class="text-button runtime-revoke" data-id="${escapeHtml(d.id)}">${escapeHtml(t("revoke"))}</button>` : ""}</article>`).join("") : `<p>${escapeHtml(t("noDevices"))}</p>`;
    list.querySelectorAll(".runtime-revoke").forEach((button) => button.addEventListener("click", async () => { try { await apiRequest(`/api/v1/runtime/devices/${encodeURIComponent(button.dataset.id)}/revoke`, { method: "POST", body: {} }); await refresh(); } catch (error) { showToast(error.message); } }));
  };
  content.querySelector("#runtime-pair").addEventListener("click", async () => {
    try { const issued = await apiRequest("/api/v1/runtime/pairings", { method: "POST", body: {} }); content.querySelector("#runtime-pair-result").innerHTML = `<p>${escapeHtml(t("pairingCode"))} — ${escapeHtml(t("expires"))}: ${escapeHtml(issued.expiresAt)}</p><code>${escapeHtml(issued.pairingCode)}</code><p>Use once with the Local Runtime pairing command. This code will not be fetched again.</p>`; }
    catch (error) { showToast(error.message); }
  });
  try { await refresh(); } catch (error) { list.textContent = error.message; }
}

async function renderWorkspaces() {
  content.innerHTML = `${runtimePageHeader("workspaces", t("projectDesc"))}<section class="panel section-status"><p>${escapeHtml(t("workspaceBindingLimit"))}</p><div class="provider-list" id="runtime-workspace-list">${escapeHtml(t("loading"))}</div></section>`;
  const list = content.querySelector("#runtime-workspace-list");
  if (!authState) { list.textContent = t("runtimeNeedsSignIn"); return; }
  try { const result = await apiRequest("/api/v1/runtime/workspaces"); if (list.isConnected) list.innerHTML = result.items.length ? result.items.map((w) => `<article class="provider-card"><strong>${escapeHtml(w.name)}</strong><small>${escapeHtml(t("project"))}: ${escapeHtml(w.projectId)} · ${escapeHtml(t("device"))}: ${escapeHtml(w.deviceId)}</small><small>${escapeHtml(w.rootAlias)} · read ${w.canRead ? "on" : "off"} · write ${w.canWrite ? "on" : "off"} · delete ${w.canDelete ? "on" : "off"} · execute ${w.canExecute ? "on" : "off"} · ${escapeHtml(w.status)}</small></article>`).join("") : `<p>${escapeHtml(t("noWorkspaces"))}</p>`; }
  catch (error) { list.textContent = error.message; }
}

async function renderRuntimeJobs() {
  content.innerHTML = `${runtimePageHeader("executionsTitle", t("executionsDesc"))}<section class="panel tasks-panel"><p>Only jobs actually stored by the Runtime API are shown. This view does not launch OpenCode.</p><button class="text-button" id="runtime-job-refresh">${escapeHtml(t("refresh"))}</button><div class="provider-list" id="runtime-job-list">${escapeHtml(t("loading"))}</div></section>`;
  const list = content.querySelector("#runtime-job-list");
  if (!authState) { list.textContent = t("runtimeNeedsSignIn"); return; }
  const refresh = async () => { const result = await apiRequest("/api/v1/runtime/jobs"); if (list.isConnected) list.innerHTML = result.items.length ? result.items.map((job) => `<article class="provider-card"><strong>${escapeHtml(job.kind)} · ${escapeHtml(job.status)}</strong><small>${escapeHtml(job.id)} · ${escapeHtml(job.projectId)}</small></article>`).join("") : `<p>${escapeHtml(t("noData"))}</p>`; };
  content.querySelector("#runtime-job-refresh").addEventListener("click", () => refresh().catch((error) => { list.textContent = error.message; }));
  try { await refresh(); } catch (error) { list.textContent = error.message; }
}

async function renderAgents() {
  renderSection("agents", t("agentTitle"), "✳");
  content.querySelector(".info-panel")?.remove();
  const section = content.querySelector(".section-status");
  if (!authState) { section.innerHTML = `<h2>${"Sign in to manage agents"}</h2><button class="primary-button" id="agent-sign-in">${escapeHtml(t("signIn"))}</button>`; section.querySelector("#agent-sign-in").addEventListener("click", () => openAuth("login")); return; }
  section.innerHTML = `<button class="primary-button" id="agent-create-toggle">＋ ${"Create agent"}</button><form class="provider-create-form hidden" id="agent-create-form"><input name="key" required pattern="[a-z0-9._-]{2,100}" placeholder="${"Agent key"}"/><input name="name" required minlength="2" placeholder="${"Agent name"}"/><textarea name="systemInstructions" required placeholder="${"Instructions"}"></textarea><select name="capabilities" required><option value="PLANNING">PLANNING</option><option value="CODING">CODING</option><option value="RESEARCH">RESEARCH</option><option value="WRITING">WRITING</option><option value="ANALYSIS">ANALYSIS</option></select><button class="primary-button" type="submit">${escapeHtml(t("create"))}</button></form><div id="agent-list"><p>${escapeHtml(t("loading"))}</p></div>`;
  section.querySelector("#agent-create-toggle").addEventListener("click", () => section.querySelector("#agent-create-form").classList.toggle("hidden"));
  section.querySelector("#agent-create-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    try { await apiRequest("/api/v1/agents", { method: "POST", body: { key: values.key, name: values.name, description: "", systemInstructions: values.systemInstructions, capabilities: [values.capabilities], allowedTools: [], inputSchema: {}, outputSchema: {}, configuration: {} } }); showToast("Agent created as draft"); await renderAgents(); }
    catch (error) { showToast(error.message); }
  });
  try {
    const result = await apiRequest("/api/v1/agents");
    if (!section.isConnected) return;
    section.querySelector("#agent-list").innerHTML = result.items.length ? `<div class="provider-list">${result.items.map((agent) => `<article class="provider-card"><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.key)} · ${escapeHtml(agent.status)} · v${escapeHtml(agent.currentVersion)}</small><p>${escapeHtml((agent.capabilities ?? []).join(", "))}</p></article>`).join("")}</div>` : `<p>${"No agents are saved in this workspace."}</p>`;
  } catch (error) { if (section.isConnected) section.querySelector("#agent-list").innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`; }
}

async function renderWorkflows() {
  renderSection("workflows", t("workflowsTitle"), "▷");
  content.querySelector(".info-panel")?.remove();
  const section = content.querySelector(".section-status");
  if (!authState) { section.innerHTML = `<h2>${"Sign in to manage workflows"}</h2><button class="primary-button" id="workflow-sign-in">${escapeHtml(t("signIn"))}</button>`; section.querySelector("#workflow-sign-in").addEventListener("click", () => openAuth("login")); return; }
  section.innerHTML = `<label>${"Project"}<select id="workflow-project"><option value="">${escapeHtml(t("loading"))}</option></select></label><div id="workflow-content"></div>`;
  const select = section.querySelector("#workflow-project"); const body = section.querySelector("#workflow-content");
  try {
    const projectsResult = await apiRequest("/api/v1/projects");
    if (!section.isConnected) return;
    select.innerHTML = projectsResult.items.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    if (!projectsResult.items.length) { body.textContent = "Create a project before configuring workflows."; return; }
    const load = async () => {
      const result = await apiRequest(`/api/v1/projects/${encodeURIComponent(select.value)}/workflows`);
      if (!section.isConnected) return;
      body.innerHTML = `<button class="primary-button" id="workflow-create">＋ ${"Create approval workflow"}</button>${result.items.length ? `<div class="provider-list">${result.items.map((workflow) => `<article class="provider-card"><strong>${escapeHtml(workflow.definition.name)}</strong><small>${escapeHtml(workflow.key)} · ${escapeHtml(workflow.status)} · v${escapeHtml(workflow.version)}</small>${workflow.status === "ACTIVE" ? `<button class="text-button workflow-run" data-id="${escapeHtml(workflow.id)}">${"Run"}</button>` : ""}</article>`).join("")}</div>` : `<p>${"No saved workflow definitions."}</p>`}`;
      body.querySelector("#workflow-create").addEventListener("click", async () => {
        const suffix = crypto.randomUUID().slice(0, 8);
        try {
          const created = await apiRequest(`/api/v1/projects/${encodeURIComponent(select.value)}/workflows`, { method: "POST", body: { key: `approval-${suffix}`, name: "Approval and completion", version: "1.0.0", steps: [{ id: "approval", name: "Approval", type: "APPROVAL", config: {}, dependsOn: [], retryLimit: 0, timeoutMs: 120000 }, { id: "complete", name: "Complete", type: "WAIT", config: { waitMs: 0 }, dependsOn: ["approval"], retryLimit: 0, timeoutMs: 5000 }] } });
          await apiRequest(`/api/v1/projects/${encodeURIComponent(select.value)}/workflows/${encodeURIComponent(created.id)}/activate`, { method: "POST", body: {} }); showToast("Workflow saved and activated"); await load();
        } catch (error) { showToast(error.message); }
      });
      body.querySelectorAll(".workflow-run").forEach((button) => button.addEventListener("click", async () => {
        try {
          const projectId = encodeURIComponent(select.value);
          const run = await apiRequest(`/api/v1/projects/${projectId}/workflow-runs`, { method: "POST", body: { workflowId: button.dataset.id, input: {}, idempotencyKey: crypto.randomUUID() } });
          if (run.status === "WAITING_APPROVAL") {
            const pending = await apiRequest(`/api/v1/projects/${projectId}/workflow-runs/${encodeURIComponent(run.runId)}/approvals`);
            const approval = pending.items.find((item) => item.status === "PENDING");
            if (approval) {
              body.insertAdjacentHTML("afterbegin", `<article class="provider-card" id="workflow-pending-approval"><strong>${"Approval required"}</strong><small>${escapeHtml(run.runId)}</small><button class="primary-button" id="workflow-approve">${"Approve and resume"}</button></article>`);
              body.querySelector("#workflow-approve").addEventListener("click", async () => { try { await apiRequest(`/api/v1/projects/${projectId}/workflow-approvals/${encodeURIComponent(approval.id)}`, { method: "POST", body: { decision: "APPROVED" } }); const finished = await apiRequest(`/api/v1/projects/${projectId}/workflow-runs/${encodeURIComponent(run.runId)}/resume`, { method: "POST", body: {} }); showToast(`${"Run completed"}: ${finished.status}`); } catch (error) { showToast(error.message); } });
            }
          } else showToast(`${"Run status"}: ${run.status}`);
        }
        catch (error) { showToast(error.message); }
      }));
    };
    select.addEventListener("change", () => { void load().catch((error) => { body.textContent = error.message; }); });
    if (select.value) await load();
  } catch (error) { if (section.isConnected) section.insertAdjacentHTML("beforeend", `<p class="error-state">${escapeHtml(error.message)}</p>`); }
}

function renderDashboard() {
  content.innerHTML = `<section class="welcome-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(t("overview"))}</div><h1>${escapeHtml(t("welcome"))}<br /><span>${escapeHtml(t("welcomeAccent"))}</span></h1><p class="lead">${escapeHtml(t("overviewText"))}</p></div><button class="primary-button" data-route="projects"><span>＋</span>${escapeHtml(t("newProject"))}</button></section>
    <section class="connect-banner"><div class="connect-icon">⌁</div><div class="connect-copy"><h2>${escapeHtml(authState ? t("workspaceReady") : t("connectionTitle"))}</h2><p>${escapeHtml(authState ? t("workspaceReadyText") : t("connectionText"))}</p></div><span class="status-pill offline" id="dashboard-api-status"><i></i>${escapeHtml(authState ? t("loading") : t("connectionCta"))}</span></section>
    <section class="stats-grid"><article class="stat-card"><div class="stat-heading"><span>${escapeHtml(t("projects"))}</span><span class="stat-symbol">▦</span></div><div class="stat-number" id="project-total">—</div><div class="stat-caption" id="project-caption">${escapeHtml(t("noData"))}</div></article><article class="stat-card"><div class="stat-heading"><span>${escapeHtml(t("agents"))}</span><span class="stat-symbol">✳</span></div><div class="stat-number" id="agent-total">—</div><div class="stat-caption" id="agent-caption">${escapeHtml(t("noData"))}</div></article><article class="stat-card"><div class="stat-heading"><span>${escapeHtml(t("providers"))}</span><span class="stat-symbol">◈</span></div><div class="stat-number" id="provider-total">—</div><div class="stat-caption" id="provider-caption">${escapeHtml(t("noServices"))}</div></article><article class="stat-card"><div class="stat-heading"><span>${escapeHtml(t("executions"))}</span><span class="stat-symbol">▷</span></div><div class="stat-number" id="execution-total">—</div><div class="stat-caption" id="execution-caption">${escapeHtml(t("noData"))}</div></article></section>
    <section class="dashboard-columns"><article class="panel setup-panel"><div class="panel-heading"><div><div class="eyebrow">${escapeHtml(t("platform"))}</div><h2>${escapeHtml(t("setupTitle"))}</h2></div><span class="panel-menu">···</span></div><p class="panel-description">${escapeHtml(t("setupText"))}</p><div class="setup-list"><button class="setup-item" data-route="providers"><span class="setup-index">01</span><span class="setup-text"><strong>${escapeHtml(t("stepProvider"))}</strong><small>${escapeHtml(t("disconnected"))}</small></span><span class="setup-arrow">↗</span></button><button class="setup-item" data-route="projects"><span class="setup-index">02</span><span class="setup-text"><strong>${escapeHtml(t("stepProject"))}</strong><small>${escapeHtml(t("apiNeeded"))}</small></span><span class="setup-arrow">↗</span></button><button class="setup-item" data-route="agents"><span class="setup-index">03</span><span class="setup-text"><strong>${escapeHtml(t("stepAgent"))}</strong><small>${escapeHtml(t("apiNeeded"))}</small></span><span class="setup-arrow">↗</span></button></div></article>
    <article class="panel status-panel"><div class="panel-heading"><div><div class="eyebrow">${escapeHtml(t("platform"))}</div><h2>${escapeHtml(t("liveConnection"))}</h2></div><span class="status-dot large"></span></div><div class="service-row"><span class="service-mark">◉</span><span class="service-label">${"API"}</span><span class="service-state">${escapeHtml(t("unavailableShort"))}</span></div><div class="service-row"><span class="service-mark">▤</span><span class="service-label">${"Database"}</span><span class="service-state">${escapeHtml(t("unavailableShort"))}</span></div><div class="service-row"><span class="service-mark">⌘</span><span class="service-label">${escapeHtml(t("providers"))}</span><span class="service-state">${escapeHtml(t("unavailableShort"))}</span></div><div class="status-note"><span>ⓘ</span>${escapeHtml(t("apiBoundaryText"))}</div></article></section>
    <section class="panel pipeline-panel"><div class="panel-heading"><div><div class="eyebrow">${escapeHtml(t("pipeline"))}</div><h2>${escapeHtml(t("flowTitle"))}</h2></div><span class="panel-menu">···</span></div><p class="panel-description">${escapeHtml(t("flowText"))}</p><div class="pipeline">${["intake", "planning", "execution", "delivery"].map((key, i) => `<div class="pipeline-step"><span class="pipeline-icon">${["⌕", "☷", "▷", "✧"][i]}</span><span>${escapeHtml(t(key))}</span></div>${i < 3 ? '<span class="pipeline-line"></span>' : ""}`).join("")}</div></section>`;
  bindRouteButtons();
  void refreshDashboardMetrics();
}

function renderSection(page, title, icon) {
  const descriptionKey = { projects: "projectDesc", agents: "agentDesc", models: "modelDesc", providers: "providerDesc", routing: "routingDesc", executions: "executionsDesc", workflows: "workflowsDesc", monitoring: "monitoringDesc", settings: "settingsDesc" }[page] || `${page}Desc`;
  const description = t(descriptionKey);
  content.innerHTML = `<section class="page-heading"><div><div class="eyebrow"><span class="heading-icon">${icon}</span>${escapeHtml(t("sections"))}</div><h1>${escapeHtml(title)}</h1><p class="lead">${escapeHtml(description)}</p></div>${page === "projects" ? `<button class="primary-button disabled-button" title="${escapeHtml(t("apiNeeded"))}" aria-disabled="true">＋ ${escapeHtml(t("newProject"))}</button>` : ""}</section><section class="panel section-status"><div class="empty-illustration">${icon}</div><h2>${escapeHtml(t("emptyTitle"))}</h2><p>${escapeHtml(t("emptyText"))}</p><div class="section-connection"><span class="status-dot"></span><span>${escapeHtml(t("apiOffline"))}</span></div></section><section class="panel info-panel"><div class="info-icon">ⓘ</div><div><h3>${escapeHtml(t("apiBoundary"))}</h3><p>${escapeHtml(t("noBackendFeature"))}</p></div></section>`;
}

function renderSettings() {
  content.innerHTML = `<section class="page-heading"><div><div class="eyebrow">${escapeHtml(t("sections"))}</div><h1>${escapeHtml(t("settingsTitle"))}</h1><p class="lead">${escapeHtml(t("settingsDesc"))}</p></div></section><section class="settings-grid"><article class="panel setting-card"><div class="setting-icon">◐</div><div class="setting-info"><h2>${escapeHtml(t("themeTitle"))}</h2><p>${escapeHtml(t("savedLocally"))}</p></div><div class="segmented"><button data-theme-choice="light" class="${theme === "light" ? "selected" : ""}">${escapeHtml(t("light"))}</button><button data-theme-choice="dark" class="${theme === "dark" ? "selected" : ""}">${escapeHtml(t("dark"))}</button></div></article><article class="panel setting-card wide"><div class="setting-icon">⌁</div><div class="setting-info"><h2>${escapeHtml(t("apiBoundary"))}</h2><p>${escapeHtml(t("apiBoundaryText"))}</p></div><span class="status-pill offline"><i></i>${escapeHtml(t("notConfigured"))}</span></article><article class="panel setting-card wide"><div class="setting-icon">◇</div><div class="setting-info"><h2>${escapeHtml(t("routingPolicy"))}</h2><p>${escapeHtml(t("freeOnlyText"))}</p></div><span class="policy-tag">${escapeHtml(t("freeOnly"))}</span></article></section>`;
  if (authState) {
    content.querySelector(".settings-grid").insertAdjacentHTML("afterbegin", `<article class="panel setting-card wide"><div class="setting-icon">▣</div><div class="setting-info"><h2>${escapeHtml(t("workspaceId"))}</h2><code class="tenant-id">${escapeHtml(authState.tenantId)}</code></div><button class="help-button" id="copy-tenant-id">${escapeHtml(t("copyId"))}</button></article>`);
    content.querySelector("#copy-tenant-id").addEventListener("click", async () => { try { await navigator.clipboard.writeText(authState.tenantId); showToast(t("copied")); } catch { showToast(authState.tenantId); } });
    content.querySelector(".settings-grid").insertAdjacentHTML("beforeend", `<article class="panel setting-card wide public-settings-card"><div class="setting-info"><h2>Public website content</h2><p>These settings are stored by the platform API. They are public after saving; do not enter secrets or private information.</p></div><details><summary>Edit public content</summary><form class="provider-create-form" id="public-settings-form"><label>Platform name<input name="platformName" required minlength="2" maxlength="100"/></label><label>Platform description<textarea name="platformDescription" maxlength="1000" rows="3"></textarea></label><label>Contact description<textarea name="contactDescription" maxlength="1000" rows="2"></textarea></label><label>Public contact email<input name="contactEmail" type="email" maxlength="254"/></label><label>Public contact URL (HTTPS)<input name="contactUrl" type="url" placeholder="https://"/></label><label>Public support URL (HTTPS)<input name="supportUrl" type="url" placeholder="https://"/></label><label>Footer content<textarea name="footerText" maxlength="500" rows="2"></textarea></label><label>Social links (JSON array of {label, url})<textarea name="socialLinks" rows="4" placeholder='[{"label":"Community","url":"https://example.org/community"}]'></textarea></label><label>Terms of Service content<textarea name="terms" maxlength="20000" rows="6"></textarea></label><label>Privacy Policy content<textarea name="privacy" maxlength="20000" rows="6"></textarea></label><p class="public-settings-error hidden" role="alert"></p><button class="primary-button" type="submit">Save public settings</button></form></details></article>`);
    void loadPublicSettingsForm();
  }
  content.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => { theme = button.dataset.themeChoice; localStorage.setItem("freeai-theme", theme); applyPreferences(); }));
}

async function loadPublicSettingsForm() {
  const form = content.querySelector("#public-settings-form");
  if (!form) return;
  try {
    const settings = await apiRequest("/api/v1/admin/public-site");
    if (!form.isConnected) return;
    for (const key of ["platformName", "platformDescription", "contactDescription", "contactEmail", "contactUrl", "supportUrl", "footerText"]) form.elements[key].value = settings[key] || "";
    form.elements.socialLinks.value = JSON.stringify(settings.socialLinks || [], null, 2);
    form.elements.terms.value = settings.pageContent?.terms || "";
    form.elements.privacy.value = settings.pageContent?.privacy || "";
    form.addEventListener("submit", savePublicSettings);
  } catch (error) {
    if (!form.isConnected) return;
    form.querySelector(".public-settings-error").textContent = `Settings unavailable for this account: ${error.message}`;
    form.querySelector(".public-settings-error").classList.remove("hidden");
    form.querySelector("button[type=submit]").disabled = true;
  }
}

async function savePublicSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = form.querySelector(".public-settings-error");
  error.classList.add("hidden");
  try {
    let socialLinks;
    try { socialLinks = JSON.parse(form.elements.socialLinks.value || "[]"); }
    catch { throw new Error("Social links must be valid JSON."); }
    if (!Array.isArray(socialLinks)) throw new Error("Social links must be a JSON array.");
    const body = {
      platformName: form.elements.platformName.value,
      platformDescription: form.elements.platformDescription.value,
      contactDescription: form.elements.contactDescription.value,
      contactEmail: form.elements.contactEmail.value,
      contactUrl: form.elements.contactUrl.value,
      supportUrl: form.elements.supportUrl.value,
      footerText: form.elements.footerText.value,
      socialLinks,
      pageContent: { terms: form.elements.terms.value, privacy: form.elements.privacy.value },
    };
    publicSiteSettings = await apiRequest("/api/v1/admin/public-site", { method: "PUT", body });
    showToast("Public website settings saved.");
  } catch (failure) { error.textContent = failure.message; error.classList.remove("hidden"); }
}

function updateAccountButton() {
  const button = document.querySelector("#auth-button");
  if (!button) return;
  button.textContent = authState ? `${t("account")} · ${authState.user?.username || authState.user?.email || ""}` : t("signIn");
  button.title = authState ? t("signOut") : t("signIn");
  button.onclick = () => {
    if (authState) { void apiRequest("/api/v1/auth/logout", { method: "POST" }).catch(() => {}).finally(() => { authState = null; sessionVerified = false; csrfToken = ""; activeProjectId = null; showToast(t("signOut")); render(); }); }
    else openAuth("login");
  };
}

function openAuth(mode = "login") {
  authMode = mode;
  renderAuthDialog();
  authDialog.showModal();
  void ensureCsrf().catch(() => {});
  if (mode === "login") void apiRequest("/api/v1/auth/bootstrap/status").then((status) => {
    if (!status.available || !authDialog.open || authDialog.querySelector("#auth-bootstrap")) return;
    const action = document.createElement("button");
    action.id = "auth-bootstrap";
    action.className = "auth-switch";
    action.textContent = t("firstRunSetup");
    action.addEventListener("click", () => { authMode = "bootstrap"; renderAuthDialog(); });
    authDialog.append(action);
  }).catch(() => {});
}

function renderAuthDialog() {
  const bootstrap = authMode === "bootstrap";
  const title = bootstrap ? "firstRunSetup" : "logInTitle";
  const fields = bootstrap ? `<label>${escapeHtml(t("bootstrapToken"))}<input name="bootstrapToken" type="password" required minlength="32" autocomplete="one-time-code" /></label><label>${escapeHtml(t("tenantName"))}<input name="tenantName" required minlength="2" maxlength="120" autocomplete="organization" /></label><label>${escapeHtml(t("tenantSlug"))}<input name="tenantSlug" required pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" maxlength="60" autocomplete="off" /></label>` : `<label>${escapeHtml(t("workspaceId"))}<input name="tenantId" required autocomplete="organization" value="${escapeHtml(bootstrapTenantId)}" /></label><label>${escapeHtml(t("username"))}<input name="username" required autocomplete="username" /></label>`;
  const passwordField = bootstrap ? "" : `<label>${escapeHtml(t("password"))}<input name="password" type="password" required minlength="12" maxlength="1024" autocomplete="current-password" /></label>`;
  authDialog.innerHTML = `<form method="dialog" class="dialog-close-form"><button class="icon-button" aria-label="${escapeHtml(t("cancel"))}">×</button></form><img class="auth-brand" src="/assets/free-ai-platform-logo-${theme}.svg" alt="Free AI Platform" /><h2>${escapeHtml(t(title))}</h2><form id="auth-form" class="auth-form">${fields}${passwordField}<p class="auth-error hidden" id="auth-error"></p><button class="primary-button auth-submit" type="submit">${escapeHtml(t("continue"))}</button></form><button class="text-button dialog-cancel" id="auth-cancel">${escapeHtml(t("cancel"))}</button>`;
  authDialog.querySelector("#auth-form").addEventListener("submit", submitAuth);
  authDialog.querySelector("#auth-cancel").addEventListener("click", () => authDialog.close());
  authDialog.querySelector("[name=tenantName]")?.addEventListener("input", (event) => { const slug = authDialog.querySelector("[name=tenantSlug]"); if (!slug.dataset.edited) slug.value = event.target.value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); });
  authDialog.querySelector("[name=tenantSlug]")?.addEventListener("input", (event) => { event.target.dataset.edited = "true"; });
}

async function submitAuth(event) {
  event.preventDefault();
  const button = authDialog.querySelector(".auth-submit");
  const error = authDialog.querySelector("#auth-error");
  button.disabled = true; button.textContent = t("creating"); error.classList.add("hidden");
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    if (authMode === "bootstrap") {
      const created = await apiRequest("/api/v1/auth/bootstrap", { method: "POST", body: values });
      bootstrapTenantId = created.tenant.id;
      authDialog.innerHTML = `<img class="auth-brand" src="/assets/free-ai-platform-logo-${theme}.svg" alt="Free AI Platform" /><h2>${escapeHtml(t("bootstrapCreated"))}</h2><p>${escapeHtml(t("storeCredentials"))}</p><label>${escapeHtml(t("workspaceId"))}<input readonly value="${escapeHtml(created.tenant.id)}" /></label><label>${escapeHtml(t("username"))}<input readonly value="${escapeHtml(created.credentials.username)}" /></label><label>${escapeHtml(t("generatedPassword"))}<input readonly value="${escapeHtml(created.credentials.password)}" /></label><button class="primary-button auth-submit" id="bootstrap-login">${escapeHtml(t("loginLink"))}</button>`;
      authDialog.querySelector("#bootstrap-login").addEventListener("click", () => { authMode = "login"; renderAuthDialog(); });
      return;
    } else {
      if (!values.tenantId) throw new Error(t("tenantRequired"));
      const session = await apiRequest("/api/v1/auth/login", { method: "POST", body: values });
      acceptSession(session);
      if (session.mustChangePassword) { render(); return; }
    }
    authDialog.close(); render();
  } catch (failure) { error.textContent = authMode === "login" && failure.status === 401 ? t("invalidCredentials") : authMode === "bootstrap" && [401, 409].includes(failure.status) ? t("bootstrapTokenInvalid") : failure.message; error.classList.remove("hidden"); }
  finally { if (button.isConnected) { button.disabled = false; button.textContent = t("continue"); } }
}

function acceptSession(session) {
  csrfToken = session.csrfToken;
  authState = { tenantId: session.user.tenantId, user: session.user, mustChangePassword: session.mustChangePassword === true };
  sessionVerified = true;
  updateAccountButton();
}

function showForcedPasswordChange() {
  if (authDialog.open && authDialog.querySelector("#forced-password-form")) return;
  authDialog.innerHTML = `<img class="auth-brand" src="/assets/free-ai-platform-logo-${theme}.svg" alt="Free AI Platform" /><h2>Change your temporary password</h2><p>Choose a new password to continue to your workspace.</p><form class="auth-form" id="forced-password-form"><label>New password<input name="newPassword" type="password" minlength="12" maxlength="1024" required autocomplete="new-password" /></label><label>Confirm new password<input name="confirmPassword" type="password" minlength="12" maxlength="1024" required autocomplete="new-password" /></label><p class="auth-error hidden" id="forced-password-error"></p><button class="primary-button auth-submit" type="submit">Save password</button></form>`;
  authDialog.querySelector("#forced-password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const error = authDialog.querySelector("#forced-password-error");
    if (values.newPassword !== values.confirmPassword) { error.textContent = "Passwords do not match."; error.classList.remove("hidden"); return; }
    const button = form.querySelector("button[type=submit]"); button.disabled = true;
    try { const session = await apiRequest("/api/v1/auth/password", { method: "POST", body: { newPassword: values.newPassword } }); acceptSession(session); authDialog.close(); render(); }
    catch (failure) { error.textContent = failure.message; error.classList.remove("hidden"); }
    finally { if (button.isConnected) button.disabled = false; }
  });
  if (!authDialog.open) authDialog.showModal();
}

async function checkApiHealth() {
  const label = document.querySelector(".api-status span");
  const indicator = document.querySelector(".api-status i");
  try {
    const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    const status = await response.json();
    apiHealth = response.ok && status.checks?.database === true;
  } catch { apiHealth = false; }
  if (label) label.textContent = t(apiHealth ? "apiOnline" : "apiOffline");
  if (indicator) { indicator.classList.toggle("online", apiHealth); }
  const serviceStates = document.querySelectorAll(".status-panel .service-state");
  if (serviceStates[0]) serviceStates[0].textContent = t(apiHealth ? "connected" : "unavailableShort");
  if (serviceStates[1]) serviceStates[1].textContent = t(apiHealth ? "connected" : "unavailableShort");
}

async function restoreSession() {
  try {
    await ensureCsrf();
    const current = await apiRequest("/api/v1/auth/me");
    authState = { tenantId: current.tenantId, user: { id: current.userId, tenantId: current.tenantId, username: current.username }, mustChangePassword: current.mustChangePassword === true };
    sessionVerified = true; render();
  } catch { authState = null; sessionVerified = true; updateAccountButton(); render(); }
}

const API_BASE = window.FREE_AI_API_BASE ?? localStorage.getItem("freeai-api-url") ?? "http://127.0.0.1:3000";
async function ensureCsrf() {
  const result = await apiRequest("/api/v1/auth/csrf");
  csrfToken = result.csrfToken;
}
async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && path !== "/api/v1/auth/csrf" && !csrfToken) await ensureCsrf();
  const headers = { ...(options.body !== undefined ? { "content-type": "application/json" } : {}), ...(["POST", "PUT", "PATCH", "DELETE"].includes(method) && csrfToken ? { "x-csrf-token": csrfToken } : {}), ...options.headers };
  const response = await fetch(`${API_BASE}${path}`, { method, headers, credentials: "include", ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.message || t("requestFailed")); error.status = response.status; throw error; }
  return body;
}

async function refreshDashboardMetrics() {
  const metrics = [
    ["project", "/api/v1/projects", "projects"],
    ["agent", "/api/v1/agents", "agents"],
    ["provider", "/api/v1/providers", "providers"],
    ["execution", "/api/v1/runtime/jobs", "executions"],
  ];
  const status = document.querySelector("#dashboard-api-status");
  if (!status) return;
  if (!authState) {
    for (const [key] of metrics) {
      const target = document.querySelector(`#${key}-total`);
      const caption = document.querySelector(`#${key}-caption`);
      if (target) target.textContent = "—";
      if (caption) caption.textContent = t("signInRequired");
    }
    return;
  }
  const results = await Promise.allSettled(metrics.map(([, endpoint]) => apiRequest(endpoint)));
  const apiConnected = results.some((result) => result.status === "fulfilled");
  status.classList.toggle("offline", !apiConnected);
  status.classList.toggle("online", apiConnected);
  status.innerHTML = `<i></i>${escapeHtml(t(apiConnected ? "apiOnline" : "apiOffline"))}`;
  results.forEach((result, index) => {
    const [key] = metrics[index];
    const target = document.querySelector(`#${key}-total`);
    const caption = document.querySelector(`#${key}-caption`);
    if (!target?.isConnected || !caption?.isConnected) return;
    if (result.status === "fulfilled" && Array.isArray(result.value.items)) {
      const count = result.value.items.length;
      target.textContent = String(count);
      caption.textContent = key === "provider" ? t("configuredProviders") : count ? t("liveRecords") : t("emptyRecords");
    } else {
      target.textContent = "—";
      caption.textContent = t("metricUnavailable");
    }
  });
}

async function renderProjects() {
  if (!authState) {
    content.innerHTML = `<section class="page-heading"><div><div class="eyebrow">${escapeHtml(t("sections"))}</div><h1>${escapeHtml(t("projectTitle"))}</h1><p class="lead">${escapeHtml(t("projectDesc"))}</p></div></section><section class="panel section-status"><div class="empty-illustration">▦</div><h2>${escapeHtml(t("signInRequired"))}</h2><button class="primary-button" id="projects-sign-in">${escapeHtml(t("signIn"))}</button></section>`;
    document.querySelector("#projects-sign-in").addEventListener("click", () => openAuth("login"));
    return;
  }
  if (activeProjectId) { await renderProjectDetail(activeProjectId); return; }
  content.innerHTML = `<section class="page-heading"><div><div class="eyebrow">${escapeHtml(t("sections"))}</div><h1>${escapeHtml(t("projectTitle"))}</h1><p class="lead">${escapeHtml(t("projectDesc"))}</p></div><button class="primary-button" id="project-create-toggle">＋ ${escapeHtml(t("newProject"))}</button></section><form class="panel create-form hidden" id="project-create-form"><div class="form-grid"><label>${escapeHtml(t("projectName"))}<input name="name" required minlength="2" maxlength="160" /></label><label>${escapeHtml(t("projectKey"))}<input name="key" required pattern="[A-Z][A-Z0-9_-]{1,31}" maxlength="32" /></label><label class="full-field">${escapeHtml(t("description"))}<textarea name="description" maxlength="10000" rows="2"></textarea></label></div><button class="primary-button" type="submit">${escapeHtml(t("create"))}</button></form><div class="project-grid" id="project-list"><section class="panel loading-state">${escapeHtml(t("loading"))}</section></div>`;
  document.querySelector("#project-create-toggle").addEventListener("click", () => document.querySelector("#project-create-form").classList.toggle("hidden"));
  document.querySelector("#project-create-form").addEventListener("submit", createProjectFromForm);
  const list = document.querySelector("#project-list");
  try {
    const result = await apiRequest("/api/v1/projects");
    if (!list.isConnected) return;
    if (!result.items.length) { list.innerHTML = `<section class="panel loading-state">${escapeHtml(t("noProjects"))}</section>`; return; }
    list.innerHTML = result.items.map((project) => `<button class="panel project-card" data-project-id="${escapeHtml(project.id)}"><span class="project-card-mark">${escapeHtml(project.key.slice(0, 1))}</span><span class="project-card-copy"><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.key)} · ${escapeHtml(project.status)}</small></span><span class="project-open">↗</span></button>`).join("");
    list.querySelectorAll("[data-project-id]").forEach((button) => button.addEventListener("click", () => { activeProjectId = button.dataset.projectId; void renderProjects(); }));
  } catch (error) { if (list.isConnected) list.innerHTML = `<section class="panel loading-state error-state">${escapeHtml(error.message)}</section>`; }
}

async function createProjectFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const button = form.querySelector("button[type=submit]"); button.disabled = true;
  try { await apiRequest("/api/v1/projects", { method: "POST", body: values }); showToast(t("projectCreated")); activeProjectId = null; await renderProjects(); }
  catch (error) { showToast(error.message); button.disabled = false; }
}

async function renderProjectDetail(projectId) {
  content.innerHTML = `<section class="page-heading"><button class="text-button" id="back-projects">${escapeHtml(t("backProjects"))}</button></section><section class="panel loading-state">${escapeHtml(t("loading"))}</section>`;
  document.querySelector("#back-projects").addEventListener("click", () => { activeProjectId = null; void renderProjects(); });
  try {
    const [project, taskResult] = await Promise.all([apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}`), apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks`)]);
    if (location.hash.slice(1) !== "projects" || activeProjectId !== projectId) return;
    content.innerHTML = `<section class="page-heading"><div><button class="text-button" id="back-projects">${escapeHtml(t("backProjects"))}</button><div class="eyebrow project-keyline">${escapeHtml(project.key)} · ${escapeHtml(project.status)}</div><h1>${escapeHtml(project.name)}</h1><p class="lead">${escapeHtml(project.description || t("projectDesc"))}</p></div></section><section class="panel tasks-panel"><div class="panel-heading"><div><div class="eyebrow">${escapeHtml(t("operations"))}</div><h2>${escapeHtml(t("tasks"))}</h2></div><span class="policy-tag">${taskResult.items.length} ${escapeHtml(t("taskCount"))}</span></div><form class="inline-task-form" id="task-create-form"><input name="title" required minlength="3" maxlength="200" placeholder="${escapeHtml(t("taskTitle"))}" /><input name="description" maxlength="20000" placeholder="${escapeHtml(t("taskDescription"))}" /><button class="primary-button" type="submit">＋ ${escapeHtml(t("createTask"))}</button></form><div class="task-list">${taskResult.items.length ? taskResult.items.map((task) => `<article class="task-row"><span class="task-marker">${task.status === "DONE" ? "✓" : "·"}</span><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.status)} · ${escapeHtml(task.priority)}</small></span></article>`).join("") : `<p class="empty-task">${escapeHtml(t("noData"))}</p>`}</div></section><section class="panel tasks-panel project-ai-panel"><div class="panel-heading"><div><div class="eyebrow">${escapeHtml(t("models"))}</div><h2>Run a project request</h2></div><span class="policy-tag">Verified free or self-hosted only</span></div><p class="panel-description">Requests use the central provider gateway. Only enabled models with verified free pricing or self-hosted classification are eligible. Unknown and paid models remain blocked.</p><form class="project-ai-form" id="project-ai-form"><label for="project-ai-prompt">Prompt</label><textarea id="project-ai-prompt" name="prompt" required minlength="1" maxlength="12000" rows="4" placeholder="Describe the task for the selected model"></textarea><button class="primary-button" type="submit">Run request</button></form><p class="error-state hidden" id="project-ai-error" role="status"></p><section class="provider-card hidden" id="project-ai-result" aria-live="polite"><strong id="project-ai-model"></strong><pre id="project-ai-output"></pre><small id="project-ai-usage"></small></section></section>`;
    document.querySelector("#back-projects").addEventListener("click", () => { activeProjectId = null; void renderProjects(); });
    document.querySelector("#task-create-form").addEventListener("submit", (event) => createTaskFromForm(event, projectId));
    const aiForm = document.querySelector("#project-ai-form");
    aiForm.insertAdjacentHTML("afterbegin", `<label for="project-ai-model-select">Model</label><div class="project-model-select"><span id="project-model-icon"></span><select id="project-ai-model-select" name="modelKey" required disabled><option value="">Loading eligible models…</option></select></div><small id="project-ai-model-hint" role="status">Only available models with verified free or self-hosted pricing and approved privacy are listed.</small>`);
    aiForm.addEventListener("submit", (event) => executeProjectRequest(event, projectId));
    document.querySelector("#project-ai-model-select").addEventListener("change", updateProjectModelMark);
    void loadProjectExecutionModels();
  } catch (error) { content.innerHTML = `<section class="panel loading-state error-state">${escapeHtml(error.message)}</section><button class="text-button" id="back-projects">${escapeHtml(t("backProjects"))}</button>`; document.querySelector("#back-projects").addEventListener("click", () => { activeProjectId = null; void renderProjects(); }); }
}

async function loadProjectExecutionModels() {
  const select = document.querySelector("#project-ai-model-select");
  const hint = document.querySelector("#project-ai-model-hint");
  const runButton = document.querySelector("#project-ai-form button[type=submit]");
  if (!select || !hint || !runButton) return;
  try {
    const models = await apiRequest("/api/v1/models");
    try { const providers = await apiRequest("/api/v1/providers"); for (const provider of providers.items) providerTypesByKey.set(provider.key, provider.providerType); } catch { /* labels fall back to neutral provider identity */ }
    if (!select.isConnected) return;
    const eligible = models.items.filter((model) => model.availability === "AVAILABLE" && model.privacyApproved === true && model.capabilities.includes("TEXT_GENERATION") && (model.billingMode === "SELF_HOSTED" || (model.billingMode === "FREE" && model.freeTierStatus === "VERIFIED_FREE")));
    select.innerHTML = eligible.length ? `<option value="">Select an eligible model</option>${eligible.map((model) => `<option value="${escapeHtml(model.key)}">${escapeHtml(providerIdentity(providerTypesByKey.get(model.providerKey)).name)} · ${escapeHtml(model.displayName)} · ${escapeHtml(model.billingMode === "SELF_HOSTED" ? "Self-hosted" : "Verified free")}</option>`).join("")}` : `<option value="">No eligible model available</option>`;
    select.disabled = eligible.length === 0;
    runButton.disabled = true;
    hint.textContent = eligible.length ? `${eligible.length} currently available model${eligible.length === 1 ? "" : "s"} meet the free-only and privacy policy. Select one before running.` : "No model currently meets the required availability, pricing, text-generation, and privacy policy.";
    select.dataset.modelTypes = JSON.stringify(Object.fromEntries(eligible.map((model) => [model.key, providerTypesByKey.get(model.providerKey) || "UNKNOWN"])));
  } catch (error) {
    select.innerHTML = `<option value="">Models could not be loaded</option>`;
    select.disabled = true;
    runButton.disabled = true;
    hint.textContent = `Model list unavailable: ${error.message}`;
  }
}

function updateProjectModelMark(event) {
  const select = event.currentTarget;
  const types = JSON.parse(select.dataset.modelTypes || "{}");
  const type = types[select.value];
  const mark = document.querySelector("#project-model-icon");
  const runButton = document.querySelector("#project-ai-form button[type=submit]");
  if (mark) mark.innerHTML = type ? providerMark(type, `${providerIdentity(type).name} provider`) : "";
  if (runButton) runButton.disabled = !select.value;
}

async function executeProjectRequest(event, projectId) {
  event.preventDefault();
  const form = event.currentTarget;
  const prompt = new FormData(form).get("prompt");
  const button = form.querySelector("button[type=submit]");
  const error = document.querySelector("#project-ai-error");
  const resultPanel = document.querySelector("#project-ai-result");
  button.disabled = true;
  error.classList.add("hidden");
  resultPanel.classList.add("hidden");
  try {
    const result = await apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/ai/execute`, {
      method: "POST",
      body: {
        selection: { capabilities: ["TEXT_GENERATION"], modelKey: new FormData(form).get("modelKey"), requireFree: true, requirePrivacyApproved: true },
        operation: "CHAT",
        messages: [{ role: "user", content: prompt }],
        parameters: { max_tokens: 1024 },
        requestId: `web-${crypto.randomUUID()}`,
        maxFallbacks: 0,
      },
    });
    if (!resultPanel.isConnected) return;
    document.querySelector("#project-ai-model").innerHTML = `${providerMark(providerTypesByKey.get(result.providerKey), `${result.providerKey} provider`)} ${escapeHtml(result.providerKey)} · ${escapeHtml(result.modelKey)}`;
    document.querySelector("#project-ai-output").textContent = typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2);
    document.querySelector("#project-ai-usage").textContent = result.usage ? `Usage: ${result.usage.totalTokens ?? "unknown"} tokens` : "Usage was not returned by the provider";
    resultPanel.classList.remove("hidden");
  } catch (requestError) {
    if (error.isConnected) { error.textContent = requestError.message; error.classList.remove("hidden"); }
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function createTaskFromForm(event, projectId) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try { await apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks`, { method: "POST", body: values }); showToast(t("taskCreated")); await renderProjectDetail(projectId); }
  catch (error) { showToast(error.message); }
}

async function renderProviders() {
  renderSection("providers", t("providerTitle"), "⌘");
  const section = content.querySelector(".section-status");
  if (!authState) { section.insertAdjacentHTML("beforeend", `<button class="primary-button" id="providers-sign-in">${escapeHtml(t("signIn"))}</button>`); document.querySelector("#providers-sign-in").addEventListener("click", () => openAuth("login")); return; }
  content.querySelector(".page-heading")?.insertAdjacentHTML("beforeend", `<button class="primary-button" id="provider-create-toggle-top">＋ ${escapeHtml(t("providerCreate"))}</button>`);
  document.querySelector("#provider-create-toggle-top")?.addEventListener("click", () => document.querySelector("#provider-create-form")?.classList.toggle("hidden"));
  try {
    const result = await apiRequest("/api/v1/providers");
    providerTypesByKey.clear();
    for (const provider of result.items) providerTypesByKey.set(provider.key, provider.providerType);
    if (!section.isConnected) return;
    section.innerHTML = `<h2>${escapeHtml(result.items.length)} ${escapeHtml(t("providers"))}</h2><p>Connection tests perform provider health/model discovery only; they do not invoke model inference.</p><form class="provider-create-form hidden" id="provider-create-form"><input name="name" required minlength="2" placeholder="${escapeHtml(t("providerName"))}"/><input name="key" required pattern="[a-z0-9][a-z0-9._-]{1,99}" placeholder="${escapeHtml(t("providerKey"))}"/><select name="providerType"><option value="OPENAI_COMPATIBLE">OpenAI-compatible</option><option value="LOCAL_OPENAI_COMPATIBLE">Local OpenAI-compatible</option></select><input name="baseUrl" type="url" required placeholder="${escapeHtml(t("providerBaseUrl"))}"/><input name="apiKey" type="password" autocomplete="new-password" placeholder="${escapeHtml(t("providerApiKey"))}"/><button class="primary-button" type="submit">${escapeHtml(t("create"))}</button></form>${result.items.length ? `<div class="provider-list">${result.items.map((provider) => `<article class="provider-card" data-provider-id="${escapeHtml(provider.id)}"><div class="provider-heading"><div class="task-row provider-title-row">${providerMark(provider.providerType, provider.displayName)}<span class="task-marker">${provider.enabled ? "●" : "○"}</span><span><strong>${escapeHtml(provider.displayName)}</strong><small>${escapeHtml(providerIdentity(provider.providerType).name)} · ${escapeHtml(provider.status)} · Pricing: ${escapeHtml(provider.billingMode || "UNKNOWN")}</small></span></div><div class="provider-actions"><button class="text-button provider-test" data-id="${escapeHtml(provider.id)}">${escapeHtml(t("testConnection"))}</button><button class="text-button provider-toggle" data-id="${escapeHtml(provider.id)}" data-enabled="${provider.enabled}">${escapeHtml(provider.enabled ? t("disable") : t("enable"))}</button></div></div><p class="provider-error hidden" id="provider-error-${escapeHtml(provider.id)}"></p><details><summary>Edit connection settings and credentials</summary><form class="provider-create-form provider-edit-form" data-id="${escapeHtml(provider.id)}"><label>Display name<input name="name" required value="${escapeHtml(provider.displayName)}"/></label><label>Endpoint URL<input name="baseUrl" type="url" required value="${escapeHtml(provider.baseUrl)}"/></label><label>Connection billing classification<select name="billingMode">${["UNKNOWN", "SELF_HOSTED", "FREE", "FREE_LIMITED", "FREE_TRIAL", "PAY_PER_TOKEN", "PAY_PER_REQUEST", "SUBSCRIPTION"].map((value) => `<option value="${value}" ${provider.billingMode === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Free tier verification<select name="freeTierStatus">${["UNKNOWN", "VERIFIED_FREE", "VERIFIED_LIMITED", "TRIAL", "PAID"].map((value) => `<option value="${value}" ${provider.freeTierStatus === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Rotate API key<input name="apiKey" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"/></label><button class="primary-button" type="submit">Save connection settings</button></form></details><details><summary>${escapeHtml(t("models"))}</summary><div class="provider-model-list" id="provider-models-${escapeHtml(provider.id)}"><button class="text-button provider-load-models" data-id="${escapeHtml(provider.id)}">${escapeHtml(t("loadModels"))}</button></div></details><details><summary>${escapeHtml(t("addModelMetadata"))}</summary><form class="provider-create-form model-config-form" data-provider-id="${escapeHtml(provider.id)}"><input name="modelId" required placeholder="${escapeHtml(t("modelId"))}"/><input name="displayName" required placeholder="${escapeHtml(t("modelTitle"))}"/><input name="capabilities" placeholder="${escapeHtml(t("capabilitiesCsv"))}"/><select name="billingMode"><option value="UNKNOWN">UNKNOWN</option><option value="SELF_HOSTED">SELF_HOSTED</option><option value="FREE">FREE</option><option value="FREE_LIMITED">FREE_LIMITED</option><option value="PAY_PER_TOKEN">PAY_PER_TOKEN</option><option value="PAY_PER_REQUEST">PAY_PER_REQUEST</option><option value="SUBSCRIPTION">SUBSCRIPTION</option></select><select name="freeTierStatus"><option value="UNKNOWN">UNKNOWN</option><option value="VERIFIED_FREE">VERIFIED_FREE</option><option value="VERIFIED_LIMITED">VERIFIED_LIMITED</option><option value="PAID">PAID</option></select><input name="inputPricePerMillion" type="number" min="0" step="any" placeholder="${escapeHtml(t("inputPrice"))}"/><input name="outputPricePerMillion" type="number" min="0" step="any" placeholder="${escapeHtml(t("outputPrice"))}"/><input name="contextWindow" type="number" min="1" placeholder="${escapeHtml(t("contextWindow"))}"/><input name="maxOutputTokens" type="number" min="1" placeholder="${escapeHtml(t("maxOutputTokens"))}"/><input name="officialDocumentationUrl" type="url" placeholder="${escapeHtml(t("documentationUrl"))}"/><button class="primary-button" type="submit">${escapeHtml(t("saveModel"))}</button></form></details></article>`).join("")}</div>` : `<div class="empty-illustration">⌘</div><h2>${escapeHtml(t("noData"))}</h2><p>${escapeHtml(t("emptyText"))}</p>`}`;
    const providerForm = document.querySelector("#provider-create-form");
    const connectorSelect = providerForm.querySelector("select[name=providerType]");
    for (const [name, label] of [["name", "Provider display name"], ["key", "Provider key"], ["baseUrl", "Provider endpoint URL"], ["apiKey", "Provider API key"], ["billingMode", "Provider pricing classification"], ["freeTierStatus", "Provider free-tier verification"]]) providerForm.elements[name]?.setAttribute("aria-label", label);
    connectorSelect.setAttribute("aria-label", "Provider connector type");
    const connectorPicker = document.createElement("div");
    connectorPicker.className = "provider-connector-picker";
    const connectorMark = document.createElement("span");
    connectorMark.id = "provider-connector-mark";
    connectorPicker.append(connectorMark);
    connectorSelect.before(connectorPicker);
    connectorPicker.append(connectorSelect);
    const refreshConnectorMark = () => { connectorMark.innerHTML = providerMark(connectorSelect.value, `${providerIdentity(connectorSelect.value).name} connector`); };
    connectorSelect.addEventListener("change", refreshConnectorMark);
    refreshConnectorMark();
    for (const provider of result.items) {
      const card = section.querySelector(`[data-provider-id="${CSS.escape(provider.id)}"]`);
      if (!card) continue;
      const health = document.createElement("p");
      health.className = "provider-health";
      health.textContent = provider.lastErrorCode
        ? `Last connection error: ${provider.lastErrorCode}`
        : provider.lastSuccessfulTest
          ? `Last connection test passed: ${new Date(provider.lastSuccessfulTest).toLocaleString("en")}`
          : "Connection has not been tested.";
      card.querySelector(".provider-error")?.before(health);
    }
    providerForm.querySelector("button[type=submit]")?.insertAdjacentHTML("beforebegin", `<select name="billingMode"><option value="UNKNOWN">Provider billing unknown</option><option value="SELF_HOSTED">Self-hosted</option><option value="FREE">Free (verify provider pricing first)</option></select><select name="freeTierStatus"><option value="UNKNOWN">Provider tier unknown</option><option value="VERIFIED_FREE">Verified free</option></select>`);
    providerForm.addEventListener("submit", createProviderFromForm);
    section.querySelectorAll(".provider-edit-form").forEach((form) => form.addEventListener("submit", saveProviderSettings));
    section.querySelectorAll(".model-config-form").forEach((form) => {
      form.querySelector("button[type=submit]")?.insertAdjacentHTML("beforebegin", `<label><input name="privacyApproved" type="checkbox"/>${escapeHtml(t("privacyReviewed"))}</label>`);
      for (const field of form.querySelectorAll("input,select")) if (field.name && field.name !== "privacyApproved") field.setAttribute("aria-label", field.placeholder || field.name);
      form.addEventListener("submit", saveModelMetadata);
    });
    section.querySelectorAll(".provider-test").forEach((button) => button.addEventListener("click", () => testProviderConnection(button.dataset.id)));
    section.querySelectorAll(".provider-toggle").forEach((button) => button.addEventListener("click", () => toggleProvider(button.dataset.id, button.dataset.enabled === "true")));
    section.querySelectorAll(".provider-load-models").forEach((button) => button.addEventListener("click", () => loadProviderModels(button.dataset.id)));
  } catch (error) { if (section.isConnected) section.insertAdjacentHTML("beforeend", `<p class="error-state">${escapeHtml(error.message)}</p>`); }
}

async function testProviderConnection(providerId) {
  try {
    const result = await apiRequest(`/api/v1/providers/${encodeURIComponent(providerId)}/test-connection`, { method: "POST", body: {} });
    if (!result.available) throw new Error(result.errorCode || "PROVIDER_CONNECTION_FAILED");
    showToast(`${t("connectionTestPassed")}: ${result.discoveredModels}`);
    await loadProviderModels(providerId);
  } catch (error) {
    const output = document.querySelector(`#provider-error-${CSS.escape(providerId)}`);
    if (output) { output.textContent = error.message; output.classList.remove("hidden"); }
    else showToast(error.message);
  }
}

async function toggleProvider(providerId, enabled) {
  try {
    await apiRequest(`/api/v1/providers/${encodeURIComponent(providerId)}/${enabled ? "disable" : "enable"}`, { method: "POST", body: {} });
    showToast(t(enabled ? "providerDisabled" : "providerEnabled"));
    await renderProviders();
  } catch (error) { showToast(error.message); }
}

async function saveProviderSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  try {
    await apiRequest(`/api/v1/providers/${encodeURIComponent(form.dataset.id)}`, { method: "PATCH", body: { name: values.name, baseUrl: values.baseUrl, billingMode: values.billingMode, freeTierStatus: values.freeTierStatus } });
    if (values.apiKey) await apiRequest(`/api/v1/providers/${encodeURIComponent(form.dataset.id)}/rotate-key`, { method: "POST", body: { apiKey: values.apiKey } });
    showToast("Provider settings saved. Credentials remain server-side.");
    await renderProviders();
  } catch (error) { showToast(error.message); }
}

async function loadProviderModels(providerId) {
  const holder = document.querySelector(`#provider-models-${CSS.escape(providerId)}`);
  if (!holder) return;
  holder.textContent = t("loading");
  try {
    const result = await apiRequest(`/api/v1/providers/${encodeURIComponent(providerId)}/models`);
    if (!holder.isConnected) return;
    holder.innerHTML = result.items.length ? result.items.map((model) => `<article class="provider-model"><div><strong>${escapeHtml(model.displayName)}</strong><small>${escapeHtml(model.modelId)} · ${escapeHtml(model.availability)} · ${escapeHtml(model.billingMode)} · ${escapeHtml(model.freeTierStatus)}</small><small>${escapeHtml((Array.isArray(model.capabilities) ? model.capabilities : []).join(", ") || t("capabilitiesUnverified"))}</small><small>${escapeHtml(model.inputPricePerMillion ?? "?")} / ${escapeHtml(model.outputPricePerMillion ?? "?")} · ${escapeHtml(t("perMillionTokens"))}</small></div><button class="text-button model-toggle" data-provider="${escapeHtml(providerId)}" data-model="${escapeHtml(model.modelId)}" data-enabled="${model.enabled}">${escapeHtml(model.enabled ? t("disable") : t("enable"))}</button></article>`).join("") : `<p>${escapeHtml(t("noModelsDiscovered"))}</p>`;
    holder.querySelectorAll(".model-toggle").forEach((button) => button.addEventListener("click", () => toggleProviderModel(button.dataset.provider, button.dataset.model, button.dataset.enabled === "true")));
    holder.querySelectorAll(".provider-model").forEach((row, index) => {
      const model = result.items[index];
      if (!model) return;
      const visibility = document.createElement("button");
      visibility.className = "text-button model-visibility-toggle";
      visibility.textContent = model.visible ? t("hide") : t("show");
      visibility.addEventListener("click", () => toggleProviderModelVisibility(providerId, model.modelId, model.visible));
      row.append(visibility);
    });
  } catch (error) { if (holder.isConnected) holder.textContent = error.message; }
}

async function toggleProviderModel(providerId, modelId, enabled) {
  try {
    await apiRequest(`/api/v1/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/${enabled ? "disable" : "enable"}`, { method: "POST", body: {} });
    showToast(t(enabled ? "modelDisabled" : "modelEnabled"));
    await loadProviderModels(providerId);
  } catch (error) { showToast(error.message); }
}

async function toggleProviderModelVisibility(providerId, modelId, visible) {
  try {
    await apiRequest(`/api/v1/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/${visible ? "hide" : "show"}`, { method: "POST", body: {} });
    showToast(t(visible ? "modelHidden" : "modelShown"));
    await loadProviderModels(providerId);
  } catch (error) { showToast(error.message); }
}

async function renderModels() {
  renderSection("models", t("modelTitle"), "◈");
  const section = content.querySelector(".section-status");
  if (!authState) { section.insertAdjacentHTML("beforeend", `<button class="primary-button" id="models-sign-in">${escapeHtml(t("signIn"))}</button>`); document.querySelector("#models-sign-in").addEventListener("click", () => openAuth("login")); return; }
  try {
    const [result, policy] = await Promise.all([
      apiRequest("/api/v1/models"),
      apiRequest("/api/v1/model-policies"),
    ]);
    let platformPolicy = null;
    try { platformPolicy = await apiRequest("/api/v1/platform/model-policies"); } catch { /* workspace owners do not receive platform controls */ }
    if (!section.isConnected) return;
    const platformControls = platformPolicy ? `<form class="provider-create-form platform-policy-form" id="platform-model-policy-form"><h2>${escapeHtml(t("platformPolicy"))}</h2>${["freeModelsEnabled", "paidModelsEnabled", "localModelsEnabled", "customProvidersEnabled", "automaticDiscovery", "automaticRefresh"].map((key) => `<label><input type="checkbox" name="${key}" ${platformPolicy[key] ? "checked" : ""}/> ${escapeHtml(t(key))}</label>`).join("")}<label>${escapeHtml(t("monthlyCostLimit"))}<input name="monthlyCostLimit" type="number" min="0" step="0.01" value="${escapeHtml(platformPolicy.monthlyCostLimit ?? "")}"/></label><small>${escapeHtml(t("paidSpendBlocked"))}</small><button class="primary-button" type="submit">${escapeHtml(t("save"))}</button></form>` : "";
    try { const providersResult = await apiRequest("/api/v1/providers"); for (const provider of providersResult.items) providerTypesByKey.set(provider.key, provider.providerType); } catch { /* model records remain useful with neutral provider labels */ }
    section.innerHTML = `<form class="provider-create-form" id="model-policy-form"><h2>${escapeHtml(t("workspacePolicy"))}</h2><label><input type="checkbox" name="freeModelsEnabled" ${policy.freeModelsEnabled ? "checked" : ""}/> ${escapeHtml(t("enableFreeModels"))}</label><label><input type="checkbox" name="paidModelsEnabled" ${policy.paidModelsEnabled ? "checked" : ""}/> ${escapeHtml(t("enablePaidModels"))}</label><small>${escapeHtml(t("paidSpendBlocked"))}</small><button class="primary-button" type="submit">${escapeHtml(t("save"))}</button></form>${platformControls}${result.items.length ? `<div class="model-table">${result.items.map((model) => `<article class="model-row"><div class="model-title-with-icon">${providerMark(providerTypesByKey.get(model.providerKey), `${model.providerKey} provider`)}<strong>${escapeHtml(model.displayName)}</strong></div><span>${escapeHtml(model.providerKey)} · ${escapeHtml(model.availability)}</span><small>${escapeHtml(model.capabilities.join(", "))}</small><small>Pricing: ${escapeHtml(model.billingMode || "UNKNOWN")} · Free-tier status: ${escapeHtml(model.freeTierStatus || "UNKNOWN")}</small></article>`).join("")}</div>` : `<div class="empty-illustration">◈</div><h2>${escapeHtml(t("noEnabledModels"))}</h2><p>${escapeHtml(t("modelsNeedHealth"))}</p>`}`;
    section.querySelector("#model-policy-form").addEventListener("submit", saveModelPolicy);
    section.querySelector("#platform-model-policy-form")?.addEventListener("submit", savePlatformModelPolicy);
  } catch (error) { if (section.isConnected) section.insertAdjacentHTML("beforeend", `<p class="error-state">${escapeHtml(error.message)}</p>`); }
}

async function saveModelPolicy(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = {
    freeModelsEnabled: form.elements.freeModelsEnabled.checked,
    paidModelsEnabled: form.elements.paidModelsEnabled.checked,
  };
  try {
    await apiRequest("/api/v1/model-policies", { method: "PUT", body });
    showToast(t("modelPolicySaved"));
    await renderModels();
  } catch (error) { showToast(error.message); }
}

async function savePlatformModelPolicy(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(["freeModelsEnabled", "paidModelsEnabled", "localModelsEnabled", "customProvidersEnabled", "automaticDiscovery", "automaticRefresh"].map((key) => [key, form.elements[key].checked]));
  body.monthlyCostLimit = form.elements.monthlyCostLimit.value ? Number(form.elements.monthlyCostLimit.value) : null;
  try {
    await apiRequest("/api/v1/platform/model-policies", { method: "PUT", body });
    showToast(t("platformPolicySaved"));
    await renderModels();
  } catch (error) { showToast(error.message); }
}

async function saveModelMetadata(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const body = { modelId: values.modelId, displayName: values.displayName, capabilities: values.capabilities.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean), billingMode: values.billingMode, freeTierStatus: values.freeTierStatus, privacyApproved: values.privacyApproved === "on", ...(values.inputPricePerMillion ? { inputPricePerMillion: Number(values.inputPricePerMillion) } : {}), ...(values.outputPricePerMillion ? { outputPricePerMillion: Number(values.outputPricePerMillion) } : {}), ...(values.contextWindow ? { contextWindow: Number(values.contextWindow) } : {}), ...(values.maxOutputTokens ? { maxOutputTokens: Number(values.maxOutputTokens) } : {}), ...(values.officialDocumentationUrl ? { officialDocumentationUrl: values.officialDocumentationUrl } : {}) };
  try { await apiRequest(`/api/v1/providers/${encodeURIComponent(form.dataset.providerId)}/models`, { method: "POST", body }); showToast(t("modelMetadataSaved")); form.reset(); }
  catch (error) { showToast(error.message); }
}

async function createProviderFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  body.timeoutMs = 15000; body.maxRetries = 1; body.authenticationType = body.apiKey ? "BEARER" : "NONE"; body.billingMode ||= "UNKNOWN"; body.freeTierStatus ||= "UNKNOWN"; body.customHeaders = {}; body.metadata = {}; body.pricingMetadata = {}; body.privacyMetadata = {};
  try { await apiRequest("/api/v1/providers", { method: "POST", body }); showToast(t("providerSaved")); await renderProviders(); }
  catch (error) { showToast(error.message); }
}

function bindRouteButtons() { content.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => { location.hash = button.dataset.route; })); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
let toastTimer;
function showToast(message) { toast.textContent = message; toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 2100); }

window.addEventListener("hashchange", () => { render(); document.querySelector("#sidebar").classList.remove("open"); });
document.querySelector("#theme-toggle").addEventListener("click", () => { theme = theme === "dark" ? "light" : "dark"; localStorage.setItem("freeai-theme", theme); applyPreferences(); showToast(t("themeChanged")); });
document.querySelector("#menu-toggle").addEventListener("click", () => { document.querySelector("#sidebar").classList.toggle("open"); });
document.querySelector(".help-button").addEventListener("click", () => showToast(t("apiBoundaryText")));
for (const id of ["public-login", "public-login-hero"]) document.querySelector(`#${id}`)?.addEventListener("click", () => openAuth("login"));
applyPreferences();
void checkApiHealth();
void restoreSession();
