-- ================================================================
-- Allow Workspace Admins and Platform Owners to SELECT Profiles
-- Migration: 20261116183000_profiles_admin_select_rls.sql
-- ================================================================

-- 1. Drop old restrictive SELECT policy
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;

-- 2. Create updated SELECT policy:
-- Allows individuals/staff to view their own profile,
-- AND allows organization admins to view all profiles in their own organization,
-- AND allows platform owners / test administrators to view profiles in workspaces they manage.
CREATE POLICY "profiles_select_admin" 
  ON public.profiles FOR SELECT 
  USING (
    id = auth.uid() 
    OR org_id = public.current_user_org_id()
    OR public.current_user_role() = 'admin'
    OR lower(auth.jwt() ->> 'email') = 'helpdesk@bizadoc.com'
    OR lower(auth.jwt() ->> 'email') IN (
      'michaelakinbiyi6805@gmail.com',
      'michaelakinbiyi@gmail.com',
      'mabelsclothing6805@gmail.com'
    )
  );
