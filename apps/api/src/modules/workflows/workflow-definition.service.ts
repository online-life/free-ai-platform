import { WorkflowDefinitionSchema } from "./workflow.schemas";
import type { WorkflowActor, WorkflowRecord, WorkflowRepository } from "./workflow.types";

export class WorkflowDefinitionService {
  constructor(private readonly repository: WorkflowRepository) {}

  async create(tenantId: string, actorId: string, raw: unknown, projectId?: string): Promise<WorkflowRecord> {
    const definition = WorkflowDefinitionSchema.parse(raw);
    this.assertAcyclic(definition.steps);
    return this.repository.createWorkflow(tenantId, actorId, definition, projectId);
  }

  async publish(actor: WorkflowActor, workflowId: string, raw: unknown, projectId?: string) {
    const definition = WorkflowDefinitionSchema.parse(raw);
    this.assertAcyclic(definition.steps);
    return this.repository.createVersion(actor.tenantId, actor.userId, workflowId, definition, projectId);
  }

  async activate(actor: WorkflowActor, workflowId: string, projectId?: string) {
    await this.repository.setStatus(actor.tenantId, actor.userId, workflowId, "ACTIVE", projectId);
    return { workflowId, status: "ACTIVE" as const };
  }

  private assertAcyclic(
    steps: Array<{ id: string; dependsOn: string[] }>,
  ) {
    const graph = new Map(steps.map((step) => [step.id, step.dependsOn]));
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error("WORKFLOW_DEPENDENCY_CYCLE");
      if (visited.has(id)) return;

      visiting.add(id);
      for (const dependency of graph.get(id) ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };

    for (const step of steps) visit(step.id);
  }
}
