-- Additive, read-only RLS policy.
--
-- project_members is FORCE ROW LEVEL SECURITY and its existing policy only
-- exposes rows whose "projectId" equals app.project_id. Membership checks and
-- the project list run before a project scope is known (app.project_id = ''),
-- so under a non-superuser, non-BYPASSRLS application role every membership
-- lookup returned zero rows: project lists were empty and project-scoped
-- runtime/provider operations were always denied.
--
-- This permissive SELECT policy lets a session read only the membership rows
-- that belong to its own user (app.user_id) inside its own tenant. It grants no
-- INSERT/UPDATE/DELETE and exposes no other project data.
--
-- Rollback: DROP POLICY IF EXISTS "project_members_self_read" ON "project_members";
CREATE POLICY "project_members_self_read" ON "project_members"
  AS PERMISSIVE
  FOR SELECT
  USING (
    "tenantId"::text = current_setting('app.tenant_id', true)
    AND "userId"::text = current_setting('app.user_id', true)
  );
