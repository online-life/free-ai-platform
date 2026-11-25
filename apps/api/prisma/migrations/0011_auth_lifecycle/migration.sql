ALTER TABLE "users"
  ADD COLUMN "password_change_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3);

ALTER TABLE "sessions"
  ADD COLUMN "csrf_token_hash" TEXT;

CREATE INDEX "sessions_tenant_user_active_idx"
  ON "sessions"("tenant_id", "user_id", "revoked_at", "expires_at");
