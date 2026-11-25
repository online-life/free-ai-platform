ALTER TABLE "provider_models" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "provider_models_visible_enabled_idx" ON "provider_models"("visible", "enabled", "availability");
