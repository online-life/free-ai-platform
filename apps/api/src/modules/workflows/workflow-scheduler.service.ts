export interface ScheduledWorkflow {
  tenantId: string;
  workflowId: string;
  projectId: string;
  scheduledAt: Date;
  enabled: boolean;
}

export interface WorkflowScheduleRepository {
  create(schedule: ScheduledWorkflow): Promise<unknown>;
  listDue(now: Date): Promise<ScheduledWorkflow[]>;
  markTriggered(schedule: ScheduledWorkflow): Promise<void>;
}

export class WorkflowSchedulerService {
  constructor(private readonly repository: WorkflowScheduleRepository) {}

  async schedule(input: ScheduledWorkflow) {
    if (!input.tenantId || !input.workflowId || !input.projectId) {
      throw new Error("SCHEDULE_SCOPE_REQUIRED");
    }
    if (Number.isNaN(input.scheduledAt.getTime())) {
      throw new Error("SCHEDULE_DATE_INVALID");
    }
    return this.repository.create(input);
  }

  async due(now = new Date()) {
    return this.repository.listDue(now);
  }
}
