import { describe, expect, it } from "vitest";
import { providerIdentity, providerIdentityRegistry, providerMark } from "../../apps/web/src/provider-identity.js";

describe("provider identity registry", () => {
  it("contains only API-supported connector types and does not claim verified logos", () => {
    expect(Object.keys(providerIdentityRegistry).sort()).toEqual([
      "LOCAL_OPENAI_COMPATIBLE", "OPENAI_COMPATIBLE",
    ]);
    expect(Object.values(providerIdentityRegistry).every((entry) => entry.verification === "Connector type")).toBe(true);
    expect(providerIdentity("UNSUPPORTED").verification).toBe("Unverified");
  });

  it("renders an accessible neutral fallback identity", () => {
    const markup = providerMark("UNSUPPORTED", "Unknown endpoint");
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Unknown endpoint"');
    expect(markup).toContain("<svg");
  });
});
