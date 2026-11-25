CREATE TABLE "platform_public_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_public_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_public_settings_singleton_id" CHECK ("id" = 1)
);
