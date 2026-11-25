CREATE TABLE "global_model_policy" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "free_models_enabled" BOOLEAN NOT NULL DEFAULT false,
  "paid_models_enabled" BOOLEAN NOT NULL DEFAULT false,
  "local_models_enabled" BOOLEAN NOT NULL DEFAULT false,
  "custom_providers_enabled" BOOLEAN NOT NULL DEFAULT false,
  "automatic_discovery" BOOLEAN NOT NULL DEFAULT false,
  "automatic_refresh" BOOLEAN NOT NULL DEFAULT false,
  "paid_spending_authorized" BOOLEAN NOT NULL DEFAULT false,
  "monthly_cost_limit" DECIMAL(14,2),
  "updated_by_user_id" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_model_policy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "global_model_policy_singleton" CHECK ("id" = 1),
  CONSTRAINT "global_model_policy_monthly_cost_nonnegative" CHECK ("monthly_cost_limit" IS NULL OR "monthly_cost_limit" >= 0),
  CONSTRAINT "global_model_policy_paid_spending_disabled" CHECK ("paid_spending_authorized" = false)
);

INSERT INTO "global_model_policy" ("id") VALUES (1);
