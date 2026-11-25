CREATE UNIQUE INDEX "workflow_approvals_tenantId_runId_stepId_key"
  ON "workflow_approvals"("tenantId", "runId", "stepId");

CREATE OR REPLACE FUNCTION "reject_workflow_version_mutation"() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'workflow versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "workflow_versions_immutable"
  BEFORE UPDATE OR DELETE ON "workflow_versions"
  FOR EACH ROW EXECUTE FUNCTION "reject_workflow_version_mutation"();
