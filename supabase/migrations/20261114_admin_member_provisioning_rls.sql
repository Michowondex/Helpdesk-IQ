-- ================================================================
-- Admin can provision/remove members within their own organization
-- Migration: 20261114_admin_member_provisioning_rls.sql
-- ================================================================

-- Allow admins to insert pre-provisioned member profiles for their own org
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    id = auth.uid() 
    OR public.current_user_role() = 'admin'
  );

-- Allow admins to delete members within their own organization
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE USING (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  );

-- Allow admins to update/claim profiles within their own org (supports email-match claiming)
DROP POLICY IF EXISTS "profiles_admin_update_org" ON public.profiles;
CREATE POLICY "profiles_admin_update_org" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin')
  );

-- Add invited_by_admin column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'invited_by_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN invited_by_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

