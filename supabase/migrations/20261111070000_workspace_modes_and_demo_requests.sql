-- ============================================================
-- Migration: Add workspace modes, custom pricing, portal slug,
-- and demo requests table
-- ============================================================

-- 1. Organizations workspace mode, portal slug & custom pricing
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS workspace_mode TEXT DEFAULT 'COMMERCIAL', -- 'ENTERPRISE' | 'COMMERCIAL'
  ADD COLUMN IF NOT EXISTS portal_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS remote_fee NUMERIC DEFAULT 3500,
  ADD COLUMN IF NOT EXISTS physical_visit_fee NUMERIC DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS custom_paystack_public_key TEXT;

CREATE INDEX IF NOT EXISTS idx_organizations_portal_slug ON organizations (portal_slug);
CREATE INDEX IF NOT EXISTS idx_organizations_workspace_mode ON organizations (workspace_mode);

-- 2. Inbound Demo Requests Table
CREATE TABLE IF NOT EXISTS demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT NOT NULL,
  org_type TEXT DEFAULT 'enterprise', -- 'enterprise' | 'msp' | 'other'
  message TEXT,
  status TEXT DEFAULT 'NEW', -- 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for demo_requests
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (public or logged-in) can submit a demo request
CREATE POLICY "Allow public demo submissions"
  ON demo_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Authenticated users from master org or admins can view demo requests
CREATE POLICY "Allow admins to view demo requests"
  ON demo_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations o
      JOIN profiles p ON p.org_id = o.id
      WHERE p.id = auth.uid() AND (o.is_master_org = true OR p.role = 'admin')
    )
  );

CREATE POLICY "Allow admins to update demo requests"
  ON demo_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations o
      JOIN profiles p ON p.org_id = o.id
      WHERE p.id = auth.uid() AND (o.is_master_org = true OR p.role = 'admin')
    )
  );
