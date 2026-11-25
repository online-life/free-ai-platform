CREATE TABLE "platform_setup_state" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_setup_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_setup_state_singleton" CHECK ("id" = 1)
);

INSERT INTO "platform_setup_state" ("id", "completed")
SELECT 1, EXISTS (SELECT 1 FROM "tenants");
