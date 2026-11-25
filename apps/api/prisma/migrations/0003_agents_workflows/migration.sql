-- AlterTable
ALTER TABLE "secrets" ALTER COLUMN "scope_key" SET DEFAULT '_';



-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_versions" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "agentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "changelog" TEXT NOT NULL DEFAULT '',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_evaluations" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "agentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "evaluatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memory_entries" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "agentId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT '_',
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersion" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedById" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentStepId" TEXT,
    "state" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_approvals" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID NOT NULL,
    "decidedById" UUID,
    "decision" TEXT,
    "comment" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_traces" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "event" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_tenantId_status_idx" ON "agents"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agents_tenantId_id_key" ON "agents"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_tenantId_key_key" ON "agents"("tenantId", "key");

-- CreateIndex
CREATE INDEX "agent_versions_tenantId_agentId_createdAt_idx" ON "agent_versions"("tenantId", "agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_tenantId_agentId_version_key" ON "agent_versions"("tenantId", "agentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_tenantId_id_key" ON "agent_versions"("tenantId", "id");

-- CreateIndex
CREATE INDEX "agent_evaluations_tenantId_agentId_version_createdAt_idx" ON "agent_evaluations"("tenantId", "agentId", "version", "createdAt");

-- CreateIndex
CREATE INDEX "agent_memory_entries_tenantId_projectId_agentId_updatedAt_idx" ON "agent_memory_entries"("tenantId", "projectId", "agentId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_memory_entries_tenantId_projectId_agentId_key_key" ON "agent_memory_entries"("tenantId", "projectId", "agentId", "key");

-- CreateIndex
CREATE INDEX "workflows_tenantId_projectId_status_idx" ON "workflows"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_tenantId_id_key" ON "workflows"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_tenantId_scopeKey_key_key" ON "workflows"("tenantId", "scopeKey", "key");

-- CreateIndex
CREATE INDEX "workflow_versions_tenantId_workflowId_createdAt_idx" ON "workflow_versions"("tenantId", "workflowId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_tenantId_workflowId_version_key" ON "workflow_versions"("tenantId", "workflowId", "version");

-- CreateIndex
CREATE INDEX "workflow_runs_tenantId_projectId_status_createdAt_idx" ON "workflow_runs"("tenantId", "projectId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_tenantId_id_key" ON "workflow_runs"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_tenantId_idempotencyKey_key" ON "workflow_runs"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "workflow_approvals_tenantId_runId_status_idx" ON "workflow_approvals"("tenantId", "runId", "status");

-- CreateIndex
CREATE INDEX "workflow_traces_tenantId_runId_createdAt_idx" ON "workflow_traces"("tenantId", "runId", "createdAt");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_createdById_fkey" FOREIGN KEY ("tenantId", "createdById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_tenantId_agentId_fkey" FOREIGN KEY ("tenantId", "agentId") REFERENCES "agents"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_tenantId_createdById_fkey" FOREIGN KEY ("tenantId", "createdById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_evaluations" ADD CONSTRAINT "agent_evaluations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_evaluations" ADD CONSTRAINT "agent_evaluations_tenantId_agentId_fkey" FOREIGN KEY ("tenantId", "agentId") REFERENCES "agents"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_evaluations" ADD CONSTRAINT "agent_evaluations_tenantId_evaluatedById_fkey" FOREIGN KEY ("tenantId", "evaluatedById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_tenantId_agentId_fkey" FOREIGN KEY ("tenantId", "agentId") REFERENCES "agents"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_tenantId_createdById_fkey" FOREIGN KEY ("tenantId", "createdById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenantId_createdById_fkey" FOREIGN KEY ("tenantId", "createdById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_tenantId_workflowId_fkey" FOREIGN KEY ("tenantId", "workflowId") REFERENCES "workflows"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_tenantId_createdById_fkey" FOREIGN KEY ("tenantId", "createdById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenantId_workflowId_fkey" FOREIGN KEY ("tenantId", "workflowId") REFERENCES "workflows"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenantId_requestedById_fkey" FOREIGN KEY ("tenantId", "requestedById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_tenantId_runId_fkey" FOREIGN KEY ("tenantId", "runId") REFERENCES "workflow_runs"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_traces" ADD CONSTRAINT "workflow_traces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_traces" ADD CONSTRAINT "workflow_traces_tenantId_runId_fkey" FOREIGN KEY ("tenantId", "runId") REFERENCES "workflow_runs"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Force RLS for all newly introduced tenant and project-owned records.
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_memory_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_traces" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "agents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_evaluations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_memory_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflows" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflow_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflow_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflow_approvals" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflow_traces" FORCE ROW LEVEL SECURITY;

CREATE POLICY agents_tenant_scope ON "agents"
USING ("tenantId"::text = current_setting('app.tenant_id', true))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true));

CREATE POLICY agent_versions_tenant_scope ON "agent_versions"
USING ("tenantId"::text = current_setting('app.tenant_id', true))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true));

CREATE POLICY agent_evaluations_tenant_scope ON "agent_evaluations"
USING ("tenantId"::text = current_setting('app.tenant_id', true))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true));

CREATE POLICY agent_memory_project_scope ON "agent_memory_entries"
USING ("tenantId"::text = current_setting('app.tenant_id', true)
  AND "projectId" = current_setting('app.project_id', true))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true)
  AND "projectId" = current_setting('app.project_id', true));

CREATE POLICY workflows_project_scope ON "workflows"
USING ("tenantId"::text = current_setting('app.tenant_id', true)
  AND ("projectId" IS NULL OR "projectId" = current_setting('app.project_id', true)))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true)
  AND ("projectId" IS NULL OR "projectId" = current_setting('app.project_id', true)));

