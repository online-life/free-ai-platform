import { describe, expect, it } from "vitest";
import { ProviderDefinitionSchema } from "../../apps/api/src/modules/providers/provider.schemas";
import { OpenAICompatibleAdapter } from "../../apps/api/src/modules/providers/openai-compatible.adapter";

const definition = (overrides: Record<string, unknown> = {}) => ({
  key: "test-provider",
  name: "Test Provider",
  providerType: "OPENAI_COMPATIBLE",
  baseUrl: "https://provider.example/v1",
  authenticationType: "BEARER",
  customHeaders: {},
  ...overrides,
});

describe("provider endpoint configuration security", () => {
  it("rejects loopback endpoints under the public connector", () => {
    expect(() => ProviderDefinitionSchema.parse(definition({ baseUrl: "http://127.0.0.1:11434/v1" }))).toThrow();
    expect(() => ProviderDefinitionSchema.parse(definition({ providerType: "OPENAI_COMPATIBLE", baseUrl: "https://localhost/v1" }))).toThrow();
  });

  it("requires explicit loopback for local connectors", () => {
    expect(() => ProviderDefinitionSchema.parse(definition({ providerType: "LOCAL_OPENAI_COMPATIBLE", baseUrl: "https://provider.example/v1" }))).toThrow();
    expect(ProviderDefinitionSchema.parse(definition({ providerType: "LOCAL_OPENAI_COMPATIBLE", baseUrl: "http://127.0.0.1:11434/v1" }))).toMatchObject({ providerType: "LOCAL_OPENAI_COMPATIBLE" });
  });

  it("rejects private IP literals and prevents local requests through the generic adapter", () => {
    expect(() => ProviderDefinitionSchema.parse(definition({ baseUrl: "https://10.0.0.5/v1" }))).toThrow();
    expect(() => new OpenAICompatibleAdapter("test-provider", "http://127.0.0.1:11434/v1")).toThrow("PROVIDER_LOCAL_ENDPOINT_NOT_ALLOWED");
  });
});
