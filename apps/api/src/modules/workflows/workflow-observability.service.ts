export interface WorkflowTraceEvent {
  tenantId: string;
  runId: string;
  stepId?: string;
  event: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface WorkflowTraceRepository {
  append(event: WorkflowTraceEvent): Promise<void>;
  list(tenantId: string, runId: string): Promise<WorkflowTraceEvent[]>;
}

export class WorkflowObservabilityService {
  constructor(private readonly repository: WorkflowTraceRepository) {}

  async record(event: WorkflowTraceEvent) {
    if (!event.tenantId || !event.runId || !event.event) {
      throw new Error("WORKFLOW_TRACE_INVALID");
    }
    await this.repository.append(event);
  }

  async timeline(tenantId: string, runId: string) {
    return this.repository.list(tenantId, runId);
  }
}
