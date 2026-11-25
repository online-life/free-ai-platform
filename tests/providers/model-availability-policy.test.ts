import { describe, expect, it } from "vitest";
import { isModelVisibleUnderPolicy } from "../../apps/api/src/modules/model-intelligence/prisma-model.repository";

describe("global model visibility policy", () => {
  const free = { billingMode: "FREE" as const, freeTierStatus: "VERIFIED_FREE" as const };
  const paid = { billingMode: "PAY_PER_TOKEN" as const, freeTierStatus: "PAID" as const };
  const unknown = { billingMode: "UNKNOWN" as const, freeTierStatus: "UNKNOWN" as const };

  it("keeps free and paid visibility independent", () => {
    expect(isModelVisibleUnderPolicy(free, { freeModelsEnabled: true, paidModelsEnabled: false, platformFreeModelsEnabled: true })).toBe(true);
    expect(isModelVisibleUnderPolicy(paid, { freeModelsEnabled: true, paidModelsEnabled: false, platformPaidModelsEnabled: true })).toBe(false);
    expect(isModelVisibleUnderPolicy(free, { freeModelsEnabled: false, paidModelsEnabled: true, platformFreeModelsEnabled: true })).toBe(false);
    expect(isModelVisibleUnderPolicy(paid, { freeModelsEnabled: false, paidModelsEnabled: true, platformPaidModelsEnabled: true })).toBe(true);
  });

  it("hides every class when both controls are off and never treats unknown as free", () => {
    expect(isModelVisibleUnderPolicy(free, { freeModelsEnabled: false, paidModelsEnabled: false })).toBe(false);
    expect(isModelVisibleUnderPolicy(paid, { freeModelsEnabled: false, paidModelsEnabled: false })).toBe(false);
    expect(isModelVisibleUnderPolicy(unknown, { freeModelsEnabled: true, paidModelsEnabled: true, platformFreeModelsEnabled: true, platformPaidModelsEnabled: true })).toBe(false);
  });

  it("requires both platform and tenant switches, and a separate local-model policy", () => {
    expect(isModelVisibleUnderPolicy(free, { freeModelsEnabled: true, paidModelsEnabled: true, platformFreeModelsEnabled: false })).toBe(false);
    expect(isModelVisibleUnderPolicy({ billingMode: "SELF_HOSTED", freeTierStatus: "UNKNOWN" }, { freeModelsEnabled: true, paidModelsEnabled: true, localModelsEnabled: true })).toBe(true);
    expect(isModelVisibleUnderPolicy({ billingMode: "SELF_HOSTED", freeTierStatus: "UNKNOWN" }, { freeModelsEnabled: true, paidModelsEnabled: true, localModelsEnabled: false })).toBe(false);
  });
});
