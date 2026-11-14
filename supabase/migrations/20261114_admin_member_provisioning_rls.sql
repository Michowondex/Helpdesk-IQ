-- ================================================================
-- Allow Workspace Admins to Provision, Update, & Delete Members
-- Strictly pins helpdesk@bizadoc.com as Platform Owner,
-- and respects profiles.role for all other members (technicians stay technicians).
-- Migration: 20261114_admin_member_provisioning_rls.sql
-- ================================================================

-- 1. Restore master owner account to Admin
UPDATE public.profiles 
SET role = 'admin', account_type = 'business' 
WHERE lower(email) = 'helpdesk@bizadoc.com';

-- 2. Clean, safe helper function: checks profiles.role, with helpdesk@bizadoc.com as fallback owner
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    CASE WHEN lower(auth.jwt() ->> 'email') = 'helpdesk@bizadoc.com' THEN 'admin' END,
    auth.jwt() -> 'user_metadata' ->> 'role',
    'user'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 3. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. INSERT Policy: Regular self-signup OR legitimate Admins OR master owner account
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert" 
  ON public.profiles FOR INSERT 
  WITH CHECK (
    id = auth.uid() 
    OR public.current_user_role() = 'admin'
    OR lower(auth.jwt() ->> 'email') = 'helpdesk@bizadoc.com'
  );

-- 5. UPDATE Policy: Self-update OR Admins inside their own org OR master owner account
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update_org" ON public.profiles;
CREATE POLICY "profiles_admin_update" 
  ON public.profiles FOR UPDATE 
  USING (
    id = auth.uid() 
    OR (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin')
    OR lower(auth.jwt() ->> 'email') = 'helpdesk@bizadoc.com'
  );

-- 6. DELETE Policy: Admins inside their own org OR master owner account
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" 
  ON public.profiles FOR DELETE 
  USING (
    (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin')
    OR lower(auth.jwt() ->> 'email') = 'helpdesk@bizadoc.com'
  );
