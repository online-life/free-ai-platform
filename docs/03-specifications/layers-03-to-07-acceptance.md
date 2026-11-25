# Layers 03–07 Acceptance Checklist

## Layer 03 — Agent Ecosystem
- [ ] Agent keys are unique within tenant scope.
- [ ] Definitions are versioned.
- [ ] Only active agents can be selected.
- [ ] Required capabilities are enforced.
- [ ] Evaluations are stored and queryable.
- [ ] Agent instructions cannot bypass execution policies.

## Layer 04 — Model Intelligence
- [ ] Model capabilities are validated.
- [ ] Context and output limits are enforced.
- [ ] Free-only mode excludes paid models.
- [ ] Disabled models are never selected.
- [ ] Model selection is explainable.
- [ ] Model health affects availability decisions.

## Layer 05 — Provider Gateway
- [ ] All model API calls pass through the unified gateway.
- [ ] Provider credentials are resolved from secret references.
- [ ] Credentials never appear in logs or responses.
- [ ] Provider quotas are enforced.
- [ ] Timeouts and failures are recorded.
- [ ] Paid providers are excluded when free-only policy is enabled.

## Layer 06 — Execution Engine
- [ ] Every execution is tenant and project scoped.
- [ ] Project authorization is checked before execution.
- [ ] Tools are registered and policy-controlled.
- [ ] Sensitive tools require explicit approval.
- [ ] Host execution of untrusted code is prohibited.
- [ ] Resource limits and cancellation are enforced.
- [ ] Artifacts reference Layer 01 storage.

## Layer 07 — Workflow
- [ ] Workflow dependencies are acyclic.
- [ ] Workflow definitions are versioned.
- [ ] Runs use idempotency keys.
- [ ] Approval pauses execution.
- [ ] No automatic approval occurs.
- [ ] Resume uses persisted state.
- [ ] Cancellation and failures are traceable.
- [ ] Tenant isolation is tested.

## Cross-layer integration
- [ ] Layer 03 uses Layer 04 for model selection.
- [ ] Layer 04 does not call providers directly.
- [ ] Layer 05 is the exclusive provider API gateway.
- [ ] Layer 06 is the exclusive execution boundary.
- [ ] Layer 07 orchestrates layers without bypassing their contracts.
- [ ] Layer 01 audit, identity, secrets and tenant isolation are integrated.
