-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('TODO', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProjectTaskType" AS ENUM ('TASK', 'BUG', 'FEATURE', 'RESEARCH', 'DOCUMENTATION', 'TEST');

-- CreateEnum
CREATE TYPE "ProjectRequirementType" AS ENUM ('FUNCTIONAL', 'NON_FUNCTIONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "ProjectRequirementStatus" AS ENUM ('PROPOSED', 'APPROVED', 'IMPLEMENTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectDependencyType" AS ENUM ('BLOCKS', 'REQUIRES', 'RELATES_TO');

-- CreateEnum
CREATE TYPE "ProjectIntakeStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ProjectFileClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ProjectContextType" AS ENUM ('NOTE', 'DECISION', 'CONVENTION', 'RISK', 'GLOSSARY');

-- CreateEnum
CREATE TYPE "AgentCapability" AS ENUM ('GENERAL_PLANNING', 'CODE_GENERATION', 'CODE_REVIEW', 'RESEARCH', 'DESIGN', 'DATA_ANALYSIS', 'TOOL_USE');

-- CreateEnum
CREATE TYPE "ModelCapability" AS ENUM ('TEXT_GENERATION', 'REASONING', 'CODE_GENERATION', 'EMBEDDINGS', 'VISION', 'IMAGE_GENERATION', 'AUDIO', 'AUDIO_INPUT', 'AUDIO_OUTPUT', 'VIDEO_INPUT', 'LONG_CONTEXT', 'SPEECH_TO_TEXT', 'TEXT_TO_SPEECH', 'TOOL_CALLING', 'STRUCTURED_OUTPUT');

-- AlterTable
ALTER TABLE "secrets" ADD COLUMN "scope_key" TEXT;

-- Preserve old tenant/project/name scope uniqueness while backfilling.
UPDATE "secrets" SET "scope_key" = COALESCE("project_id"::text, '_');
ALTER TABLE "secrets" ALTER COLUMN "scope_key" SET NOT NULL;

-- DropIndex
DROP INDEX "secrets_tenant_id_project_id_name_key";

-- CreateTable
CREATE TABLE "project_workspaces" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "category" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_intakes" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "priority" "ProjectTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "requestedBy" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProjectIntakeStatus" NOT NULL DEFAULT 'RECEIVED',
    "reviewNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_requirements" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ProjectRequirementType" NOT NULL,
    "priority" "ProjectTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ProjectRequirementStatus" NOT NULL DEFAULT 'PROPOSED',
    "acceptanceCriteria" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectTaskType" NOT NULL DEFAULT 'TASK',
    "priority" "ProjectTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "assigneeId" UUID,
    "parentTaskId" TEXT,
    "requirementId" TEXT,
    "estimateMinutes" INTEGER,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_task_dependencies" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "type" "ProjectDependencyType" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_specialist_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "profile" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_specialist_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_context_entries" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectContextType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_context_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "classification" "ProjectFileClassification" NOT NULL DEFAULT 'INTERNAL',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comments" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_credentials" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT '_',
    "name" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_connections" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT '_',
    "baseUrl" TEXT NOT NULL,
    "authenticationType" TEXT NOT NULL DEFAULT 'BEARER',
    "credentialId" TEXT,
    "apiVersion" TEXT,
    "customHeaders" JSONB NOT NULL DEFAULT '{}',
    "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
    "maxRetries" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "billingMode" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "freeTierStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "pricingMetadata" JSONB NOT NULL DEFAULT '{}',
    "privacyMetadata" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSuccessfulTest" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastModelSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_models" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "family" TEXT,
    "version" TEXT,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "inputModalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputModalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "features" JSONB NOT NULL DEFAULT '{}',
    "billingMode" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "freeTierStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "inputPricePerMillion" DECIMAL(14,6),
    "outputPricePerMillion" DECIMAL(14,6),
    "rateLimits" JSONB NOT NULL DEFAULT '{}',
    "lifecycle" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "privacyApproved" BOOLEAN NOT NULL DEFAULT false,
    "officialDocumentationUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_evaluations" (
    "id" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "testVersion" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_health_checks" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available" BOOLEAN NOT NULL,
    "latencyMs" INTEGER,
    "errorCode" TEXT,

    CONSTRAINT "provider_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_usage" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerModelId" TEXT,
    "requestId" TEXT NOT NULL,
    "taskId" TEXT,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cost" DECIMAL(14,8),
    "durationMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_workspaces_tenantId_status_idx" ON "project_workspaces"("tenantId", "status");

-- CreateIndex
CREATE INDEX "project_workspaces_tenantId_ownerId_idx" ON "project_workspaces"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "project_workspaces_tenantId_key_key" ON "project_workspaces"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "project_workspaces_tenantId_id_key" ON "project_workspaces"("tenantId", "id");

-- CreateIndex
CREATE INDEX "project_members_tenantId_userId_idx" ON "project_members"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "project_members_tenantId_projectId_role_idx" ON "project_members"("tenantId", "projectId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "project_intakes_tenantId_projectId_status_idx" ON "project_intakes"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "project_intakes_tenantId_createdAt_idx" ON "project_intakes"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "project_requirements_tenantId_projectId_status_idx" ON "project_requirements"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_requirements_tenantId_projectId_id_key" ON "project_requirements"("tenantId", "projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "project_requirements_projectId_code_key" ON "project_requirements"("projectId", "code");

-- CreateIndex
CREATE INDEX "project_tasks_tenantId_projectId_status_idx" ON "project_tasks"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "project_tasks_tenantId_projectId_assigneeId_idx" ON "project_tasks"("tenantId", "projectId", "assigneeId");

-- CreateIndex
CREATE INDEX "project_tasks_tenantId_projectId_dueDate_idx" ON "project_tasks"("tenantId", "projectId", "dueDate");

-- CreateIndex
CREATE INDEX "project_tasks_projectId_parentTaskId_idx" ON "project_tasks"("projectId", "parentTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "project_tasks_tenantId_projectId_id_key" ON "project_tasks"("tenantId", "projectId", "id");

-- CreateIndex
CREATE INDEX "project_task_dependencies_tenantId_projectId_predecessorId_idx" ON "project_task_dependencies"("tenantId", "projectId", "predecessorId");

-- CreateIndex
CREATE INDEX "project_task_dependencies_tenantId_projectId_successorId_idx" ON "project_task_dependencies"("tenantId", "projectId", "successorId");

-- CreateIndex
CREATE UNIQUE INDEX "project_task_dependencies_projectId_predecessorId_successor_key" ON "project_task_dependencies"("projectId", "predecessorId", "successorId", "type");

-- CreateIndex
CREATE INDEX "project_specialist_profiles_tenantId_projectId_createdAt_idx" ON "project_specialist_profiles"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_specialist_profiles_projectId_version_key" ON "project_specialist_profiles"("projectId", "version");

-- CreateIndex
CREATE INDEX "project_context_entries_tenantId_projectId_type_idx" ON "project_context_entries"("tenantId", "projectId", "type");

-- CreateIndex
CREATE INDEX "project_context_entries_projectId_title_version_idx" ON "project_context_entries"("projectId", "title", "version");

-- CreateIndex
CREATE INDEX "project_files_tenantId_projectId_classification_idx" ON "project_files"("tenantId", "projectId", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "project_files_tenantId_storageKey_key" ON "project_files"("tenantId", "storageKey");

-- CreateIndex
CREATE INDEX "project_comments_tenantId_projectId_createdAt_idx" ON "project_comments"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "project_comments_tenantId_taskId_createdAt_idx" ON "project_comments"("tenantId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_credentials_tenantId_projectId_idx" ON "provider_credentials"("tenantId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_credentials_tenantId_scopeKey_id_key" ON "provider_credentials"("tenantId", "scopeKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_credentials_tenantId_scopeKey_name_key" ON "provider_credentials"("tenantId", "scopeKey", "name");

-- CreateIndex
CREATE INDEX "provider_connections_tenantId_projectId_enabled_idx" ON "provider_connections"("tenantId", "projectId", "enabled");

-- CreateIndex
CREATE INDEX "provider_connections_status_enabled_idx" ON "provider_connections"("status", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "provider_connections_tenantId_scopeKey_key_key" ON "provider_connections"("tenantId", "scopeKey", "key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_connections_tenantId_id_key" ON "provider_connections"("tenantId", "id");

-- CreateIndex
CREATE INDEX "provider_models_enabled_availability_freeTierStatus_idx" ON "provider_models"("enabled", "availability", "freeTierStatus");

-- CreateIndex
CREATE UNIQUE INDEX "provider_models_providerId_modelId_key" ON "provider_models"("providerId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_models_providerId_id_key" ON "provider_models"("providerId", "id");

-- CreateIndex
CREATE INDEX "model_evaluations_providerModelId_createdAt_idx" ON "model_evaluations"("providerModelId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_health_checks_providerId_checkedAt_idx" ON "provider_health_checks"("providerId", "checkedAt");

-- CreateIndex
CREATE INDEX "provider_usage_tenantId_requestId_idx" ON "provider_usage"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "provider_usage_tenantId_projectId_createdAt_idx" ON "provider_usage"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_usage_providerId_createdAt_idx" ON "provider_usage"("providerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_id_key" ON "users"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "secrets_tenant_id_scope_key_name_key" ON "secrets"("tenant_id", "scope_key", "name");

-- CreateIndex
CREATE UNIQUE INDEX "secrets_tenant_id_scope_key_id_key" ON "secrets"("tenant_id", "scope_key", "id");

-- CreateIndex
CREATE UNIQUE INDEX "secrets_tenant_id_id_key" ON "secrets"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_tenantId_ownerId_fkey" FOREIGN KEY ("tenantId", "ownerId") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_tenantId_createdById_fkey" FOREIGN KEY ("tenantId", "createdById") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "users"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_intakes" ADD CONSTRAINT "project_intakes_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_tenantId_projectId_requirementId_fkey" FOREIGN KEY ("tenantId", "projectId", "requirementId") REFERENCES "project_requirements"("tenantId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_tenantId_assigneeId_fkey" FOREIGN KEY ("tenantId", "assigneeId") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_tenantId_projectId_parentTaskId_fkey" FOREIGN KEY ("tenantId", "projectId", "parentTaskId") REFERENCES "project_tasks"("tenantId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_tenantId_projectId_predecessorId_fkey" FOREIGN KEY ("tenantId", "projectId", "predecessorId") REFERENCES "project_tasks"("tenantId", "projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_tenantId_projectId_successorId_fkey" FOREIGN KEY ("tenantId", "projectId", "successorId") REFERENCES "project_tasks"("tenantId", "projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_specialist_profiles" ADD CONSTRAINT "project_specialist_profiles_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_context_entries" ADD CONSTRAINT "project_context_entries_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_tenantId_projectId_taskId_fkey" FOREIGN KEY ("tenantId", "projectId", "taskId") REFERENCES "project_tasks"("tenantId", "projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_tenantId_scopeKey_credentialId_fkey" FOREIGN KEY ("tenantId", "scopeKey", "credentialId") REFERENCES "provider_credentials"("tenantId", "scopeKey", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_models" ADD CONSTRAINT "provider_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_evaluations" ADD CONSTRAINT "model_evaluations_providerModelId_fkey" FOREIGN KEY ("providerModelId") REFERENCES "provider_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_health_checks" ADD CONSTRAINT "provider_health_checks_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_tenantId_providerId_fkey" FOREIGN KEY ("tenantId", "providerId") REFERENCES "provider_connections"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_providerId_providerModelId_fkey" FOREIGN KEY ("providerId", "providerModelId") REFERENCES "provider_models"("providerId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant and project rows remain fail-closed when transaction scope is absent.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_members', 'project_intakes', 'project_requirements', 'project_tasks',
    'project_task_dependencies', 'project_specialist_profiles', 'project_context_entries',
    'project_files', 'project_comments', 'provider_usage', 'provider_credentials'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("tenantId"::text = current_setting(''app.tenant_id'', true) AND ("projectId" IS NULL OR "projectId" = current_setting(''app.project_id'', true))) WITH CHECK ("tenantId"::text = current_setting(''app.tenant_id'', true) AND ("projectId" IS NULL OR "projectId" = current_setting(''app.project_id'', true)))',
      table_name || '_scope_isolation', table_name
    );
  END LOOP;
END $$;

ALTER TABLE "project_workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_workspaces" FORCE ROW LEVEL SECURITY;
CREATE POLICY project_workspaces_scope_isolation ON "project_workspaces"
USING ("tenantId"::text = current_setting('app.tenant_id', true) AND (current_setting('app.project_id', true) = '' OR "id" = current_setting('app.project_id', true)))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true) AND (current_setting('app.project_id', true) = '' OR "id" = current_setting('app.project_id', true)));

ALTER TABLE "provider_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY provider_connections_scope_isolation ON "provider_connections"
USING ("tenantId"::text = current_setting('app.tenant_id', true) AND ("projectId" IS NULL OR "projectId" = current_setting('app.project_id', true)))
WITH CHECK ("tenantId"::text = current_setting('app.tenant_id', true) AND ("projectId" IS NULL OR "projectId" = current_setting('app.project_id', true)));

ALTER TABLE "provider_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_models" FORCE ROW LEVEL SECURITY;
CREATE POLICY provider_models_scope_isolation ON "provider_models"
USING (EXISTS (SELECT 1 FROM "provider_connections" p WHERE p."id" = "providerId"))
WITH CHECK (EXISTS (SELECT 1 FROM "provider_connections" p WHERE p."id" = "providerId"));

ALTER TABLE "provider_health_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_health_checks" FORCE ROW LEVEL SECURITY;
CREATE POLICY provider_health_scope_isolation ON "provider_health_checks"
USING (EXISTS (SELECT 1 FROM "provider_connections" p WHERE p."id" = "providerId"))
WITH CHECK (EXISTS (SELECT 1 FROM "provider_connections" p WHERE p."id" = "providerId"));

ALTER TABLE "model_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_evaluations" FORCE ROW LEVEL SECURITY;
CREATE POLICY model_evaluations_scope_isolation ON "model_evaluations"
USING (EXISTS (SELECT 1 FROM "provider_models" m WHERE m."id" = "providerModelId"))
WITH CHECK (EXISTS (SELECT 1 FROM "provider_models" m WHERE m."id" = "providerModelId"));

