-- ============================================================
-- Migration: Ensure session_audit_logs table and schema
-- ============================================================

CREATE TABLE IF NOT EXISTS session_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_name TEXT,
  action TEXT,
  action_run TEXT,
  result TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by org and timestamp
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON session_audit_logs (org_id, created_at DESC);

-- Enable RLS
ALTER TABLE session_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs readable by org members" ON session_audit_logs;
CREATE POLICY "Audit logs readable by org members"
  ON session_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id = current_user_org_id()
    OR current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Audit logs insertable by authenticated users" ON session_audit_logs;
CREATE POLICY "Audit logs insertable by authenticated users"
  ON session_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