CREATE POLICY workflow_versions_project_scope ON "workflow_versions"
USING ("tenantId"::text = current_setting('app.tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM "workflows" w
    WHERE w."tenantId" = "workflow_versions"."tenantId"
      AND w."id" = "workflow_versions"."workflowId"
      AND (w."projectId" IS NULL OR w."projectId" = current_setting('app.project_id', true))
  ))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM "workflows" w
    WHERE w."tenantId" = "workflow_versions"."tenantId"
      AND w."id" = "workflow_versions"."workflowId"
      AND (w."projectId" IS NULL OR w."projectId" = current_setting('app.project_id', true))
  ));

CREATE POLICY workflow_runs_project_scope ON "workflow_runs"
USING ("tenantId"::text = current_setting('app.tenant_id', true)
  AND "projectId" = current_setting('app.project_id', true))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true)
  AND "projectId" = current_setting('app.project_id', true));

CREATE POLICY workflow_approvals_project_scope ON "workflow_approvals"
USING ("tenantId"::text = current_setting('app.tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM "workflow_runs" r
    WHERE r."tenantId" = "workflow_approvals"."tenantId"
      AND r."id" = "workflow_approvals"."runId"
      AND r."projectId" = current_setting('app.project_id', true)
  ))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM "workflow_runs" r
    WHERE r."tenantId" = "workflow_approvals"."tenantId"
      AND r."id" = "workflow_approvals"."runId"
      AND r."projectId" = current_setting('app.project_id', true)
  ));

CREATE POLICY workflow_traces_project_scope ON "workflow_traces"
USING ("tenantId"::text = current_setting('app.tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM "workflow_runs" r
    WHERE r."tenantId" = "workflow_traces"."tenantId"
      AND r."id" = "workflow_traces"."runId"
      AND r."projectId" = current_setting('app.project_id', true)
  ))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM "workflow_runs" r
    WHERE r."tenantId" = "workflow_traces"."tenantId"
      AND r."id" = "workflow_traces"."runId"
      AND r."projectId" = current_setting('app.project_id', true)
  ));

CREATE OR REPLACE FUNCTION prevent_agent_version_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'Agent versions are immutable';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_versions_immutable
BEFORE UPDATE OR DELETE ON "agent_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_agent_version_mutation();
