// Only connector types that exist in the API registry are listed here. These
// are neutral type marks, not provider logos or claims of native integrations.
export const providerIdentityRegistry = Object.freeze({
  OPENAI_COMPATIBLE: Object.freeze({ id: "OPENAI_COMPATIBLE", name: "OpenAI-compatible API", integrationType: "Compatible endpoint", verification: "Connector type" }),
  LOCAL_OPENAI_COMPATIBLE: Object.freeze({ id: "LOCAL_OPENAI_COMPATIBLE", name: "Local OpenAI-compatible server", integrationType: "Self-hosted connector", verification: "Connector type" }),
});

export function providerIdentity(type) {
  return providerIdentityRegistry[type] ?? Object.freeze({ id: "UNKNOWN", name: "Unverified provider", integrationType: "Unknown connection", verification: "Unverified" });
}

export function providerMark(type, label) {
  const identity = providerIdentity(type);
  return `<span class="provider-identity-mark" role="img" aria-label="${escapeAttribute(label || identity.name)}" title="${escapeAttribute(identity.name)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"></circle><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5s-1.1 6.2-3.3 8.5c-2.2-2.3-3.3-5.1-3.3-8.5s1.1-6.2 3.3-8.5Z"></path></svg></span>`;
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
