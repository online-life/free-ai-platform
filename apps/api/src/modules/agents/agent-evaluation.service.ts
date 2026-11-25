export interface AgentEvaluationInput {
  agentId: string;
  version: string;
  testCaseId: string;
  score: number;
  passed: boolean;
  durationMs: number;
  metrics?: Record<string, number>;
  notes?: string;
  evaluatedById?: string;
}

export interface AgentEvaluationRepository {
  save(tenantId: string, input: AgentEvaluationInput): Promise<unknown>;
  history(tenantId: string, agentId: string): Promise<unknown[]>;
}

export class AgentEvaluationService {
  constructor(private readonly repository: AgentEvaluationRepository) {}

  async record(tenantId: string, input: AgentEvaluationInput) {
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
      throw new Error("INVALID_EVALUATION_SCORE");
    }

    if (!Number.isSafeInteger(input.durationMs) || input.durationMs < 0 || input.durationMs > 86_400_000) {
      throw new Error("INVALID_EVALUATION_DURATION");
    }
    if (!input.agentId || !input.version || !input.testCaseId || input.testCaseId.length > 160) {
      throw new Error("INVALID_EVALUATION_CASE");
    }

    return this.repository.save(tenantId, input);
  }

  async history(tenantId: string, agentId: string) {
    return this.repository.history(tenantId, agentId);
  }
}
