-- CreateEnum
CREATE TYPE "RuntimeDeviceStatus" AS ENUM ('PAIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RuntimeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'CANCEL_REQUESTED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "device_pairings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "operating_system" TEXT NOT NULL,
    "architecture" TEXT NOT NULL,
    "runtime_version" TEXT NOT NULL,
    "status" "RuntimeDeviceStatus" NOT NULL DEFAULT 'PAIRED',
    "token_hash" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "last_heartbeat_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runtime_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_project_grants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_project_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_runtime_workspaces" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "root_alias" TEXT NOT NULL,
    "workspace_key" TEXT NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT true,
    "can_write" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_runtime_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "workspace_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error_code" TEXT,
    "status" "RuntimeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "runtime_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_pairings_code_hash_key" ON "device_pairings"("code_hash");

-- CreateIndex
CREATE INDEX "device_pairings_tenant_id_owner_id_expires_at_idx" ON "device_pairings"("tenant_id", "owner_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_devices_token_hash_key" ON "runtime_devices"("token_hash");

-- CreateIndex
CREATE INDEX "runtime_devices_tenant_id_owner_id_status_idx" ON "runtime_devices"("tenant_id", "owner_id", "status");

-- CreateIndex
CREATE INDEX "runtime_devices_status_last_heartbeat_at_idx" ON "runtime_devices"("status", "last_heartbeat_at");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_devices_tenant_id_id_key" ON "runtime_devices"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "device_project_grants_tenant_id_project_id_idx" ON "device_project_grants"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_project_grants_device_id_project_id_key" ON "device_project_grants"("device_id", "project_id");

-- CreateIndex
CREATE INDEX "local_runtime_workspaces_tenant_id_project_id_status_idx" ON "local_runtime_workspaces"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "local_runtime_workspaces_tenant_id_device_id_workspace_key_key" ON "local_runtime_workspaces"("tenant_id", "device_id", "workspace_key");

-- CreateIndex
CREATE UNIQUE INDEX "local_runtime_workspaces_tenant_id_id_key" ON "local_runtime_workspaces"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "runtime_jobs_device_id_status_created_at_idx" ON "runtime_jobs"("device_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "runtime_jobs_tenant_id_project_id_created_at_idx" ON "runtime_jobs"("tenant_id", "project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_jobs_tenant_id_id_key" ON "runtime_jobs"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "runtime_jobs_tenant_id_idempotency_key_key" ON "runtime_jobs"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "runtime_logs_tenant_id_device_id_created_at_idx" ON "runtime_logs"("tenant_id", "device_id", "created_at");

-- AddForeignKey
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_tenant_id_owner_id_fkey" FOREIGN KEY ("tenant_id", "owner_id") REFERENCES "users"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_devices" ADD CONSTRAINT "runtime_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_devices" ADD CONSTRAINT "runtime_devices_tenant_id_owner_id_fkey" FOREIGN KEY ("tenant_id", "owner_id") REFERENCES "users"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_project_grants" ADD CONSTRAINT "device_project_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_project_grants" ADD CONSTRAINT "device_project_grants_tenant_id_device_id_fkey" FOREIGN KEY ("tenant_id", "device_id") REFERENCES "runtime_devices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_project_grants" ADD CONSTRAINT "device_project_grants_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_runtime_workspaces" ADD CONSTRAINT "local_runtime_workspaces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_runtime_workspaces" ADD CONSTRAINT "local_runtime_workspaces_tenant_id_device_id_fkey" FOREIGN KEY ("tenant_id", "device_id") REFERENCES "runtime_devices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_runtime_workspaces" ADD CONSTRAINT "local_runtime_workspaces_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_jobs" ADD CONSTRAINT "runtime_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_jobs" ADD CONSTRAINT "runtime_jobs_tenant_id_device_id_fkey" FOREIGN KEY ("tenant_id", "device_id") REFERENCES "runtime_devices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_jobs" ADD CONSTRAINT "runtime_jobs_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "project_workspaces"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_jobs" ADD CONSTRAINT "runtime_jobs_tenant_id_workspace_id_fkey" FOREIGN KEY ("tenant_id", "workspace_id") REFERENCES "local_runtime_workspaces"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_jobs" ADD CONSTRAINT "runtime_jobs_tenant_id_requested_by_id_fkey" FOREIGN KEY ("tenant_id", "requested_by_id") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_logs" ADD CONSTRAINT "runtime_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_logs" ADD CONSTRAINT "runtime_logs_tenant_id_device_id_fkey" FOREIGN KEY ("tenant_id", "device_id") REFERENCES "runtime_devices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

