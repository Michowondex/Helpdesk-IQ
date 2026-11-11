-- ================================================================
-- Bank-Grade Row Level Security + Immutable Audit Trail
-- Migration: 20261111050000_bank_grade_rls_policies.sql
-- ================================================================

-- 1. TICKETS — Strict org_id tenant isolation
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_tickets_isolation" ON public.tickets;
CREATE POLICY "tenant_tickets_isolation" ON public.tickets
  FOR ALL USING (org_id = public.current_user_org_id());

-- 2. INCIDENTS — Strict org_id tenant isolation
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_incidents_isolation" ON public.incidents;
CREATE POLICY "tenant_incidents_isolation" ON public.incidents
  FOR ALL USING (org_id = public.current_user_org_id());

-- 3. MONITORED SERVICES — Strict org_id tenant isolation
ALTER TABLE public.monitored_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_services_isolation" ON public.monitored_services;
CREATE POLICY "tenant_services_isolation" ON public.monitored_services
  FOR ALL USING (org_id = public.current_user_org_id());

-- 4. EMAILS LOG — Strict org_id tenant isolation
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_emails_isolation" ON public.emails;
CREATE POLICY "tenant_emails_isolation" ON public.emails
  FOR ALL USING (org_id = public.current_user_org_id());

-- 5. ORGANIZATIONS — Only the org members can see their own org row
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_org_isolation" ON public.organizations;
CREATE POLICY "tenant_org_isolation" ON public.organizations
  FOR SELECT USING (id = public.current_user_org_id());

DROP POLICY IF EXISTS "tenant_org_update" ON public.organizations;
CREATE POLICY "tenant_org_update" ON public.organizations
  FOR UPDATE USING (
    id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  );

-- 6. KNOWLEDGE BASE — Isolate per org, allow global baseline (org_id IS NULL)
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_kb_isolation" ON public.knowledge_base;
CREATE POLICY "tenant_kb_isolation" ON public.knowledge_base
  FOR ALL USING (org_id = public.current_user_org_id() OR org_id IS NULL);

-- 7. IMMUTABLE AUDIT TRAIL — Allow INSERT + SELECT only, block EDIT/DELETE
-- Even org admins cannot tamper with or delete audit log records
REVOKE UPDATE, DELETE ON public.session_audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.session_audit_logs FROM anon;

-- Ensure INSERT + SELECT still work for audit logging
GRANT INSERT, SELECT ON public.session_audit_logs TO authenticated;
