export interface ApprovalRepository {
  create(input: {
    tenantId: string;
    projectId: string;
    runId: string;
    stepId: string;
    requestedById: string;
  }): Promise<{ id: string }>;
  find(tenantId: string, projectId: string, approvalId: string): Promise<{
    id: string;
    runId: string;
    stepId: string;
    status: string;
  } | null>;
  decide(
    tenantId: string,
    projectId: string,
    approvalId: string,
    actorId: string,
    decision: "APPROVED" | "REJECTED",
    comment?: string,
  ): Promise<void>;
}

export class WorkflowApprovalService {
  constructor(private readonly repository: ApprovalRepository) {}

  async request(
    tenantId: string,
    projectId: string,
    runId: string,
    stepId: string,
    requestedById: string,
  ) {
    return this.repository.create({
      tenantId,
      projectId,
      runId,
      stepId,
      requestedById,
    });
  }

  async decide(
    tenantId: string,
    projectId: string,
    approvalId: string,
    actorId: string,
    decision: "APPROVED" | "REJECTED",
    comment?: string,
  ) {
    const approval = await this.repository.find(tenantId, projectId, approvalId);
    if (!approval) throw new Error("APPROVAL_NOT_FOUND");
    if (approval.status !== "PENDING") {
      throw new Error("APPROVAL_ALREADY_DECIDED");
    }

    await this.repository.decide(
      tenantId,
      projectId,
      approvalId,
      actorId,
      decision,
      comment,
    );

    return { approvalId, decision };
  }
}
