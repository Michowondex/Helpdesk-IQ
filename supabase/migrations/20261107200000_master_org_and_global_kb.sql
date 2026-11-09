-- ============================================================
-- Migration: Master Platform Workspace + Global KB
-- Purpose:
--   1. Mark the bizadoc.com org as the Platform Master Workspace
--   2. Allow KB articles to be flagged as "global" so they are
--      visible to all individual users across the platform
-- ============================================================

-- ── 1. Add is_master_org flag to organizations ───────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_master_org BOOLEAN NOT NULL DEFAULT false;

-- Index for fast lookup of the master org
CREATE INDEX IF NOT EXISTS idx_organizations_is_master_org
  ON organizations (is_master_org)
  WHERE is_master_org = true;

-- ── 2. Add is_global flag to knowledge_base ──────────────────
-- When true, this article is visible to ALL individual users
-- even if they are not in the same org as the article's author.
ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Index for fast retrieval of global articles
CREATE INDEX IF NOT EXISTS idx_knowledge_base_is_global
  ON knowledge_base (is_global)
  WHERE is_global = true;

-- ── 3. RLS policy: individual users can read global KB articles ──
-- Drop the old policy if it exists so we can replace it cleanly.
DROP POLICY IF EXISTS "Global KB visible to all authenticated users" ON knowledge_base;

CREATE POLICY "Global KB visible to all authenticated users"
  ON knowledge_base
  FOR SELECT
  TO authenticated
  USING (
    -- Own org's articles are always visible
    org_id = current_user_org_id()
    OR
    -- Global articles (is_global = true) from any org are visible
    is_global = true
  );

-- ── 4. RLS policy: only master-org admins can mark articles global ──
DROP POLICY IF EXISTS "Only master-org admins can set is_global" ON knowledge_base;

CREATE POLICY "Only master-org admins can set is_global"
  ON knowledge_base
  FOR UPDATE
  TO authenticated
  USING (org_id = current_user_org_id())
  WITH CHECK (
    -- Non-master-org users may not flip is_global to true
    is_global = false
    OR EXISTS (
      SELECT 1 FROM organizations
      WHERE id = current_user_org_id()
        AND is_master_org = true
    )
  );

-- ── 5. Auto-mark bizadoc.com org as master if it already exists ──
-- Wrapped in a DO block to safely bypass RLS for this one-time seed operation.
DO $$
BEGIN
  UPDATE organizations
    SET is_master_org = true
    WHERE domain = 'bizadoc.com';
EXCEPTION WHEN OTHERS THEN
  -- Org doesn't exist yet — will be auto-flagged when owner registers
  NULL;
END;
$$;
